// Console adapter (US-13 FR-010): parses the arguments, runs the use case and maps the outcome to an exit code.
// 0 = done · 1 = the command failed (message names the cause) · 2 = wrong usage.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type CreateClientRepoDeps, createClientRepo } from '../application/create-client-repo.ts';
import { SpecmateError } from '../domain/errors.ts';
import { parseSlug } from '../domain/slug.ts';

export const USAGE = `Usage: specmate new <slug>

Creates ./<slug>: a git repo with the SpecMate site template and its invented example client.
<slug>: lowercase letters, digits and hyphens, not starting or ending with a hyphen, at most 63 characters.`;

export interface Io {
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

export async function main(argv: readonly string[], io: Io, deps: CreateClientRepoDeps): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: { help: { type: 'boolean', short: 'h' } },
    });
  } catch (error) {
    io.err(`specmate: ${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  const [command, ...rest] = parsed.positionals;
  if (parsed.values.help === true) {
    io.out(USAGE);
    return 0;
  }
  if (command !== 'new' || rest.length !== 1 || rest[0] === undefined) {
    io.err(
      `specmate: ${command === undefined ? 'missing command' : `unexpected arguments: ${parsed.positionals.join(' ')}`}\n${USAGE}`,
    );
    return 2;
  }
  try {
    const slug = parseSlug(rest[0]);
    const { dir } = await createClientRepo({ slug, targetDir: path.resolve(io.cwd, slug) }, deps);
    io.out(`Created ${dir}\nNext: cd ${slug} && npm ci && npm test`);
    return 0;
  } catch (error) {
    io.err(
      `specmate new: ${error instanceof SpecmateError ? error.message : `unexpected error: ${(error as Error).message}`}`,
    );
    return 1;
  }
}
