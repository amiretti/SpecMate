// Git over the git executable (US-13 FR-002, plan decision 3): spawned without a shell, arguments as an array.
// The commit uses the user's own git identity; if it is missing, git fails and the message says why.
import { spawn } from 'node:child_process';
import type { Git } from '../application/ports.ts';
import { SpecmateError } from '../domain/errors.ts';

export class GitError extends SpecmateError {}

function git(args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
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
      if (code === 0) resolve();
      else reject(new GitError(`git ${args[0]} failed (exit ${code}): ${stderr.trim().split('\n').at(-1) ?? ''}`));
    });
  });
}

export const gitCli: Git = {
  async initAndCommit(dir, message) {
    await git(['init', '--quiet', '--initial-branch=main'], dir);
    await git(['add', '--all'], dir);
    await git(['commit', '--quiet', '--no-verify', '--message', message], dir);
  },
};
