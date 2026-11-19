// Builds the template with another relevamiento.json (SITE_DATA) into another output dir (SITE_OUT), so the 3
// example variants and the test fixtures are real Astro builds of the same code. Builds run one at a time: Astro
// writes shared state (.astro/) while building. A fixture is a module whose default export is a relevamiento
// object; it is written as JSON next to its build output before building.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRelevamiento } from '../../src/lib/site.ts';
import { distDir } from './paths.mjs';
import { listFiles } from './scan.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const astroBin = path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');

/** Build outputs other than dist/ live outside the worktree; scripts/build-variants.mjs recreates them. */
export const variantsDir = path.join(tmpdir(), 'specmate-site-variants');

const example = (name) => path.join(root, 'src', 'data', 'examples', `${name}.relevamiento.json`);
const fixtureModule = (name) => path.join(root, 'test', 'fixtures', 'sites', `${name}.mjs`);

/** A fresh, mutable copy of an example relevamiento (`address`, `area` or `online`). */
export const readExample = (name) => JSON.parse(readFileSync(example(name), 'utf8'));

/** The validated Site of a relevamiento.json file. */
export const siteOf = (file) => loadRelevamiento(file, root);

/** The raw relevamiento of a build target, as written on disk. */
export const relevamientoOf = (target) => JSON.parse(readFileSync(target.data, 'utf8'));

/** The 3 example variants (AC-9): `address` is the default build in dist/. */
export const VARIANTS = {
  address: { data: example('address'), out: distDir },
  area: { data: example('area'), out: path.join(variantsDir, 'area') },
  online: { data: example('online'), out: path.join(variantsDir, 'online') },
};

const fixtureTarget = (name) => ({
  fixture: fixtureModule(name),
  data: path.join(variantsDir, `${name}.relevamiento.json`),
  out: path.join(variantsDir, name),
});

/**
 * Fixture builds that must succeed: adversarial text (US-11 AC-3), changed values (US-11 AC-4), a small business
 * with only WhatsApp (US-14 AC-6) and free sections, a logo and unconfirmed optional data (US-14 AC-2, AC-7).
 */
export const FIXTURES = {
  adversarial: fixtureTarget('adversarial'),
  changed: fixtureTarget('changed'),
  small: fixtureTarget('small'),
  content: fixtureTarget('content'),
};

/** Writes the relevamiento of fixture module `name` as JSON to `file` and returns `file`. */
export async function writeFixture(name, file) {
  const { default: data } = await import(pathToFileURL(fixtureModule(name)).href);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

/** A fixture written to a fresh temp dir, for builds that must fail: { data, out }. */
export async function fixtureData(name) {
  const dir = await mkdtemp(path.join(tmpdir(), `site-fixture-${name}-`));
  return { data: await writeFixture(name, path.join(dir, 'relevamiento.json')), out: path.join(dir, 'dist') };
}

/** Every HTML page of a build: [{ rel, html, content }]; `content` is false only for the 404 page. */
export async function readPages(dir) {
  const files = (await listFiles(dir)).filter((f) => f.endsWith('.html'));
  if (files.length === 0) throw new Error(`${dir} has no HTML: run \`npm test\` (pretest builds it)`);
  return Promise.all(
    files.map(async (file) => {
      const rel = path.relative(dir, file).replaceAll('\\', '/');
      return { rel, html: await readFile(file, 'utf8'), content: rel !== '404.html' };
    }),
  );
}

/** Runs `astro build` synchronously with SITE_DATA = `data` (a relevamiento.json); returns { status, output }. */
export function buildSite({ data, out }) {
  const result = spawnSync(process.execPath, [astroBin, 'build'], {
    cwd: root,
    env: { ...process.env, SITE_DATA: data, SITE_OUT: out, FORCE_COLOR: '0', NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
