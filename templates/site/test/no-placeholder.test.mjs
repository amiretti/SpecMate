// Rule (S5, ADR-0030 "Sin texto de relleno"): no lorem, [TU ...], TODO or XXX in dist/.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { distDir } from './lib/paths.mjs';
import { findPlaceholders, listFiles } from './lib/scan.mjs';

const TEXT_FILE = /\.(html|css|xml|txt|json|svg|js|webmanifest)$/;

describe('placeholder finder', () => {
  for (const text of ['Lorem ipsum dolor', 'Llamá a [TU TELÉFONO]', '[tu nombre]', 'TODO: precios', 'Tel XXX-1234']) {
    it(`flags "${text}"`, () => {
      assert.ok(findPlaceholders(text).length > 0, text);
    });
  }
  it('does not flag ordinary Spanish words', () => {
    assert.deepEqual(findPlaceholders('Abrimos todos los días; todo fresco. Tu pedido, listo.'), []);
  });
});

describe('dist/ has no placeholder text', () => {
  it('no text file contains placeholders', async () => {
    const files = (await listFiles(distDir)).filter((f) => TEXT_FILE.test(f));
    assert.ok(files.length > 0, 'dist/ is empty: run `npm run build` first');
    const hits = [];
    for (const file of files) {
      for (const hit of findPlaceholders(await readFile(file, 'utf8'))) {
        hits.push(`${path.relative(distDir, file)}: ${hit}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
