// Rule (S2, ADR-0030 "Sin inyeccion" 1, narrowed by ADR-0036): set:html is forbidden in src/ except once, in
// components/JsonLd.astro, fed only by the serializer (allow-list cases in jsonld.test.mjs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checkSetHtml, JSON_LD_COMPONENT } from './lib/jsonld.mjs';
import { srcDir } from './lib/paths.mjs';
import { findSetHtml, listFiles } from './lib/scan.mjs';

const SOURCE_FILE = /.(astro|html|svelte|vue|md|mdx|ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

describe('source file filter', () => {
  for (const ext of ['astro', 'html', 'svelte', 'vue', 'md', 'mdx', 'ts']) {
    it(`scans .${ext} files`, () => {
      assert.ok(SOURCE_FILE.test(`page.${ext}`));
    });
  }
});

describe('scanner detects set:html', () => {
  it('flags set:html with any spacing', () => {
    assert.ok(findSetHtml('<div set:html={x} />').length > 0);
    assert.ok(findSetHtml('<Fragment set:html = {x}></Fragment>').length > 0);
  });
  it('flags the spread form', () => {
    assert.ok(findSetHtml("<div {...{ 'set:html': x }} />").length > 0);
    assert.ok(findSetHtml('<div {...{"set:html": x}} />').length > 0);
  });
  it('flags unescapeHTML', () => {
    assert.ok(findSetHtml("import { unescapeHTML } from 'astro/runtime/server/index.js';").length > 0);
  });
  // Security review: the same raw-HTML path without the words set:html (ADR-0036 bypasses).
  it('flags markHTMLString', () => {
    assert.ok(findSetHtml('const x = markHTMLString(data.raw);').length > 0);
  });
  it('flags HTMLString and HTMLBytes', () => {
    assert.ok(findSetHtml('const x = new HTMLString(raw);').length > 0);
    assert.ok(findSetHtml('const x = new HTMLBytes(bytes);').length > 0);
  });
  it('flags any import from astro/runtime/server', () => {
    assert.ok(findSetHtml("import * as rt from 'astro/runtime/server/index.js';").length > 0);
    assert.ok(findSetHtml('const rt = await import("astro/runtime/server");').length > 0);
  });
  it('flags a computed set: spread key', () => {
    assert.ok(findSetHtml("<div {...{ ['set:' + 'html']: x }} />").length > 0);
    // Built by concatenation so this test source holds no template placeholder of its own.
    assert.ok(findSetHtml(`<div {...{ [${'`'}set:$${'{kind}'}${'`'}]: x }} />`).length > 0);
    assert.ok(findSetHtml('<div {...{ [key]: x }} />').length > 0);
  });
  it('does not flag set:text', () => {
    assert.deepEqual(findSetHtml('<p set:text={x} />'), []);
  });
});

async function sources() {
  const files = await listFiles(srcDir);
  assert.ok(files.length > 0, 'src/ is empty');
  const out = [];
  for (const file of files) {
    if (!SOURCE_FILE.test(file)) continue;
    out.push({ rel: path.relative(srcDir, file).replaceAll('\\', '/'), text: await readFile(file, 'utf8') });
  }
  return out;
}

describe('src/ has no set:html outside the ADR-0036 allow-list', () => {
  it('no source file other than components/JsonLd.astro uses set:html (as before ADR-0036)', async () => {
    const hits = [];
    for (const { rel, text } of await sources()) {
      if (rel === JSON_LD_COMPONENT) continue;
      for (const hit of findSetHtml(text)) hits.push(`${rel}: ${hit}`);
    }
    assert.deepEqual(hits, []);
  });

  it('components/JsonLd.astro uses it once, only with the serializer output', async () => {
    const all = await sources();
    assert.ok(
      all.some((s) => s.rel === JSON_LD_COMPONENT),
      `${JSON_LD_COMPONENT} not found`,
    );
    assert.deepEqual(checkSetHtml(all), []);
  });
});
