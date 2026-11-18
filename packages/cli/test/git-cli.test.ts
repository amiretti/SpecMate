// Rule (#53): the template is read through git, so only tracked files that exist on disk reach a client repo. An
// ignored file (a local .env, the generated CLAUDE.md), an untracked one or a tracked one deleted on disk is left out.
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitError, gitCli } from '../src/infrastructure/git-cli.ts';

const IDENTITY = ['-c', 'user.name=SpecMate test', '-c', 'user.email=test@specmate.invalid'];
const git = (cwd: string, ...args: string[]) => {
  const res = spawnSync('git', [...IDENTITY, ...args], { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr);
};

let work: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-git-'));
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('gitCli.trackedFiles', () => {
  it('lists only tracked files present on disk, relative to the dir and with "/"', async () => {
    const site = path.join(work, 'templates', 'site');
    await mkdir(path.join(site, 'src', 'pages'), { recursive: true });
    await writeFile(path.join(work, 'outside.txt'), 'not under the dir');
    await writeFile(path.join(site, '.gitignore'), '.env\nCLAUDE.md\n');
    await writeFile(path.join(site, 'package.json'), '{}');
    await writeFile(path.join(site, 'src', 'pages', 'index.astro'), '<h1>x</h1>');
    await writeFile(path.join(site, 'gone.txt'), 'deleted later');
    git(work, 'init', '--quiet');
    git(work, 'add', '--all');
    git(work, 'commit', '--quiet', '--message', 'base');
    await rm(path.join(site, 'gone.txt'));
    await writeFile(path.join(site, '.env'), 'SECRET=1');
    await writeFile(path.join(site, 'CLAUDE.md'), 'generated');
    await writeFile(path.join(site, 'untracked.txt'), 'new');

    expect(await gitCli.trackedFiles(site)).toEqual(['.gitignore', 'package.json', 'src/pages/index.astro']);
  });

  it('fails naming git when the dir is not inside a git repo', async () => {
    await expect(gitCli.trackedFiles(work)).rejects.toThrow(GitError);
    await expect(gitCli.trackedFiles(work)).rejects.toThrow(/git ls-files failed/);
  });
});
