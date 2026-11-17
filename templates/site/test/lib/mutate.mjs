// Sites that fail on purpose (US-12, plan decision 2): copy a healthy build to os.tmpdir() and apply ONE mutation.
// Each unit declares its own table `control -> mutation -> expected violation`; controls-isolation joins them.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Copies `src` (a build or a fixture directory) into a fresh temp dir and returns its path. */
export async function copyBuild(src) {
  const dir = await mkdtemp(path.join(tmpdir(), 'specmate-mutant-'));
  await cp(src, dir, { recursive: true });
  return dir;
}

/** Rewrites one file inside `dir` with `fn(text) -> text`; throws if the mutation changed nothing. */
export async function mutateFile(dir, rel, fn) {
  const file = path.join(dir, rel);
  const before = await readFile(file, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`mutation of ${rel} changed nothing`);
  await writeFile(file, after);
}

/** Copies `src`, applies `mutation(dir)` and returns the dir; the caller removes it with `removeBuild`. */
export async function mutant(src, mutation) {
  const dir = await copyBuild(src);
  await mutation(dir);
  return dir;
}

export const removeBuild = (dir) => rm(dir, { recursive: true, force: true });
