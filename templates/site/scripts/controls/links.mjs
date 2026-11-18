// Control "Enlaces" (ADR-0030, FR-005): linkinator over a build, served locally and crawled from every page.
// Threshold: 0 broken internal links (fragments included). External links only warn and are NEVER requested
// (plan decision 6: no network). A crawl that cannot run, or that checks nothing, FAILS (constitution VI).
// A link written with the site's own canonical URL (https://<site>/...) is internal: it is rewritten to the local
// server and checked like a relative one (#47). The canonical origin is read from the build's rel="canonical".
// Usage: node scripts/controls/links.mjs [buildDir]
// run(dir) is async: resolves to { ok, violations, warnings }; `warnings` lists the external links, not requested.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinkChecker, LinkState } from 'linkinator';
import { serve } from '../../test/lib/serve.mjs';

const isLocal = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
};

const CANONICAL = /<link\b[^>]*\brel=["']?canonical["']?[^>]*>/gi;
const HREF = /\bhref=["']?([^"'\s>]+)/i;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Origins of the rel="canonical" links of the pages (normally one: the site's own URL). */
async function canonicalOrigins(pages) {
  const origins = new Set();
  for (const page of pages) {
    for (const tag of (await readFile(page, 'utf8')).match(CANONICAL) ?? []) {
      const href = HREF.exec(tag)?.[1];
      if (!href) continue;
      try {
        const url = new URL(href);
        if (url.protocol === 'https:' || url.protocol === 'http:') origins.add(url.host);
      } catch {
        // A relative or malformed canonical names no origin; check:html and the SEO tests own its validity.
      }
    }
  }
  return [...origins];
}

/** @returns {Promise<{ ok: boolean, violations: string[], warnings: string[] }>} */
export async function run(dir) {
  let result;
  let server;
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    const pages = entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => path.join(e.parentPath, e.name));
    if (pages.length === 0) throw new Error('no HTML pages');
    const hosts = await canonicalOrigins(pages);
    // Our own server: its port is known before the crawl, so the canonical origin can point at it.
    server = await serve(dir);
    const local = server.url;
    // http or https, any case, followed by a path, query, fragment or nothing (never a longer host name).
    const urlRewriteExpressions = hosts.map((host) => ({
      pattern: new RegExp(`^https?://${escapeRegExp(host)}(?=[/?#]|$)`, 'i'),
      replacement: local,
    }));
    // Every page is a crawl start (404.html is linked from nowhere). Only links to the local server are requested.
    result = await new LinkChecker().check({
      path: pages.map((p) => `${local}/${path.relative(dir, p).split(path.sep).join('/')}`),
      recurse: true,
      checkFragments: true,
      retry: false,
      urlRewriteExpressions,
      // linkinator asks this BEFORE rewriting, so a canonical-origin link must also count as local here.
      linksToSkip: async (link) => !isLocal(link) && !urlRewriteExpressions.some(({ pattern }) => pattern.test(link)),
    });
  } catch (error) {
    return { ok: false, violations: [`could not check ${dir}: ${error.message}`], warnings: [] };
  } finally {
    await server?.close();
  }
  const crawled = result.links.filter((l) => l.state !== LinkState.SKIPPED);
  if (crawled.length === 0) {
    return { ok: false, violations: [`could not check ${dir}: no internal link was crawled`], warnings: [] };
  }
  // Local URLs are shown as site paths: http://127.0.0.1:<port>/a/ -> /a/.
  const show = (url) => {
    if (!url) return '(start)';
    try {
      const { pathname, search, hash } = new URL(url);
      return `${pathname}${search}${hash}`;
    } catch {
      return url;
    }
  };
  const violations = crawled
    .filter((l) => l.state === LinkState.BROKEN)
    .map((l) => `${show(l.url)} -> ${l.status || 'unreachable'} (from ${show(l.parent)})`);
  const external = result.links.filter((l) => l.state === LinkState.SKIPPED && /^https?:/i.test(l.url));
  const warnings = [...new Set(external.map((l) => `${l.url} external, not requested`))];
  return { ok: violations.length === 0, violations, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations, warnings } = await run(dir);
  for (const w of warnings) console.warn(`check:links WARN ${w}`);
  for (const v of violations) console.error(`check:links FAIL ${v}`);
  console.log(
    ok
      ? `check:links OK: 0 broken internal links (${warnings.length} external link(s) warned, not requested)`
      : `check:links: ${violations.length} broken internal link(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
