// Builds the template with another data module (SITE_DATA) into another output dir (SITE_OUT), so the 3 example
// variants and the test fixtures are real Astro builds of the same code. Builds run one at a time: Astro writes
// shared state (.astro/) while building.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { distDir } from './paths.mjs';
import { listFiles } from './scan.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const astroBin = path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');

/** Build outputs other than dist/ live outside the worktree; scripts/build-variants.mjs recreates them. */
export const variantsDir = path.join(tmpdir(), 'specmate-site-variants');

const example = (name) => path.join(root, 'src', 'data', 'examples', `${name}.ts`);
const fixture = (name) => path.join(root, 'test', 'fixtures', 'sites', `${name}.mjs`);

/** The 3 example variants (AC-2): `address` is the default build in dist/. */
export const VARIANTS = {
  address: { data: example('address'), out: distDir },
  area: { data: example('area'), out: path.join(variantsDir, 'area') },
  online: { data: example('online'), out: path.join(variantsDir, 'online') },
};

/** Fixture builds that must succeed (AC-3 adversarial text, AC-4 changed values). */
export const FIXTURES = {
  adversarial: { data: fixture('adversarial'), out: path.join(variantsDir, 'adversarial') },
  changed: { data: fixture('changed'), out: path.join(variantsDir, 'changed') },
};

export const fixtureData = fixture;

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

/** Runs `astro build` synchronously; returns { status, output }. */
export function buildSite({ data, out }) {
  const result = spawnSync(process.execPath, [astroBin, 'build'], {
    cwd: root,
    env: { ...process.env, SITE_DATA: data, SITE_OUT: out, FORCE_COLOR: '0', NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
