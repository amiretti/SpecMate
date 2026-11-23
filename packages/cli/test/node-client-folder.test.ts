// Rule (US-15 FR-008, FR-009, FR-011, AC-9, AC-12): the walk lists files with their size, sorted, never follows a link
// or a junction (inside or outside the folder), skips the folders it is told to, and changes nothing on disk.
// The folders are invented clients in the system temp dir.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FolderEntry } from '../src/application/ports.ts';
import { SpecmateError } from '../src/domain/errors.ts';
import { nodeClientFolder } from '../src/infrastructure/node-client-folder.ts';

const canSymlinkFiles = (() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'specmate-link-'));
  try {
    symlinkSync('target', path.join(dir, 'link'), 'file');
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

let work: string;
let client: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-client-'));
  client = path.join(work, 'cliente-inventado');
  await mkdir(path.join(client, 'fotos', 'local'), { recursive: true });
  await mkdir(path.join(client, '.git'));
  await writeFile(path.join(client, 'logo.png'), 'not really a png');
  await writeFile(path.join(client, 'fotos', 'vidriera.jpg'), 'x'.repeat(10));
  await writeFile(path.join(client, 'fotos', 'local', 'frente.jpg'), 'yy');
  await writeFile(path.join(client, '.git', 'HEAD'), 'ref');
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

const walkAll = async (root: string, skip = (name: string) => name === '.git') => {
  const entries: FolderEntry[] = [];
  for await (const entry of nodeClientFolder.walk(root, skip)) entries.push(entry);
  return entries;
};

async function hashTree(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    out[path.relative(dir, file)] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }
  return out;
}

describe('nodeClientFolder.walk', () => {
  it('lists folders and files depth first, sorted, with size and depth, skipping what it is told to', async () => {
    expect(await walkAll(client)).toEqual([
      { type: 'skipped', path: '.git', depth: 1 },
      { type: 'directory', path: 'fotos', depth: 1 },
      { type: 'directory', path: 'fotos/local', depth: 2 },
      { type: 'file', path: 'fotos/local/frente.jpg', depth: 3, size: 2 },
      { type: 'file', path: 'fotos/vidriera.jpg', depth: 2, size: 10 },
      { type: 'file', path: 'logo.png', depth: 1, size: 16 },
    ]);
  });

  it('does not follow a junction that points outside the folder (AC-9)', async () => {
    const outside = path.join(work, 'afuera');
    await mkdir(outside);
    await writeFile(path.join(outside, 'secreto.txt'), 'no');
    await symlink(outside, path.join(client, 'atajo'), 'junction');
    const entries = await walkAll(client);
    expect(entries).toContainEqual({ type: 'link', path: 'atajo', depth: 1 });
    expect(entries.map((e) => e.path).filter((p) => p.startsWith('atajo/'))).toEqual([]);
  });

  it('does not follow a junction that points inside the folder either', async () => {
    await symlink(path.join(client, 'fotos'), path.join(client, 'otra-vez'), 'junction');
    const entries = await walkAll(client);
    expect(entries).toContainEqual({ type: 'link', path: 'otra-vez', depth: 1 });
    expect(entries.filter((e) => e.path.startsWith('otra-vez/'))).toEqual([]);
  });

  it.skipIf(!canSymlinkFiles)('lists a file symlink as a link, not as its target', async () => {
    await symlink(path.join(client, 'logo.png'), path.join(client, 'logo-link.png'), 'file');
    expect(await walkAll(client)).toContainEqual({ type: 'link', path: 'logo-link.png', depth: 1 });
  });

  it('stopping the iteration stops the walk', async () => {
    const seen: string[] = [];
    for await (const entry of nodeClientFolder.walk(client, () => false)) {
      seen.push(entry.path);
      break;
    }
    expect(seen).toEqual(['.git']);
  });

  it('an empty folder walks to nothing', async () => {
    const empty = path.join(work, 'vacio');
    await mkdir(empty);
    expect(await walkAll(empty)).toEqual([]);
  });

  it.each([
    ['does not exist', (dir: string) => path.join(dir, 'no-existe')],
    ['is a file', (dir: string) => path.join(dir, 'cliente-inventado', 'logo.png')],
  ])('fails naming the folder when it %s', async (_name, pick) => {
    const dir = pick(work);
    await expect(walkAll(dir)).rejects.toThrow(SpecmateError);
    await expect(walkAll(dir)).rejects.toThrow(dir);
  });
});

describe('nodeClientFolder reads', () => {
  it('readHead returns at most the bytes asked for', async () => {
    expect(new TextDecoder().decode(await nodeClientFolder.readHead(client, 'logo.png', 3))).toBe('not');
    expect((await nodeClientFolder.readHead(client, 'fotos/local/frente.jpg', 100)).length).toBe(2);
  });

  it('sha256 is the hash of the file', async () => {
    const expected = createHash('sha256').update('x'.repeat(10)).digest('hex');
    expect(await nodeClientFolder.sha256(client, 'fotos/vidriera.jpg', 1000)).toBe(expected);
  });

  it('realPath resolves a junction to its target and fails on a missing folder', async () => {
    await symlink(path.join(client, 'fotos'), path.join(work, 'alias'), 'junction');
    expect(await nodeClientFolder.realPath(path.join(work, 'alias'))).toBe(
      await nodeClientFolder.realPath(path.join(client, 'fotos')),
    );
    await expect(nodeClientFolder.realPath(path.join(work, 'no-existe'))).rejects.toThrow(SpecmateError);
  });

  it('walking, reading and hashing leave the folder identical (AC-12)', async () => {
    const before = await hashTree(client);
    await walkAll(client);
    await nodeClientFolder.readHead(client, 'logo.png', 64);
    await nodeClientFolder.sha256(client, 'logo.png', 1000);
    expect(await hashTree(client)).toEqual(before);
  });
});
