// Control "Orígenes externos" (ADR-0030, US-12 FR-007, plan decision 4): the origins of every request each page
// makes, at 360, 768 and 1280 px and in the light and dark color schemes, against the site's allowlist
// (`brief.allowedOrigins` in its relevamiento.json, each origin with its reason, US-14 FR-010). Threshold: "0 orígenes fuera de la lista".
// The page opens WITHOUT the CSP (bypassCSP, risk R2): the CSP would block a foreign request before it is seen.
// Only this control does so; the others measure with the real `_headers`. A link (<a href>) is not a request.
// Usage: node scripts/controls/origins.mjs <buildDir> [--data <relevamiento.json>]   (default: SITE_DATA or the
// relevamiento.json at the repo root)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRelevamiento } from '../../src/lib/site.ts';
import { decodeEntities, listFiles } from '../../test/lib/scan.mjs';
import { serve } from '../../test/lib/serve.mjs';
import { dataFile, root } from '../site-env.mjs';
import { firstLine, openBrowser, WIDTHS } from './behavior.mjs';

export const SCHEMES = ['light', 'dark'];

/** The validated site of a relevamiento.json: its canonical origin and its allow-listed origins. */
async function loadSite(data) {
  const site = loadRelevamiento(path.resolve(data), root);
  return { origin: new URL(site.url).origin, allowed: site.allowedOrigins.map((o) => o.origin) };
}

/** The canonical origin the build was made for, read from its home page. */
async function builtOrigin(dir) {
  const html = await readFile(path.join(dir, 'index.html'), 'utf8');
  const href = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  return href ? new URL(href).origin : undefined;
}

/** Every http(s) origin one page requests at one width and color scheme, with one example URL each. */
async function requests(browser, origin, page, width, colorScheme) {
  const context = await browser.newContext({ bypassCSP: true, viewport: { width, height: 800 }, colorScheme });
  const seen = new Map();
  try {
    const tab = await context.newPage();
    tab.on('request', (req) => {
      const url = new URL(req.url());
      if ((url.protocol === 'http:' || url.protocol === 'https:') && !seen.has(url.origin))
        seen.set(url.origin, url.href);
    });
    await tab.goto(`${origin}${page.url}`, { waitUntil: 'load' });
    await tab.waitForLoadState('networkidle');
    return seen;
  } finally {
    await context.close();
  }
}

// Static pass (security review V1 MEDIO-2): what the browser pass cannot see at 3 widths, DPR 1 and without scroll
// (lazy images, 2x srcset, <source media>, :hover and print CSS, @import) and what never fires a request event or
// obeys the CSP (<link rel=preconnect|dns-prefetch>, which leaks the visitor's IP). Every URL-bearing attribute of
// every HTML/SVG file and every url()/@import of every CSS file in the build counts; <a href> does not.
const TAG = /<([a-z][a-z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTR = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
const URL_ATTRS = new Set(['src', 'poster', 'data', 'background', 'action', 'formaction', 'manifest', 'ping']);
const SRCSET_ATTRS = new Set(['srcset', 'imagesrcset']);
const HREF_FETCHING_TAGS = new Set(['link', 'image', 'use', 'feimage', 'script']);
// <link> rels that never fetch anything; any other rel (preconnect, dns-prefetch, preload, icon, ...) counts.
const LINK_NOT_A_REQUEST = new Set(['canonical', 'alternate', 'author', 'help', 'license', 'me', 'next', 'prev']);
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)|@import\s+(["'])(.*?)\3/gi;

const clean = (value) =>
  decodeEntities(value.replace(/^["']|["']$/g, ''))
    // biome-ignore lint/suspicious/noControlCharactersInRegex: browsers drop control chars and spaces in URLs.
    .replace(/[\u0000-\u001f]/g, '')
    .trim();

/** The http(s) origin a reference resolves to, or undefined when it stays on the page's origin or is not http(s). */
function foreignOrigin(ref, site) {
  if (!/^(https?:)?\/\//i.test(ref)) return undefined;
  const url = new URL(ref, `${site.origin}/`);
  return url.origin;
}

/** Every reference a tag makes the browser fetch: [{ what, ref }]. */
function tagRequests(name, attrs) {
  const tag = name.toLowerCase();
  const map = new Map([...attrs.matchAll(ATTR)].map(([, n, v = '']) => [n.toLowerCase(), clean(v)]));
  const found = [];
  for (const [attr, value] of map) {
    if (!value) continue;
    if (URL_ATTRS.has(attr)) found.push({ what: `<${tag} ${attr}>`, ref: value });
    if (SRCSET_ATTRS.has(attr)) {
      for (const candidate of value.split(',')) {
        const ref = candidate.trim().split(/\s+/)[0];
        if (ref) found.push({ what: `<${tag} ${attr}>`, ref });
      }
    }
    if ((attr === 'href' || attr === 'xlink:href') && HREF_FETCHING_TAGS.has(tag)) {
      const rels = (map.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      if (tag === 'link' && rels.length > 0 && rels.every((r) => LINK_NOT_A_REQUEST.has(r))) continue;
      found.push({
        what: tag === 'link' ? `<link rel=${rels.join(' ') || '(none)'}>` : `<${tag} ${attr}>`,
        ref: value,
      });
    }
  }
  return found;
}

/**
 * Static origins check over a build: one violation per file and foreign origin not in `site.allowed`.
 * @param {string} dir  the build
 * @param {{ origin: string, allowed: string[] }} site  canonical origin of the site and its allow-listed origins
 */
export async function staticOrigins(dir, site) {
  const files = (await listFiles(dir)).filter((f) => /\.(html|svg|css)$/i.test(f));
  if (files.length === 0) throw new Error(`${dir} has no HTML, SVG or CSS files`);
  const allowed = new Set([site.origin, ...site.allowed]);
  const violations = [];
  for (const file of files) {
    const rel = path.relative(dir, file).replaceAll('\\', '/');
    const text = await readFile(file, 'utf8');
    const refs = file.toLowerCase().endsWith('.css')
      ? [...text.matchAll(CSS_URL)].map((m) => ({
          what: m[2] !== undefined ? 'css url()' : 'css @import',
          ref: clean(m[2] ?? m[4]),
        }))
      : [...text.matchAll(TAG)].flatMap(([, name, attrs]) => tagRequests(name, attrs));
    const reported = new Set();
    for (const { what, ref } of refs) {
      const origin = foreignOrigin(ref, site);
      if (origin === undefined || allowed.has(origin) || reported.has(origin)) continue;
      reported.add(origin);
      violations.push(`${rel} (static): ${origin} is not in allowedOrigins (${what}: ${ref})`);
    }
  }
  return violations;
}

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir, { data = dataFile, executablePath } = {}) {
  let site;
  try {
    site = await loadSite(data);
  } catch (error) {
    return { ok: false, violations: [`could not measure ${dir}: relevamiento ${data}: ${firstLine(error)}`] };
  }
  const built = await builtOrigin(dir).catch(() => undefined);
  if (built !== site.origin)
    return {
      ok: false,
      violations: [
        `relevamiento ${data} (${site.origin}) does not match the build ${dir} (${built ?? 'no canonical'})`,
      ],
    };
  const violations = [];
  try {
    violations.push(...(await staticOrigins(dir, site)));
  } catch (error) {
    return { ok: false, violations: [`could not measure ${dir} (static): ${firstLine(error)}`] };
  }
  const { pages, browser, failure } = await openBrowser(dir, { executablePath });
  if (failure) return { ok: false, violations: [...violations, failure] };
  const server = await serve(dir);
  const allowed = new Set([new URL(server.url).origin, ...site.allowed]);
  try {
    for (const width of WIDTHS) {
      for (const scheme of SCHEMES) {
        for (const page of pages) {
          const at = `${page.rel} @ ${width}px ${scheme}`;
          try {
            for (const [origin, example] of await requests(browser, server.url, page, width, scheme)) {
              if (!allowed.has(origin)) violations.push(`${at}: ${origin} is not in allowedOrigins (${example})`);
            }
          } catch (error) {
            violations.push(`${at}: could not measure: ${firstLine(error)}`);
          }
        }
      }
    }
  } finally {
    await server.close();
    await browser.close();
  }
  return { ok: violations.length === 0, violations, allowed: site.allowed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--data');
  const data = flag === -1 ? undefined : args.splice(flag, 2)[1];
  const dir = path.resolve(args[0] ?? 'dist');
  const { ok, violations, allowed } = await run(dir, data ? { data } : {});
  for (const v of violations) console.error(`check:origins FAIL ${v}`);
  console.log(
    ok
      ? `check:origins OK: 0 origins outside the list (${allowed.length} allow-listed) at ${WIDTHS.join(', ')} px, light and dark, plus a static pass over every HTML, SVG and CSS file`
      : `check:origins: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
