// Rule (US-13 AC-1, AC-4, AC-5, AC-6, AC-9; FR-001 to FR-007, FR-010): `specmate new <slug>` run as a real process
// (node strips the TypeScript types) in temp dirs outside the worktree, with the real template and the real git.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
const IDENTITY = {
  GIT_AUTHOR_NAME: 'SpecMate test',
  GIT_AUTHOR_EMAIL: 'test@specmate.invalid',
  GIT_COMMITTER_NAME: 'SpecMate test',
  GIT_COMMITTER_EMAIL: 'test@specmate.invalid',
};

function specmate(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) {
  const res = spawnSync(process.execPath, [entry, ...args], { cwd, env: { ...env, ...IDENTITY }, encoding: 'utf8' });
  return { status: res.status, out: res.stdout, err: res.stderr };
}

const gitOut = (cwd: string, ...args: string[]) =>
  spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...IDENTITY } }).stdout.trim();

async function treeHash(dir: string): Promise<string> {
  const hash = createHash('sha256');
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries.map((x) => path.join(x.parentPath, x.name)).sort()) {
    hash.update(path.relative(dir, e));
    try {
      hash.update(await readFile(e));
    } catch {
      hash.update('<dir>');
    }
  }
  return hash.digest('hex');
}

let work: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-new-'));
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('specmate new <slug>', () => {
  it('creates a git repo with one commit, the template without artifacts, and the slug as package name (AC-1)', async () => {
    const res = specmate(['new', 'panaderia-ejemplo'], work);
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    const repo = path.join(work, 'panaderia-ejemplo');
    expect(res.out).toContain(repo);

    const top = await readdir(repo);
    for (const artifact of ['node_modules', 'dist', '.astro', '.wrangler']) expect(top).not.toContain(artifact);
    for (const expected of ['package.json', 'package-lock.json', 'src', 'test', 'vendor', '.gitattributes', '.git']) {
      expect(top).toContain(expected);
    }
    expect(JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8')).name).toBe('panaderia-ejemplo');
    const lock = JSON.parse(await readFile(path.join(repo, 'package-lock.json'), 'utf8'));
    expect([lock.name, lock.packages[''].name]).toEqual(['panaderia-ejemplo', 'panaderia-ejemplo']);

    expect(gitOut(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect(gitOut(repo, 'status', '--porcelain')).toBe('');
    expect(gitOut(repo, 'branch', '--show-current')).toBe('main');
    // Nothing else is left next to the repo (no staging dir).
    expect(await readdir(work)).toEqual(['panaderia-ejemplo']);
  });

  it('copies exactly the files committed in the template, minus build artifacts (#53)', async () => {
    expect(specmate(['new', 'solo-versionados'], work).status).toBe(0);
    const repo = path.join(work, 'solo-versionados');
    const template = fileURLToPath(new URL('../../../templates/site/', import.meta.url));
    const artifacts = new Set(['node_modules', 'dist', '.astro', '.wrangler']);
    const expected = gitOut(template, 'ls-tree', '-r', '--name-only', 'HEAD')
      .split('\n')
      .filter((f) => f && !artifacts.has(f.split('/')[0] ?? ''))
      .sort();
    const onDisk = (await readdir(repo, { recursive: true, withFileTypes: true }))
      .filter((e) => e.isFile())
      .map((e) => path.relative(repo, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
      .filter((f) => !f.startsWith('.git/'))
      .sort();
    expect(onDisk).toEqual(expected);
    expect(gitOut(repo, 'ls-files').split('\n').sort()).toEqual(expected);
  });

  it('leaves the relevamiento.json of the invented address example at the root, marked as such (FR-003, US-14 AC-11)', async () => {
    expect(specmate(['new', 'ejemplo'], work).status).toBe(0);
    const data = JSON.parse(await readFile(path.join(work, 'ejemplo', 'relevamiento.json'), 'utf8'));
    expect(data.$comment).toMatch(/FICTITIOUS/);
    expect(data.brief.exampleNotice).toBe('Sitio de ejemplo de la plantilla: el negocio y sus datos son ficticios.');
    expect(data.brief.site.url).toBe('https://horno-azul.example');
    expect(data.brief.address).toBeDefined();
  });

  it.each(['Mayus', '-guion', 'guion-', 'con espacio', 'ñandu', 'a'.repeat(64)])(
    'rejects the slug %j without creating anything (AC-4)',
    async (slug) => {
      const res = specmate(['new', slug], work);
      // "-guion" reaches the parser as an option: usage error (2), whose text also names the format.
      expect(res.status).not.toBe(0);
      expect(res.err).toMatch(/lowercase letters, digits and hyphens/);
      expect(await readdir(work)).toEqual([]);
    },
  );

  it.each([
    ['empty', async (dir: string) => mkdir(dir)],
    [
      'with files',
      async (dir: string) => {
        await mkdir(path.join(dir, 'sub'), { recursive: true });
        await writeFile(path.join(dir, 'keep.txt'), 'do not touch');
        await writeFile(path.join(dir, 'sub', 'b.bin'), Buffer.from([0, 1, 2]));
      },
    ],
  ])('fails on an existing %s target and leaves it byte for byte (AC-5)', async (_name, prepare) => {
    const target = path.join(work, 'ocupado');
    await prepare(target);
    const before = await treeHash(target);
    const res = specmate(['new', 'ocupado'], work);
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/ocupado already exists/);
    expect(await treeHash(target)).toBe(before);
    expect(await readdir(work)).toEqual(['ocupado']);
  });

  it('without git, fails naming git and leaves no folder behind (AC-6)', async () => {
    const empty = path.join(work, 'no-git-bin');
    await mkdir(empty);
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH'));
    const res = specmate(['new', 'sin-git'], work, { ...env, PATH: empty });
    expect(res.status).toBe(1);
    expect(res.err).toMatch(/git is not installed or not in PATH/);
    expect(await readdir(work)).toEqual(['no-git-bin']);
  });

  it('works from a folder with spaces and accents (AC-9)', async () => {
    const odd = path.join(work, 'José Pérez sitios');
    await mkdir(odd);
    const res = specmate(['new', 'cliente-uno'], odd);
    expect(res.status).toBe(0);
    expect(gitOut(path.join(odd, 'cliente-uno'), 'rev-list', '--count', 'HEAD')).toBe('1');
  });

  it.each([[[]], [['new']], [['new', 'a', 'b']], [['borrar', 'a']], [['new', '--force', 'a']]])(
    'wrong usage %j exits 2 with the usage text',
    (args) => {
      const res = specmate(args, work);
      expect(res.status).toBe(2);
      expect(res.err).toContain('Usage: specmate new <slug>');
    },
  );
});
