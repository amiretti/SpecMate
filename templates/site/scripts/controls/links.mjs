// Control "Enlaces" (ADR-0030, FR-005): linkinator over a build, served locally and crawled from every page.
// Threshold: 0 broken internal links (fragments included). External links only warn and are NEVER requested
// (plan decision 6: no network). A crawl that cannot run, or that checks nothing, FAILS (constitution VI).
// Usage: node scripts/controls/links.mjs [buildDir]
// run(dir) is async: resolves to { ok, violations, warnings }; `warnings` lists the external links, not requested.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LinkChecker, LinkState } from 'linkinator';

const isLocal = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
};

/** @returns {Promise<{ ok: boolean, violations: string[], warnings: string[] }>} */
export async function run(dir) {
  let result;
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    const pages = entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => path.join(e.parentPath, e.name));
    if (pages.length === 0) throw new Error('no HTML pages');
    // Every page is a crawl start (404.html is linked from nowhere). Only links to the local server are requested.
    result = await new LinkChecker().check({
      path: pages,
      serverRoot: dir,
      recurse: true,
      checkFragments: true,
      retry: false,
      linksToSkip: async (link) => !isLocal(link),
    });
  } catch (error) {
    return { ok: false, violations: [`could not check ${dir}: ${error.message}`], warnings: [] };
  }
  // linkinator reports local links as paths relative to serverRoot (it maps its local server back to `dir`).
  const local = result.links.filter((l) => l.state !== LinkState.SKIPPED);
  if (local.length === 0) {
    return { ok: false, violations: [`could not check ${dir}: no internal link was crawled`], warnings: [] };
  }
  const show = (p) => (p ? `/${p.split(path.sep).join('/')}` : '(start)');
  const violations = local
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
