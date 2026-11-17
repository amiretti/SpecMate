// Rule (FR-007, security review V1 MEDIO-2): check:origins also reads dist/ statically, so it catches the requests
// the browser pass never sees at 360/768/1280 px, DPR 1, without scroll: lazy images, 2x srcset candidates,
// <source media>, :hover and print backgrounds, CSS @import, and <link rel=preconnect|dns-prefetch> (no request
// event, and the CSP does not govern them: they would leak the visitor's IP). A link (<a href>) is not a request.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { run, staticOrigins } from '../scripts/controls/origins.mjs';
import { VARIANTS } from './lib/build.mjs';
import { mutant, removeBuild } from './lib/mutate.mjs';
import { appendCss, editHome, OUTSIDER } from './lib/mutations-browser.mjs';
import { distDir } from './lib/paths.mjs';

const site = { origin: 'https://horno-azul.example', allowed: [] };
const inHead = (tag) => (dir) => editHome(dir, (html) => html.replace('</head>', `${tag}</head>`));
const inBody = (tag) => (dir) => editHome(dir, (html) => html.replace('</main>', `${tag}</main>`));

async function scan(mutation, siteData = site) {
  const dir = await mutant(distDir, mutation);
  try {
    return await staticOrigins(dir, siteData);
  } finally {
    await removeBuild(dir);
  }
}

describe('check:origins, static pass over dist/', () => {
  it('the healthy builds request nothing outside the site (3 variants)', async () => {
    for (const { out } of Object.values(VARIANTS)) {
      const html = await readFile(path.join(out, 'index.html'), 'utf8');
      const origin = new URL(/<link rel="canonical" href="([^"]+)"/.exec(html)[1]).origin;
      assert.deepEqual(await staticOrigins(out, { origin, allowed: [] }), [], out);
    }
  });

  const cases = {
    'link rel=preconnect': inHead(`<link rel="preconnect" href="${OUTSIDER}">`),
    'link rel=dns-prefetch, protocol-relative': inHead('<link rel="dns-prefetch" href="//cdn.other.example">'),
    'link rel=preload': inHead(`<link rel="preload" as="image" href="${OUTSIDER}/a.png">`),
    'lazy image below the fold': inBody(`<img loading="lazy" alt="x" src="${OUTSIDER}/lazy.png">`),
    '2x srcset candidate': inBody(`<img alt="x" src="/a.png" srcset="/a.png 1x, ${OUTSIDER}/a@2x.png 2x">`),
    '<source media> for wide screens': inBody(
      `<picture><source media="(min-width: 1440px)" srcset="${OUTSIDER}/wide.avif"><img alt="x" src="/a.png"></picture>`,
    ),
    'entity-encoded src': inBody('<img alt="x" src="https&#58;//cdn.other.example/e.png">'),
    'CSS :hover background': (dir) => appendCss(dir, `a:hover { background-image: url("${OUTSIDER}/h.png"); }`),
    'CSS print background': (dir) => appendCss(dir, `@media print { body { background: url(${OUTSIDER}/p.png); } }`),
    'CSS @import': (dir) => appendCss(dir, `@import "${OUTSIDER}/x.css";`),
  };
  for (const [name, mutation] of Object.entries(cases)) {
    it(`fails on ${name}, naming the origin`, async () => {
      const found = await scan(mutation);
      assert.equal(found.length, 1, found.join('\n'));
      assert.match(found[0], /https:\/\/cdn\.other\.example is not in allowedOrigins/);
    });
  }

  it('a plain-http resource of the site origin is foreign', async () => {
    const found = await scan(inBody('<img alt="x" src="http://horno-azul.example/a.png">'));
    assert.equal(found.length, 1, found.join('\n'));
  });

  it('links, canonical and alternate are not requests', async () => {
    assert.deepEqual(
      await scan(
        inBody(
          `<a href="${OUTSIDER}/page">x</a><link rel="alternate" href="${OUTSIDER}/feed"><link rel="canonical" href="${OUTSIDER}/">`,
        ),
      ),
      [],
    );
  });

  it('an allow-listed origin passes', async () => {
    assert.deepEqual(
      await scan(inHead(`<link rel="preconnect" href="${OUTSIDER}">`), { ...site, allowed: [OUTSIDER] }),
      [],
    );
  });
});

describe('check:origins runs the static pass too', () => {
  it('a preconnect the browser never reports fails run()', async () => {
    const dir = await mutant(distDir, inHead(`<link rel="preconnect" href="${OUTSIDER}">`));
    try {
      const result = await run(dir, { data: VARIANTS.address.data });
      assert.equal(result.ok, false);
      assert.ok(
        result.violations.some((v) => /^index\.html \(static\): https:\/\/cdn\.other\.example .*preconnect/.test(v)),
        result.violations.join('\n'),
      );
    } finally {
      await removeBuild(dir);
    }
  });
});
