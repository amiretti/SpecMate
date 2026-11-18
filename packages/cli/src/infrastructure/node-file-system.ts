// RepoWorkspace over node:fs (US-13 FR-001, FR-005 to FR-007). Every path is built with node:path (AC-9).
import { constants } from 'node:fs';
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TargetExistsError } from '../application/create-client-repo.ts';
import type { RepoWorkspace } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;

async function setRootName(file: string, name: string, { lockfile }: { lockfile: boolean }) {
  const json = JSON.parse(await readFile(file, 'utf8'));
  json.name = name;
  if (lockfile && json.packages?.['']) json.packages[''].name = name;
  await writeFile(file, `${JSON.stringify(json, null, 2)}\n`);
}

export const nodeFileSystem: RepoWorkspace = {
  async exists(dir) {
    try {
      await access(dir);
      return true;
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return false;
      throw error;
    }
  },

  createStaging(target) {
    return mkdtemp(path.join(path.dirname(target), `.${path.basename(target)}.tmp-`));
  },

  async copyTemplate(from, to, files) {
    // `to` is the fresh, empty staging dir from createStaging: nothing in it can be overwritten.
    for (const file of files) {
      const parts = file.split('/');
      const source = path.join(from, ...parts);
      // copyFile follows symlinks: a committed link could pull a file from outside the template (#53).
      if (!(await lstat(source)).isFile())
        throw new SpecmateError(`${file} is not a regular file: refusing to copy it`);
      const destination = path.join(to, ...parts);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    }
  },

  async renamePackage(dir, name) {
    await setRootName(path.join(dir, 'package.json'), name, { lockfile: false });
    await setRootName(path.join(dir, 'package-lock.json'), name, { lockfile: true });
  },

  async publish(staging, target) {
    // rename() replaces an EMPTY directory on POSIX, so the check stays even though the use case already did it.
    if (await this.exists(target)) throw new TargetExistsError(target);
    try {
      await rename(staging, target);
    } catch (error) {
      if (['EEXIST', 'ENOTEMPTY'].includes(errorCode(error) ?? '')) throw new TargetExistsError(target);
      throw error;
    }
  },

  async discard(dir) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  },
};
