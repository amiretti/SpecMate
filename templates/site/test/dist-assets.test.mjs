// Rule (US-14 FR-003, FR-008, constitution XI; security review of US-14): only images the site shows reach dist/.
// Every image file in a build is referenced by its HTML or CSS; without a logo, or with an unconfirmed one, no logo
// file is emitted at all (an unconfirmed datum must not be published, not even as an unreferenced file). A raster
// logo (PNG, JPEG) is published only as AVIF and WebP, each <= 250 KB, in a <picture> with its alt; never the original.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { CONTENT } from './fixtures/sites/content.mjs';
import { buildSite, FIXTURES, readExample, readPages, VARIANTS } from './lib/build.mjs';
import { tags } from './lib/html.mjs';
import { listFiles } from './lib/scan.mjs';

const IMAGE = /\.(svg|png|jpe?g|webp|avif|gif)$/i;
// Published logo names (src/lib/logo.ts) and the source names, which must never be copied as they are.
const LOGO_NAMES = [
  'logo-light',
  'logo-dark',
  ...[CONTENT.logo.light, CONTENT.logo.dark].map((p) => path.posix.basename(p, '.svg')),
  'logo-ejemplo-claro',
  'logo-ejemplo-oscuro',
];
// Invented raster logos committed for these tests (src/assets/brand/logo-ejemplo-*): not a client's.
const RASTER = { png: 'src/assets/brand/logo-ejemplo-claro.png', jpeg: 'src/assets/brand/logo-ejemplo-oscuro.jpg' };
const MAX_BYTES = 250 * 1000;

/** Builds the address example with `logo` into a temp dir; returns the dir (dist/ inside). */
async function buildWithLogo(logo) {
  const dir = await mkdtemp(path.join(tmpdir(), 'site-logo-'));
  const data = readExample('address');
  data.brief.logo = logo;
  await writeFile(path.join(dir, 'relevamiento.json'), JSON.stringify(data));
  const { status, output } = buildSite({ data: path.join(dir, 'relevamiento.json'), out: path.join(dir, 'dist') });
  assert.equal(status, 0, output.slice(-1500));
  return dir;
}

/** Image files of the build that no HTML or CSS file of it mentions. */
async function unreferencedImages(dir) {
  const files = await listFiles(dir);
  const images = files.filter((f) => IMAGE.test(f));
  const texts = await Promise.all(files.filter((f) => /\.(html|css)$/.test(f)).map((f) => readFile(f, 'utf8')));
  const all = texts.join('\n');
  return images.map((f) => path.basename(f)).filter((name) => !all.includes(name));
}

const logoFiles = async (dir) =>
  (await listFiles(dir)).filter((f) => LOGO_NAMES.some((name) => path.basename(f).startsWith(`${name}.`)));

describe('dist/ holds only the images the site shows', () => {
  for (const [name, { out }] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
    it(`${name}: every image file is referenced by the HTML or CSS`, async () => {
      assert.deepEqual(await unreferencedImages(out), []);
    });
  }

  it('no logo -> 0 logo files in dist', async () => {
    assert.deepEqual(await logoFiles(FIXTURES.small.out), []);
    assert.deepEqual(await logoFiles(VARIANTS.address.out), []);
  });

  it('a confirmed logo -> its files are in dist (the check above can see them)', async () => {
    // The fixture's light and dark logos are SVG: each published as AVIF and WebP, never as SVG.
    const exts = (await logoFiles(FIXTURES.content.out)).map((f) => path.extname(f)).sort();
    assert.deepEqual(exts, ['.avif', '.avif', '.webp', '.webp']);
  });

  describe('unconfirmed logo', { concurrency: false }, () => {
    let dir;
    before(async () => {
      dir = await mkdtemp(path.join(tmpdir(), 'site-unconfirmed-logo-'));
      const data = readExample('address');
      data.brief.logo = { ...CONTENT.logo, source: 'fixture: borrador' };
      await writeFile(path.join(dir, 'relevamiento.json'), JSON.stringify(data));
      const { status, output } = buildSite({ data: path.join(dir, 'relevamiento.json'), out: path.join(dir, 'dist') });
      assert.equal(status, 0, output.slice(-1500));
    });
    after(() => rm(dir, { recursive: true, force: true }));

    it('-> 0 logo files in dist and no unreferenced image', async () => {
      const out = path.join(dir, 'dist');
      assert.deepEqual(await logoFiles(out), []);
      assert.deepEqual(await unreferencedImages(out), []);
    });
  });

  describe('raster logos are published only as AVIF and WebP (US-14, developer 2026-11-20)', {
    concurrency: false,
  }, () => {
    const dirs = {};
    const confirmed = (light) => ({
      light,
      alt: 'Logo inventado',
      source: 'fixture',
      confirmedBy: 'fixture: inventado, 2026-01-01',
    });
    before(async () => {
      dirs.png = await buildWithLogo(confirmed(RASTER.png));
      dirs.jpeg = await buildWithLogo(confirmed(RASTER.jpeg));
      dirs.unconfirmed = await buildWithLogo({ ...confirmed(RASTER.png), confirmedBy: undefined });
    });
    after(async () => {
      for (const dir of Object.values(dirs)) await rm(dir, { recursive: true, force: true });
    });

    for (const format of ['png', 'jpeg']) {
      it(`a ${format.toUpperCase()} logo -> AVIF and WebP in dist, not the original, each <= 250 KB, in a <picture> with alt`, async () => {
        const out = path.join(dirs[format], 'dist');
        const files = await logoFiles(out);
        const exts = files.map((f) => path.extname(f)).sort();
        assert.deepEqual(exts, ['.avif', '.webp'], files.join(', '));
        for (const f of files) assert.ok((await stat(f)).size <= MAX_BYTES, `${f} > 250 KB`);
        assert.deepEqual(await unreferencedImages(out), []);
        const html = (await readPages(out)).find((p) => p.rel === 'index.html').html;
        const picture = html.match(/<picture\b[^>]*class="brand-logo"[\s\S]*?<\/picture>/)?.[0] ?? '';
        const sources = tags(picture, 'source');
        assert.deepEqual(
          sources.map((s) => s.type),
          ['image/avif', 'image/webp'],
        );
        assert.match(sources[0].srcset, /^\/brand\/logo-light\.[0-9a-f]{8}\.avif$/);
        const img = tags(picture, 'img')[0];
        assert.equal(img.src, sources[1].srcset, 'the WebP is the <img> fallback');
        assert.equal(img.alt, 'Logo inventado');
        assert.ok(Number(img.width) > 0 && Number(img.height) > 0, 'width and height');
      });
    }

    it('an unconfirmed raster logo -> 0 logo files in dist', async () => {
      const out = path.join(dirs.unconfirmed, 'dist');
      assert.deepEqual(await logoFiles(out), []);
      assert.deepEqual(await unreferencedImages(out), []);
    });
  });
});
