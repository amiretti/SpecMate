// Console adapter (US-13 FR-010, US-15): parses the arguments, runs the use case and maps the outcome to an exit code.
// 0 = done · 1 = the command failed (message names the cause) · 2 = wrong usage.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type CreateClientRepoDeps, createClientRepo } from '../application/create-client-repo.ts';
import {
  type InventoryDeps,
  type InventoryResult,
  inventoryClientFolder,
} from '../application/inventory-client-folder.ts';
import { SpecmateError } from '../domain/errors.ts';
import { EXPECTED_KINDS, type InventoryEntry, type Kind } from '../domain/inventory.ts';
import { parseSlug } from '../domain/slug.ts';

export const CLIENTS_ENV = 'SPECMATE_CLIENTS_DIR';

export const USAGE = `Usage: specmate new <slug>
       specmate inventory <slug> [--clients <dir>]

new        Creates ./<slug>: a git repo with the SpecMate site template and its invented example client.
inventory  Lists what the client folder <clients>/<slug> holds and what is missing, read only, and saves it in
           steps.inventory of ./<slug>/relevamiento.json. To correct a kind, edit "kind" there and run it again.
           --clients <dir>  root of the client folders, outside the SpecMate repo (default: $${CLIENTS_ENV})
<slug>: lowercase letters, digits and hyphens, not starting or ending with a hyphen, at most 63 characters.`;

export interface Io {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  out: (line: string) => void;
  err: (line: string) => void;
}

export type CliDeps = CreateClientRepoDeps & InventoryDeps;

const usageError = (io: Io, problem: string) => {
  io.err(`specmate: ${problem}\n${USAGE}`);
  return 2;
};

// A file name comes from the client: control, bidi and invisible characters are shown escaped, never sent to the
// terminal, both in the inventory and in error messages (which can name a file).
const isUnsafe = (code: number) =>
  code < 0x20 ||
  code === 0x061c ||
  (code >= 0x200b && code <= 0x200d) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x2060 ||
  code === 0xfeff ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x200e ||
  code === 0x200f ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069);
const printable = (text: string) =>
  [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return isUnsafe(code) ? `\\u${code.toString(16).padStart(4, '0')}` : ch;
    })
    .join('');

const KIND_ORDER: readonly Kind[] = [...EXPECTED_KINDS, 'secret', 'unclassified'];

function describeEntry(entry: InventoryEntry): string {
  const details = [
    ...(entry.width !== undefined && entry.height !== undefined ? [`${entry.width}×${entry.height}`] : []),
    ...entry.notices,
    ...(entry.correctedBy === 'manual' ? ['corrected by hand'] : []),
  ];
  return `  ${entry.kind}: ${printable(entry.path)}${details.length ? ` (${details.join(', ')})` : ''}`;
}

export function formatInventory({ inventory, clientDir, file }: InventoryResult): string {
  const present = inventory.entries.filter((entry) => entry.status !== 'gone');
  const gone = inventory.entries.filter((entry) => entry.status === 'gone');
  const found = KIND_ORDER.flatMap((kind) => present.filter((entry) => entry.kind === kind).map(describeEntry));
  return [
    `Inventory of ${clientDir}`,
    `Found (${present.length} files):`,
    ...found,
    `Missing: ${inventory.missing.length ? inventory.missing.join(', ') : 'nothing'}`,
    ...(gone.length ? [`Gone: ${gone.map((entry) => printable(entry.path)).join(', ')}`] : []),
    ...(inventory.omitted.length
      ? [`Omitted: ${inventory.omitted.map((o) => `${printable(o.path)} (${o.reason})`).join(', ')}`]
      : []),
    `Ignored: ${inventory.summary.ignored}`,
    `Saved in ${file}`,
  ].join('\n');
}

async function run(io: Io, command: string, task: () => Promise<string>): Promise<number> {
  try {
    io.out(await task());
    return 0;
  } catch (error) {
    io.err(
      `specmate ${command}: ${printable(error instanceof SpecmateError ? error.message : `unexpected error: ${(error as Error).message}`)}`,
    );
    return 1;
  }
}

export async function main(argv: readonly string[], io: Io, deps: CliDeps): Promise<number> {
  let parsed: ReturnType<
    typeof parseArgs<{
      options: { help: { type: 'boolean'; short: 'h' }; clients: { type: 'string' } };
      allowPositionals: true;
      strict: true;
    }>
  >;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: { help: { type: 'boolean', short: 'h' }, clients: { type: 'string' } },
    });
  } catch (error) {
    return usageError(io, (error as Error).message);
  }
  const [command, ...rest] = parsed.positionals;
  if (parsed.values.help === true) {
    io.out(USAGE);
    return 0;
  }
  const slugArg = rest.length === 1 ? rest[0] : undefined;
  if ((command !== 'new' && command !== 'inventory') || slugArg === undefined) {
    return usageError(
      io,
      command === undefined ? 'missing command' : `unexpected arguments: ${parsed.positionals.join(' ')}`,
    );
  }
  if (command === 'new') {
    if (parsed.values.clients !== undefined) return usageError(io, 'new does not take --clients');
    return run(io, 'new', async () => {
      const slug = parseSlug(slugArg);
      const { dir } = await createClientRepo({ slug, targetDir: path.resolve(io.cwd, slug) }, deps);
      return `Created ${dir}\nNext: cd ${slug} && npm ci && npm test`;
    });
  }
  const clients = parsed.values.clients || io.env[CLIENTS_ENV];
  if (!clients)
    return usageError(io, `inventory needs the root of the client folders: pass --clients <dir> or set ${CLIENTS_ENV}`);
  return run(io, 'inventory', async () => {
    const slug = parseSlug(slugArg);
    const clientsRoot = path.resolve(io.cwd, clients);
    const result = await inventoryClientFolder(
      { clientsRoot, clientDir: path.join(clientsRoot, slug), siteDir: path.resolve(io.cwd, slug) },
      deps,
    );
    return formatInventory(result);
  });
}
