// Git over the git executable (US-13 FR-002, plan decision 3): spawned without a shell, arguments as an array.
// The commit uses the user's own git identity; if it is missing, git fails and the message says why.
import { spawn } from 'node:child_process';
import type { Git } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

export class GitError extends SpecmateError {}

/** Runs git in `cwd` and resolves with its stdout. */
function git(args: readonly string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'ENOENT'
          ? new GitError('git is not installed or not in PATH: install git and try again (nothing was created)')
          : new GitError(`could not run git ${args[0]}: ${error.message}`),
      );
    });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new GitError(`git ${args[0]} failed (exit ${code}): ${stderr.trim().split('\n').at(-1) ?? ''}`));
    });
  });
}

// NUL-separated output (-z): no quoting of spaces or accents, and paths always use "/".
const nulList = (out: string) => out.split('\0').filter((file) => file !== '');

export const gitCli: Git = {
  async trackedFiles(dir) {
    // ls-files run inside `dir` lists only files under it, relative to it. A tracked file deleted on disk is dropped:
    // there is nothing to copy.
    const tracked = nulList(await git(['ls-files', '-z', '--cached'], dir));
    const deleted = new Set(nulList(await git(['ls-files', '-z', '--deleted'], dir)));
    return tracked.filter((file) => !deleted.has(file)).sort();
  },

  async initAndCommit(dir, message) {
    await git(['init', '--quiet', '--initial-branch=main'], dir);
    await git(['add', '--all'], dir);
    await git(['commit', '--quiet', '--no-verify', '--message', message], dir);
  },
};
