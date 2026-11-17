// Rule (S2, ADR-0030 "Sin inyeccion" 2, adjusted by ADR-0035): no inline <script>, <style> or on*= in dist/,
// except one <script type="application/ld+json"> data block per content page (0 on the 404) that parses and holds
// no "<". findInlineCode is unchanged: checkJsonLd takes out only the admitted block before it scans.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { FIXTURES, VARIANTS } from './lib/build.mjs';
import { checkJsonLd } from './lib/jsonld.mjs';
import { copyBuild, mutateFile, removeBuild } from './lib/mutate.mjs';
import { distDir } from './lib/paths.mjs';
import { findInlineCode, listFiles } from './lib/scan.mjs';

async function scanDir(dir) {
  const html = (await listFiles(dir)).filter((f) => /.(html|svg)$/i.test(f));
  const hits = [];
  for (const file of html) {
    const rel = path.relative(dir, file).replaceAll('\\', '/');
    const expected = rel.endsWith('.html') && rel !== '404.html' ? 1 : 0;
    const { rest, problems } = checkJsonLd(await readFile(file, 'utf8'), expected);
    for (const hit of [...problems, ...findInlineCode(rest)]) hits.push(`${rel}: ${hit}`);
  }
  return { html, hits };
}

describe('scanner detects inline code', () => {
  const cases = {
    'inline script': '<p>a</p><script>alert(1)</script>',
    'uppercase script': '<SCRIPT >x()</SCRIPT>',
    'JSON-LD script': '<script type="application/ld+json">{}</script>',
    'style element': '<style>p{color:red}</style>',
    'style attribute': '<p style="color:red">x</p>',
    'event handler': '<img src="a.png" alt="" onerror="x()">',
    'event handler unquoted': '<body onload=x()>',
    'javascript: URL': '<a href="javascript:alert(1)">x</a>',
    'srcdoc attribute': '<div srcdoc="&lt;script&gt;x()&lt;/script&gt;"></div>',
    'iframe element': '<iframe src="/a.html" title="a"></iframe>',
    'object element': '<object data="/a.swf"></object>',
    'embed element': '<embed src="/a.swf">',
    'data: URL in href': '<a href="data:text/html,<b>x</b>">x</a>',
    'data: URL in src': '<img alt="" src="data:image/svg+xml,<svg/>">',
    'entity-encoded javascript: (decimal)': '<a href="&#106;avascript:alert(1)">x</a>',
    'entity-encoded javascript: (hex, no semicolon)': '<a href="&#x6A&#x61vascript:alert(1)">x</a>',
    'entity-encoded colon': '<a href="javascript&colon;alert(1)">x</a>',
    'javascript: with a tab': '<a href="java\tscript:alert(1)">x</a>',
    'javascript: with an entity tab and leading control char': '<a href="\u0001java&Tab;script:alert(1)">x</a>',
    'unquoted javascript: URL': '<a href=javascript:alert(1)>x</a>',
    'meta refresh': '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    'meta refresh in another casing': '<META HTTP-EQUIV=Refresh content="0">',
    'script inside SVG': '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
  };
  for (const [name, html] of Object.entries(cases)) {
    it(`flags ${name}`, () => {
      assert.ok(findInlineCode(html).length > 0, html);
    });
  }

  it('does not flag clean markup or text that mentions the words', () => {
    const html =
      '<img alt="Mapa" src="/_astro/a.webp"><a href="https://example.com/data:x">x</a><link rel="stylesheet" href="/_astro/a.css"><p data-online="1">script, style, onload= y onclick son palabras</p><a href="/contacto">Contacto</a><meta http-equiv="content-language" content="es">';
    assert.deepEqual(findInlineCode(html), []);
  });

  it('finds inline code in a built directory (temp fixture outside the repo)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'site-inline-'));
    try {
      await writeFile(
        path.join(dir, 'index.html'),
        '<html><head><script type="application/ld+json">{}</script></head><body onload="x()"></body></html>',
      );
      const { hits } = await scanDir(dir);
      assert.equal(hits.length, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('finds inline code in an SVG file of a built directory (item 6)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'site-inline-svg-'));
    try {
      await writeFile(path.join(dir, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>');
      const { hits } = await scanDir(dir);
      assert.equal(hits.length, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('dist/ has no inline code', () => {
  it('every HTML file is free of inline script, style and on*= (besides its one JSON-LD block)', async () => {
    const { html, hits } = await scanDir(distDir);
    assert.ok(html.length > 0, 'dist/ has no HTML: run `npm run build` first');
    assert.deepEqual(hits, []);
  });

  for (const [name, target] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
    it(`the ${name} build is free of inline code too`, async () => {
      const { html, hits } = await scanDir(target.out);
      assert.ok(html.length > 0, `${name} has no HTML: run npm test (pretest builds it)`);
      assert.deepEqual(hits, []);
    });
  }

  it('a built page with two JSON-LD blocks, a content page with none, a 404 with one: each flagged', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'site-inline-jsonld-'));
    try {
      const block = '<script type="application/ld+json">{}</script>';
      await writeFile(path.join(dir, 'index.html'), `<html><head>${block}${block}</head></html>`);
      await writeFile(path.join(dir, 'otra.html'), '<html><head></head></html>');
      await writeFile(path.join(dir, '404.html'), `<html><head>${block}</head></html>`);
      const { hits } = await scanDir(dir);
      assert.equal(hits.length, 3, hits.join('\n'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// FR-008 / AC-4 (US-12): a site that fails on purpose with ONE invented <meta http-equiv="refresh"> in dist/.
describe('site that fails on purpose: meta refresh', () => {
  it('a copy of dist/ with a meta refresh fails the inline-code scan, naming the page', async () => {
    const dir = await copyBuild(distDir);
    try {
      assert.deepEqual((await scanDir(dir)).hits, [], 'the healthy copy must pass first');
      await mutateFile(dir, 'index.html', (html) =>
        html.replace('</head>', '<meta http-equiv="refresh" content="0;url=https://invented.example/"></head>'),
      );
      const { hits } = await scanDir(dir);
      assert.equal(hits.length, 1, hits.join('\n'));
      assert.match(hits[0], /^index\.html: .*refresh/i);
    } finally {
      await removeBuild(dir);
    }
  });
});
