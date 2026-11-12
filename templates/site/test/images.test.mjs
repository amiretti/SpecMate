// Rule (S5, ADR-0030 "Imagenes"): every image in dist/ <= 250 KB, every <img> has alt.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { distDir } from './lib/paths.mjs';
import { findImagesWithoutAlt, listFiles } from './lib/scan.mjs';

const MAX_BYTES = 250 * 1000;
const IMAGE_FILE = /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i;

describe('alt finder', () => {
  it('flags an <img> without alt', () => {
    assert.equal(findImagesWithoutAlt('<img src="a.webp" width="1" height="1">').length, 1);
  });
  it('flags data-alt or title as no alt', () => {
    assert.equal(findImagesWithoutAlt('<img src="a.webp" data-alt="x" title="x">').length, 1);
  });
  it('accepts alt text and explicit empty alt', () => {
    assert.deepEqual(findImagesWithoutAlt('<img src="a.webp" alt="Pan"><IMG alt="" src="b.webp">'), []);
  });
});

describe('dist/ images', () => {
  it('each image file is at most 250 KB', async () => {
    const images = (await listFiles(distDir)).filter((f) => IMAGE_FILE.test(f));
    assert.ok(images.length > 0, 'dist/ has no images: run `npm run build` first');
    const heavy = [];
    for (const file of images) {
      const { size } = await stat(file);
      if (size > MAX_BYTES) heavy.push(`${path.relative(distDir, file)}: ${size} B`);
    }
    assert.deepEqual(heavy, []);
  });

  it('every <img> in HTML has an alt attribute', async () => {
    const html = (await listFiles(distDir)).filter((f) => f.endsWith('.html'));
    let imgCount = 0;
    const missing = [];
    for (const file of html) {
      const text = await readFile(file, 'utf8');
      imgCount += (text.match(/<img\b/gi) ?? []).length;
      for (const tag of findImagesWithoutAlt(text)) missing.push(`${path.relative(distDir, file)}: ${tag}`);
    }
    assert.ok(imgCount > 0, 'no <img> found in dist/');
    assert.deepEqual(missing, []);
  });
});
