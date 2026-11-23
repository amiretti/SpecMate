// ClientFolder over node:fs (US-15 FR-008, FR-009, FR-011). Read only: files are opened for reading and nothing else.
// Links are detected with lstat semantics (readdir file types), so a symlink or a Windows junction is reported, never
// entered; reads refuse a link that replaced a file after the walk where the platform allows it (O_NOFOLLOW).
import { createHash } from 'node:crypto';
import { constants, type Dirent } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ClientFolder, FolderEntry } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code ?? String(error);
const READ_ONLY = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
const onDisk = (root: string, rel: string) => path.join(root, ...rel.split('/'));

async function* walkDir(
  root: string,
  rel: string,
  depth: number,
  skipDirectory: (name: string) => boolean,
): AsyncGenerator<FolderEntry> {
  let children: Dirent[];
  try {
    children = await readdir(onDisk(root, rel), { withFileTypes: true });
  } catch {
    yield { type: 'unreadable', path: rel, depth: depth - 1 };
    return;
  }
  children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const child of children) {
    const childRel = rel ? path.posix.join(rel, child.name) : child.name;
    if (child.isSymbolicLink()) yield { type: 'link', path: childRel, depth };
    else if (child.isDirectory()) {
      if (skipDirectory(child.name)) {
        yield { type: 'skipped', path: childRel, depth };
        continue;
      }
      yield { type: 'directory', path: childRel, depth };
      yield* walkDir(root, childRel, depth + 1, skipDirectory);
    } else if (child.isFile()) {
      let size: number;
      try {
        size = (await stat(onDisk(root, childRel))).size;
      } catch {
        yield { type: 'unreadable', path: childRel, depth };
        continue;
      }
      yield { type: 'file', path: childRel, depth, size };
    } else yield { type: 'other', path: childRel, depth };
  }
}

export const nodeClientFolder: ClientFolder = {
  async realPath(dir) {
    try {
      const real = await realpath(dir);
      if (!(await stat(real)).isDirectory()) throw new SpecmateError(`${dir} is not a folder`);
      return real;
    } catch (error) {
      if (error instanceof SpecmateError) throw error;
      throw new SpecmateError(`cannot read the client folder ${dir} (${errorCode(error)})`);
    }
  },

  async *walk(root, skipDirectory) {
    try {
      if (!(await stat(root)).isDirectory()) throw new SpecmateError(`the client folder ${root} is not a folder`);
      await readdir(root);
    } catch (error) {
      if (error instanceof SpecmateError) throw error;
      throw new SpecmateError(`cannot read the client folder ${root} (${errorCode(error)})`);
    }
    yield* walkDir(root, '', 1, skipDirectory);
  },

  async readHead(root, file, bytes) {
    const handle = await open(onDisk(root, file), READ_ONLY);
    try {
      const buffer = new Uint8Array(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  },

  async sha256(root, file, maxBytes) {
    const handle = await open(onDisk(root, file), READ_ONLY);
    try {
      const hash = createHash('sha256');
      for await (const chunk of handle.createReadStream({ start: 0, end: maxBytes - 1, autoClose: false })) {
        hash.update(chunk);
      }
      return hash.digest('hex');
    } finally {
      await handle.close();
    }
  },
};
