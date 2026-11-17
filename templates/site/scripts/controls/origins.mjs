// Control "Orígenes externos" (ADR-0030, US-12 FR-007, plan decision 4): the origins of every request each page
// makes, at 360, 768 and 1280 px and in the light and dark color schemes, against the site's allowlist
// (`allowedOrigins` in its data module, each origin with its reason). Threshold: "0 orígenes fuera de la lista".
// The page opens WITHOUT the CSP (bypassCSP, risk R2): the CSP would block a foreign request before it is seen.
// Only this control does so; the others measure with the real `_headers`. A link (<a href>) is not a request.
// Usage: node scripts/controls/origins.mjs <buildDir> [--data <module>]   (default: SITE_DATA or the address example)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseSite } from '../../src/lib/site.ts';
import { serve } from '../../test/lib/serve.mjs';
import { dataModule } from '../site-env.mjs';
import { firstLine, openBrowser, WIDTHS } from './behavior.mjs';

export const SCHEMES = ['light', 'dark'];

/** The validated site of a data module: its canonical origin and its allow-listed origins. */
async function loadSite(data) {
  const { default: input } = await import(pathToFileURL(path.resolve(data)).href);
  const site = parseSite(input);
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

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir, { data = dataModule, executablePath } = {}) {
  let site;
  try {
    site = await loadSite(data);
  } catch (error) {
    return { ok: false, violations: [`could not measure ${dir}: data module ${data}: ${firstLine(error)}`] };
  }
  const built = await builtOrigin(dir).catch(() => undefined);
  if (built !== site.origin)
    return {
      ok: false,
      violations: [`data module ${data} (${site.origin}) does not match the build ${dir} (${built ?? 'no canonical'})`],
    };
  const { pages, browser, failure } = await openBrowser(dir, { executablePath });
  if (failure) return { ok: false, violations: [failure] };
  const server = await serve(dir);
  const allowed = new Set([new URL(server.url).origin, ...site.allowed]);
  const violations = [];
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
      ? `check:origins OK: 0 origins outside the list (${allowed.length} allow-listed) at ${WIDTHS.join(', ')} px, light and dark`
      : `check:origins: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
