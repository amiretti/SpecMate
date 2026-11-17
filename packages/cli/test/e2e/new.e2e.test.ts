// Rule (US-13 AC-2, AC-3; plan decision 7): inside a repo created by `specmate new`, `npm ci`, `npm run build` and
// `npm test` all exit 0, the template's suite reports at least 513 tests and 0 failed, and the built home page shows
// the invented-example notice. Takes minutes and needs network and the Playwright browsers: `npm run test:e2e`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const entry = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));
const MIN_TEMPLATE_TESTS = 513;

// npm through node itself (no shell): npm-cli.js next to the running node.
function npmCli(): string {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const found = candidates.find((c) => c?.endsWith('.js') && existsSync(c));
  if (!found) throw new Error('npm-cli.js not found next to node');
  return found;
}

function run(args: string[], cwd: string) {
  const started = Date.now();
  const res = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  console.log(`$ ${args.slice(1).join(' ')} -> exit ${res.status} (${Math.round((Date.now() - started) / 1000)} s)`);
  return { status: res.status, output };
}

let work: string;
let repo: string;
beforeAll(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-e2e-'));
  repo = path.join(work, 'panaderia-ejemplo');
  const created = run([entry, 'new', 'panaderia-ejemplo'], work);
  expect(created.status, created.output).toBe(0);
});
afterAll(async () => {
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
});

describe('a repo created by specmate new', () => {
  it('installs, builds and passes its own suite (AC-2), and shows the example notice (AC-3)', async () => {
    const npm = npmCli();
    const ci = run([npm, 'ci'], repo);
    expect(ci.status, ci.output.slice(-3000)).toBe(0);

    const build = run([npm, 'run', 'build'], repo);
    expect(build.status, build.output.slice(-3000)).toBe(0);
    const home = await readFile(path.join(repo, 'dist', 'index.html'), 'utf8');
    expect(home).toContain('Sitio de ejemplo de la plantilla: el negocio y sus datos son ficticios.');

    const test = run([npm, 'test'], repo);
    const tests = Number(/ℹ tests (\d+)/.exec(test.output)?.[1] ?? 0);
    const failed = Number(/ℹ fail (\d+)/.exec(test.output)?.[1] ?? -1);
    console.log(`template suite in the created repo: ${tests} tests, ${failed} failed`);
    expect(test.status, test.output.slice(-4000)).toBe(0);
    expect(failed).toBe(0);
    expect(tests).toBeGreaterThanOrEqual(MIN_TEMPLATE_TESTS);
  });
});
