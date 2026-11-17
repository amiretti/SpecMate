// Sites that fail on purpose for the browser controls (US-12 AC-2): the table `control -> mutation -> expected
// violation` that test/controls-browser.test.mjs runs and the isolation test (T-seam) joins. Every mutation is
// chosen to break only its own control: width, media or page gated, so the other controls (real CSP, light
// scheme, Lighthouse's 412 px mobile viewport) stay green.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { mutateFile } from './mutate.mjs';

/** An invented third-party origin (it does not resolve); used by the origins rows and tests. */
export const OUTSIDER = 'https://cdn.other.example';

/** Appends `css` to the build's only hashed stylesheet (a same-origin file the CSP allows). */
export async function appendCss(dir, css) {
  const sheets = (await readdir(path.join(dir, '_astro'))).filter((f) => f.endsWith('.css'));
  if (sheets.length !== 1) throw new Error(`expected 1 stylesheet in _astro, found ${sheets.length}`);
  await mutateFile(dir, `_astro/${sheets[0]}`, (text) => `${text}\n${css}\n`);
}

export const editHome = (dir, fn) => mutateFile(dir, 'index.html', fn);

/** One site that fails on purpose per row: `control -> mutation -> expected violation` (AC-2). */
export const BROWSER_MUTATIONS = [
  {
    control: 'behavior',
    // Same-origin 404 requested only below 400 px: a console error at 360 px and nowhere else.
    mutation: (dir) =>
      appendCss(dir, '@media (max-width: 400px) { body { background-image: url(/missing-narrow.png); } }'),
    expected: /index\.html @ 360px: console error/,
  },
  {
    control: 'behavior',
    // Same-origin 404 requested only from 1000 px up: a failed request at 1280 px.
    mutation: (dir) =>
      appendCss(dir, '@media (min-width: 1000px) { body { background-image: url(/missing-wide.png); } }'),
    expected: /index\.html @ 1280px: failed request: .*\/missing-wide\.png/,
  },
  {
    control: 'a11y',
    // Unreadable paragraph only from 1000 px up (axe color-contrast is "serious"); Lighthouse's 412 px never sees it.
    mutation: (dir) =>
      appendCss(
        dir,
        '@media (min-width: 1000px) { #nosotros p { color: #777 !important; background-color: #888 !important; } }',
      ),
    expected: /index\.html @ 1280px: serious color-contrast/,
  },
  {
    control: 'lighthouse',
    mutation: (dir) =>
      editHome(dir, (html) =>
        html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex">'),
      ),
    expected: /index\.html: seo \d+ < 95/,
  },
  {
    control: 'origins',
    // Requested only in dark mode: the CSP-bound controls (light scheme) never fetch it, origins measures both.
    mutation: (dir) =>
      appendCss(dir, `@media (prefers-color-scheme: dark) { body { background-image: url(${OUTSIDER}/bg.png); } }`),
    expected: /index\.html @ \d+px dark: https:\/\/cdn\.other\.example is not in allowedOrigins/,
  },
];
