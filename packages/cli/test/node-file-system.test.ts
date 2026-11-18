// Rule (US-13 FR-005, plan decision 2): publishing never replaces a target that appeared after the first check.
// rename() silently replaces an EMPTY directory on POSIX, so the adapter checks again and maps the error.
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TargetExistsError } from '../src/application/create-client-repo.ts';
import { nodeFileSystem } from '../src/infrastructure/node-file-system.ts';

let work: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-fs-'));
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('nodeFileSystem.publish', () => {
  it.each([
    ['an empty', async (_dir: string) => undefined],
    ['a non-empty', async (dir: string) => writeFile(path.join(dir, 'keep.txt'), 'x')],
  ])('refuses %s target that appeared meanwhile, keeping both dirs', async (_name, fill) => {
    const target = path.join(work, 'cliente');
    const staging = await nodeFileSystem.createStaging(target);
    await writeFile(path.join(staging, 'package.json'), '{}');
    await mkdir(target);
    await fill(target);
    await expect(nodeFileSystem.publish(staging, target)).rejects.toThrow(TargetExistsError);
    expect(await readdir(staging)).toEqual(['package.json']);
  });

  it('creates the staging dir next to the target, hidden and unique', async () => {
    const target = path.join(work, 'cliente');
    const a = await nodeFileSystem.createStaging(target);
    const b = await nodeFileSystem.createStaging(target);
    expect(path.dirname(a)).toBe(work);
    expect(path.basename(a)).toMatch(/^\.cliente\.tmp-/);
    expect(a).not.toBe(b);
  });
});

describe('nodeFileSystem.copyTemplate', () => {
  it('copies exactly the listed files, creating their folders, and nothing else (#53)', async () => {
    const from = path.join(work, 'site');
    await mkdir(path.join(from, 'src', 'pages'), { recursive: true });
    await writeFile(path.join(from, 'package.json'), '{"name":"site"}');
    await writeFile(path.join(from, 'src', 'pages', 'index.astro'), '<h1>x</h1>');
    await writeFile(path.join(from, '.env'), 'SECRET=1');
    const to = await nodeFileSystem.createStaging(path.join(work, 'cliente'));

    await nodeFileSystem.copyTemplate(from, to, ['package.json', 'src/pages/index.astro']);

    const copied = (await readdir(to, { recursive: true, withFileTypes: true }))
      .filter((e) => e.isFile())
      .map((e) => path.relative(to, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
      .sort();
    expect(copied).toEqual(['package.json', 'src/pages/index.astro']);
    expect(await readFile(path.join(to, 'src', 'pages', 'index.astro'), 'utf8')).toBe('<h1>x</h1>');
  });
});
