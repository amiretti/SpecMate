// Rule (US-14 FR-003, FR-008, constitution XI; security review of US-14): only images the site shows reach dist/.
// Every image file in a build is referenced by its HTML or CSS; without a logo, or with an unconfirmed one, no logo
// file is emitted at all (an unconfirmed datum must not be published, not even as an unreferenced file).
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { CONTENT } from './fixtures/sites/content.mjs';
import { buildSite, FIXTURES, readExample, VARIANTS } from './lib/build.mjs';
import { listFiles } from './lib/scan.mjs';

const IMAGE = /\.(svg|png|jpe?g|webp|avif|gif)$/i;
// Published logo names (src/lib/logo.ts) and the source names, which must never be copied as they are.
const LOGO_NAMES = [
  'logo-light',
  'logo-dark',
  ...[CONTENT.logo.light, CONTENT.logo.dark].map((p) => path.posix.basename(p, '.svg')),
];

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
    assert.equal((await logoFiles(FIXTURES.content.out)).length, 2);
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
});
