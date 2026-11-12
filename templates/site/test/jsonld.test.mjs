// Rules (FR-002, AC-3, ADR-0035 "JSON-LD", ADR-0036): JSON-LD comes only from the template's escaping serializer,
// through one component; each content page carries exactly 1 block that parses, holds no "<" and reproduces the
// data without loss; 2 blocks, another type or an extra <script> fail the "Sin inyección" control.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { serializeJsonLd } from '../src/lib/jsonld.ts';
import { ADVERSARIAL } from './fixtures/sites/adversarial.mjs';
import { FIXTURES, readPages, VARIANTS } from './lib/build.mjs';
import { titles } from './lib/html.mjs';
import { checkJsonLd, checkSetHtml, splitJsonLd } from './lib/jsonld.mjs';
import { srcDir } from './lib/paths.mjs';
import { findInlineCode, listFiles } from './lib/scan.mjs';

const HOSTILE = ['</script>', '<script>alert(1)</script>', '<!--', '&', '"', '\\', ' ', '</SCRIPT >', '-->'];

describe('serializeJsonLd', () => {
  for (const value of HOSTILE) {
    it(`escapes ${JSON.stringify(value)} and round-trips it`, () => {
      const out = serializeJsonLd({ name: value, list: [value] });
      assert.doesNotMatch(out, /[<>&]/);
      assert.deepEqual(JSON.parse(out), { name: value, list: [value] });
    });
  }
  it('escapes as \\u003c, \\u003e and \\u0026', () => {
    assert.equal(serializeJsonLd({ a: '<>&' }), '{"a":"\\u003c\\u003e\\u0026"}');
  });
  it('escapes keys too', () => {
    assert.doesNotMatch(serializeJsonLd({ '</script>': 1 }), /</);
  });
});

describe('JSON-LD block control', () => {
  const block = (json = '{"@context":"https://schema.org"}') => `<script type="application/ld+json">${json}</script>`;
  const page = (head) => `<html><head>${head}</head><body><p>x</p></body></html>`;
  const verdict = (html, expected = 1) => {
    const { rest, problems } = checkJsonLd(html, expected);
    return [...problems, ...findInlineCode(rest)];
  };

  it('accepts exactly one well-formed block', () => {
    assert.deepEqual(verdict(page(block())), []);
  });
  it('accepts a page with no block where none is expected (404)', () => {
    assert.deepEqual(verdict(page(''), 0), []);
  });
  const rejected = {
    'two blocks': page(`${block()}${block()}`),
    'no block on a content page': page(''),
    'a block on a page that expects none': [page(block()), 0],
    'another type': page('<script type="application/json">{}</script>'),
    'a type with different case': page('<script type="Application/LD+JSON">{}</script>'),
    'a block with an extra attribute': page('<script type="application/ld+json" src="/x.js">{}</script>'),
    'a block with a src only': page('<script src="/x.js"></script>'),
    'an extra inline <script>': page(`${block()}<script>alert(1)</script>`),
    'an extra <script> after a valid block in the body': page(block()).replace(
      '</body>',
      '<script>x()</script></body>',
    ),
    '</script> breaking out of the block': page(block('{"a":"</script><script>alert(1)</script>"}')),
    '<!-- inside the block': page(block('{"a":"<!--"}')),
    'invalid JSON': page(block('{a:1}')),
    'an unclosed block': page('<script type="application/ld+json">{}'),
    'an inline handler next to a valid block': page(block()).replace('<p>', '<p onclick="x()">'),
    'a style element next to a valid block': page(`${block()}<style>p{}</style>`),
  };
  for (const [name, value] of Object.entries(rejected)) {
    const [html, expected] = Array.isArray(value) ? value : [value, 1];
    it(`rejects ${name}`, () => {
      assert.ok(verdict(html, expected).length > 0, html);
    });
  }
  it('splitJsonLd returns the parsed block and leaves the rest of the page', () => {
    const { blocks, rest } = splitJsonLd(page(block('{"a":"\\u003c"}')));
    assert.deepEqual(blocks, [{ a: '<' }]);
    assert.equal(rest, page(''));
  });
});

describe('set:html allow-list (ADR-0036)', () => {
  const ok =
    'import { serializeJsonLd } from \'../lib/jsonld.ts\';\n<script type="application/ld+json" set:html={serializeJsonLd(data)} />';
  const component = (text) => ({ rel: 'components/JsonLd.astro', text });
  it('accepts the single allowed use', () => {
    assert.deepEqual(checkSetHtml([component(ok)]), []);
  });
  const rejected = {
    'set:html in another file': [component(ok), { rel: 'pages/index.astro', text: '<div set:html={x} />' }],
    'spread set:html in another file': [{ rel: 'layouts/Base.astro', text: "<div {...{ 'set:html': x }} />" }],
    'unescapeHTML in another file': [{ rel: 'lib/x.ts', text: 'unescapeHTML(x)' }],
    'another expression in the component': [component(ok.replace('serializeJsonLd(data)', 'data.raw'))],
    'serializer output concatenated with text': [
      component(ok.replace('serializeJsonLd(data)}', 'serializeJsonLd(data) + x}')),
    ],
    'a second set:html in the component': [component(`${ok}\n<div set:html={x} />`)],
    'unescapeHTML in the component': [component(`${ok}\nunescapeHTML(x)`)],
    'a local stand-in for the serializer': [component(`${ok}\nconst serializeJsonLd = (x) => x;`)],
    'no import of the serializer': [component(ok.replace("from '../lib/jsonld.ts'", "from './fake.ts'"))],
    'markHTMLString in another file': [{ rel: 'pages/index.astro', text: '{markHTMLString(x)}' }],
    'new HTMLString in another file': [{ rel: 'layouts/Base.astro', text: '{new HTMLString(x)}' }],
    'a computed set: key in another file': [{ rel: 'pages/index.astro', text: "<p {...{ ['set:' + 'html']: x }} />" }],
    'markHTMLString in the component': [
      component(`${ok}
{markHTMLString(x)}`),
    ],
    'an astro/runtime/server import in the component': [
      component(`${ok}
import { HTMLBytes } from 'astro/runtime/server/index.js';`),
    ],
  };
  for (const [name, files] of Object.entries(rejected)) {
    it(`rejects ${name}`, () => {
      assert.ok(checkSetHtml(files).length > 0);
    });
  }
});

describe('source code', () => {
  it('application/ld+json appears in exactly 1 source file: components/JsonLd.astro', async () => {
    const hits = [];
    for (const file of await listFiles(srcDir)) {
      if ((await readFile(file, 'utf8')).includes('application/ld+json')) {
        hits.push(path.relative(srcDir, file).replaceAll('\\', '/'));
      }
    }
    assert.deepEqual(hits, ['components/JsonLd.astro']);
  });
});

describe('built pages carry exactly the admitted JSON-LD', () => {
  for (const [name, target] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
    it(`${name}: 1 valid block per content page, 0 elsewhere, nothing else inline`, async () => {
      const pages = await readPages(target.out);
      assert.ok(pages.some((p) => p.content));
      for (const { rel, html, content } of pages) {
        const { rest, problems } = checkJsonLd(html, content ? 1 : 0);
        assert.deepEqual(problems, [], rel);
        assert.deepEqual(findInlineCode(rest), [], rel);
      }
    });
  }

  it('adversarial: the block holds the hostile text intact and the visible HTML escapes it', async () => {
    const pages = await readPages(FIXTURES.adversarial.out);
    const index = pages.find((p) => p.rel === 'index.html');
    assert.ok(index);
    const [graph] = splitJsonLd(index.html).blocks;
    const nodes = graph['@graph'];
    const business = nodes.find((n) => n['@type'] === 'LocalBusiness');
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    assert.equal(business.name, ADVERSARIAL.name);
    assert.equal(business.description, ADVERSARIAL.tagline);
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, ADVERSARIAL.answer);
    assert.ok(index.html.includes('Horno &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
    // Inside quoted attribute values (og:title, alt) a raw "<" is inert text; as a tag it must never appear.
    assert.deepEqual(findInlineCode(splitJsonLd(index.html).rest), [], 'no <script> element besides the JSON-LD');
    assert.equal(titles(index.html)[0], ADVERSARIAL.name);
  });
});
