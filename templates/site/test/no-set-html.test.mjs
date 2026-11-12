// Rule (S2, ADR-0030 "Sin inyeccion" 1): set:html is forbidden in src/.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
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
  it('does not flag set:text', () => {
    assert.deepEqual(findSetHtml('<p set:text={x} />'), []);
  });
});

describe('src/ has no set:html', () => {
  it('no source file uses set:html', async () => {
    const files = await listFiles(srcDir);
    assert.ok(files.length > 0, 'src/ is empty');
    const hits = [];
    for (const file of files) {
      if (!/\.(astro|md|mdx|ts|tsx|js|jsx|mjs)$/.test(file)) continue;
      for (const hit of findSetHtml(await readFile(file, 'utf8'))) {
        hits.push(`${path.relative(srcDir, file)}: ${hit}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
