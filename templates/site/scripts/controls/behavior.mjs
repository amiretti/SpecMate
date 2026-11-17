// Control "Comportamiento" (ADR-0030, US-12 FR-001): every page of a build, at 360, 768 and 1280 px, with the real
// `_headers` CSP: sections rendered and labelled, anchors that reach an existing id, well-formed contact links,
// no console errors and no failed requests. Threshold: "100 % en verde" (any violation fails).
// A control that cannot measure (no browser, no pages) fails, never passes (constitution VI).
// Usage: node scripts/controls/behavior.mjs <buildDir>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { listFiles } from '../../test/lib/scan.mjs';
import { serve } from '../../test/lib/serve.mjs';

export const WIDTHS = [360, 768, 1280];

// Same shapes the template renders (src/lib/site.ts): E.164 phone, plain e-mail, wa.me with an optional text.
const TEL = /^tel:\+\d{8,15}$/;
const MAILTO =
  /^mailto:[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const WHATSAPP = /^https:\/\/wa\.me\/\d{8,15}(?:\?text=[^#\s]*)?$/;

/** URL path of each HTML page of the build: index.html -> /, a/index.html -> /a/, 404.html -> /404.html. */
export async function pagePaths(dir) {
  return (await listFiles(dir))
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.relative(dir, f).replaceAll('\\', '/'))
    .map((rel) => ({ rel, url: `/${rel.replace(/(^|\/)index\.html$/, '$1')}` }));
}

/** Loads one page at one width; returns the network/console problems and what the DOM says. */
async function visit(browser, origin, page, width) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  const tab = await context.newPage();
  const problems = [];
  tab.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console error: ${msg.text()}`);
  });
  tab.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  tab.on('requestfailed', (req) => problems.push(`failed request: ${req.url()} (${req.failure()?.errorText})`));
  tab.on('response', (res) => {
    if (res.status() >= 400) problems.push(`failed request: ${res.url()} (HTTP ${res.status()})`);
  });
  try {
    const response = await tab.goto(`${origin}${page.url}`, { waitUntil: 'load' });
    if (!response?.ok()) problems.push(`page answered HTTP ${response?.status()}`);
    await tab.waitForLoadState('networkidle');
    const dom = await tab.evaluate(() => {
      const rendered = (el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      };
      return {
        mains: document.querySelectorAll('main').length,
        ids: [...document.querySelectorAll('[id]')].map((el) => el.id),
        sections: [...document.querySelectorAll('main section')].map((s) => {
          const heading = document.getElementById(s.getAttribute('aria-labelledby') ?? '');
          return {
            name: s.id ? `#${s.id}` : `labelled ${s.getAttribute('aria-labelledby') ?? '(none)'}`,
            rendered: rendered(s),
            labelled: Boolean(heading && /^H[1-6]$/.test(heading.tagName) && heading.textContent.trim()),
          };
        }),
        links: [...document.querySelectorAll('a[href]')].map((a) => ({
          raw: a.getAttribute('href'),
          href: a.href,
          rendered: rendered(a),
        })),
      };
    });
    return { problems, dom };
  } finally {
    await context.close();
  }
}

/** Checks the DOM of every page at one width; anchors may point to ids on another page of the same build. */
function checkDom(results, origin) {
  const idsByPath = new Map(results.map(({ page, dom }) => [page.url, new Set(dom?.ids ?? [])]));
  const violations = [];
  for (const { page, width, problems, dom } of results) {
    const at = `${page.rel} @ ${width}px`;
    for (const p of problems) violations.push(`${at}: ${p}`);
    if (!dom) continue;
    if (dom.mains !== 1) violations.push(`${at}: expected one <main>, found ${dom.mains}`);
    for (const s of dom.sections) {
      if (!s.rendered) violations.push(`${at}: section ${s.name} is not rendered`);
      if (!s.labelled) violations.push(`${at}: section ${s.name} has no heading label`);
    }
    for (const link of dom.links) {
      const url = new URL(link.href);
      if (url.origin === origin && url.hash.length > 1) {
        const target = decodeURIComponent(url.hash.slice(1));
        const ids = idsByPath.get(url.pathname);
        if (!ids?.has(target)) violations.push(`${at}: broken anchor: ${link.raw}`);
      }
      const contact = /^(tel|mailto):/i.test(link.raw) || /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(link.raw);
      if (!contact) continue;
      if (![TEL, MAILTO, WHATSAPP].some((re) => re.test(link.raw)))
        violations.push(`${at}: malformed contact link: ${link.raw}`);
      if (!link.rendered) violations.push(`${at}: contact link ${link.raw} is not rendered`);
    }
  }
  return violations;
}

/** First line of an error, for a one-line violation. */
export const firstLine = (error) => String(error?.message ?? error).split('\n')[0];

/**
 * Shared start of the browser controls: the build's pages and a Chromium (`launchOptions` extra, e.g. args).
 * Returns `{ failure }` instead when it cannot measure: no pages or no browser fail, never pass (VI).
 */
export async function openBrowser(dir, { executablePath, ...launchOptions } = {}) {
  const pages = await pagePaths(dir).catch(() => []);
  if (pages.length === 0) return { failure: `could not measure ${dir}: no HTML pages` };
  try {
    const browser = await chromium.launch({ ...launchOptions, ...(executablePath ? { executablePath } : {}) });
    return { pages, browser };
  } catch (error) {
    return { failure: `could not measure ${dir}: no browser (${firstLine(error)})` };
  }
}

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir, { executablePath } = {}) {
  const { pages, browser, failure } = await openBrowser(dir, { executablePath });
  if (failure) return { ok: false, violations: [failure] };
  const server = await serve(dir);
  const violations = [];
  try {
    for (const width of WIDTHS) {
      const results = [];
      for (const page of pages) {
        try {
          results.push({ page, width, ...(await visit(browser, server.url, page, width)) });
        } catch (error) {
          results.push({ page, width, problems: [`could not measure: ${firstLine(error)}`] });
        }
      }
      violations.push(...checkDom(results, server.url));
    }
  } finally {
    await server.close();
    await browser.close();
  }
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations } = await run(dir);
  for (const v of violations) console.error(`check:behavior FAIL ${v}`);
  console.log(
    ok
      ? `check:behavior OK: 100 % green at ${WIDTHS.join(', ')} px (sections, anchors, contact links, 0 console errors, 0 failed requests)`
      : `check:behavior: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
