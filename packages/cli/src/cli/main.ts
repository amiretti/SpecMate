// Console adapter (US-13 FR-010, US-15): parses the arguments, runs the use case and maps the outcome to an exit code.
// 0 = done · 1 = the command failed (message names the cause) · 2 = wrong usage.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { applyClientTokens, type TokensDeps, type TokensResult } from '../application/apply-client-tokens.ts';
import {
  type ChangeRequest,
  changeProfile,
  type ProfileDeps,
  type ProfileResult,
  proposeProfile,
  showProfile,
} from '../application/business-profile-step.ts';
import { type CreateClientRepoDeps, createClientRepo } from '../application/create-client-repo.ts';
import {
  type InventoryDeps,
  type InventoryResult,
  inventoryClientFolder,
} from '../application/inventory-client-folder.ts';
import { FIELD_NAMES, type FieldName, isFieldName, STEPS, TONES } from '../domain/business-profile.ts';
import { SpecmateError } from '../domain/errors.ts';
import { EXPECTED_KINDS, type InventoryEntry, type Kind } from '../domain/inventory.ts';
import { parseSlug } from '../domain/slug.ts';

export const CLIENTS_ENV = 'SPECMATE_CLIENTS_DIR';

export const USAGE = `Usage: specmate new <slug>
       specmate inventory <slug> [--clients <dir>]
       specmate tokens <slug> [--clients <dir>] [--file <path>] [--confirm]
       specmate profile <slug> [propose] [--clients <dir>]
       specmate profile <slug> set <field> <value> | confirm <field> | pick <field>

new        Creates ./<slug>: a git repo with the SpecMate site template and its invented example client.
inventory  Lists what the client folder <clients>/<slug> holds and what is missing, read only, and saves it in
           steps.inventory of ./<slug>/relevamiento.json. To correct a kind, edit "kind" there and run it again.
           --clients <dir>  root of the client folders, outside the SpecMate repo (default: $${CLIENTS_ENV})
tokens     Translates the client's tokens file found by inventory to the site's token contract: DTCG 2025.10 with the
           contract names directly, any other format through the mapping saved in steps.tokens of relevamiento.json.
           Checks the color contrast (WCAG 2.2 AA) and writes ./<slug>/src/data/tokens.json only when the mapping is
           confirmed, complete and every pair passes. Same --clients as inventory.
           --file <path>  the tokens file, as the inventory lists it, when there is more than one
           --confirm      confirm the mapping as it is now in steps.tokens
profile    Steps 2 to 4 of the intake: the business, the main action and the tone, saved in steps.profile of
           ./<slug>/relevamiento.json. Without a subcommand it shows what was found, inferred and what is missing.
           propose   reads a proposal as JSON from stdin (at most 64 KB), validates it whole and saves it as found or
                     inferred; it needs --clients (default: $${CLIENTS_ENV}) to check the quotes against the files
           set       Harvi's own value for a field, confirmed
           confirm   confirms what was found or inferred, as it is
           pick      "no sé, elegí vos": takes the suggestion, confirmed and marked as delegated
           fields: ${FIELD_NAMES.join(', ')}
<slug>: lowercase letters, digits and hyphens, not starting or ending with a hyphen, at most 63 characters.`;

export interface Io {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  out: (line: string) => void;
  err: (line: string) => void;
  /** All of stdin, as text; fails if it is larger than the limit of a proposal. */
  stdin: () => Promise<string>;
}

export type CliDeps = CreateClientRepoDeps & InventoryDeps & TokensDeps & ProfileDeps;

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

const clip = (value: unknown) => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

export function formatTokens({ step, total, notices, clientDir, file, tokensFile, blocked }: TokensResult): string {
  const mapped = Object.values(step.mapping).filter((source) => source !== null).length;
  const failed = step.contrast.filter((result) => !result.ok);
  const problem = (p: TokensResult['step']['problems'][number]) =>
    `  ${[p.token, p.source && `from ${p.source}`].filter(Boolean).join(' ') || 'file'}: ${p.reason}${p.value === undefined ? '' : ` (${clip(p.value)})`}`;
  const notWritten = blocked
    ? 'Not written: fix what is listed above and run again'
    : `Not written: run again with --confirm once the mapping in ${file} is right`;
  return [
    `Tokens from ${clientDir} > ${step.source.path} (${step.format === 'dtcg' ? 'DTCG 2025.10' : 'custom format'})`,
    `Mapping ${step.confirmed ? 'confirmed' : 'proposed'}: ${mapped} of ${total} tokens`,
    ...(step.missing.length ? [`Missing (${step.missing.length}): ${step.missing.join(', ')}`] : []),
    ...(step.problems.length ? ['Problems:', ...step.problems.map(problem)] : []),
    ...(step.contrast.length === 0
      ? []
      : failed.length
        ? failed.map(
            (r) =>
              `Contrast: ${r.mode} ${r.pair[0]} on ${r.pair[1]} ${r.colors[0]} / ${r.colors[1]} = ${r.ratio}:1, needs ${r.min}:1`,
          )
        : [`Contrast: ${step.contrast.length} pairs pass WCAG 2.2 AA`]),
    ...notices.map((notice) => `Notice: ${notice}`),
    step.written ? `Written ${tokensFile}` : notWritten,
    `Saved in ${file}`,
  ]
    .map(printable)
    .join('\n');
}

export function formatProfile({ profile, notices, file, saved }: ProfileResult): string {
  const lines: string[] = [];
  const missing: FieldName[] = [];
  const toConfirm: FieldName[] = [];
  for (const step of STEPS) {
    lines.push(`Step ${step.number} · ${step.title}`);
    for (const name of step.fields) {
      const field = profile.fields[name];
      if (!field) {
        missing.push(name);
        lines.push(`  missing: ${name}`);
        continue;
      }
      if (field.state !== 'confirmed') toConfirm.push(name);
      const where = [
        field.source,
        field.state === 'confirmed' && field.delegated ? 'delegated' : undefined,
        field.quote === undefined ? undefined : `"${field.quote}"`,
      ].filter(Boolean);
      lines.push(`  ${field.state}: ${name} = ${field.value}${where.length ? ` (${where.join(', ')})` : ''}`);
    }
    if (step.title === 'tone') {
      if (!profile.samples) lines.push('  samples: none yet');
      else {
        lines.push('  samples (the same sentence, written by the agent):');
        const chosen = profile.fields['tone.choice']?.value;
        for (const tone of TONES)
          lines.push(`    ${tone}: ${profile.samples[tone]}${tone === chosen ? ' (suggested)' : ''}`);
      }
    }
  }
  return [
    `Profile in ${file}`,
    ...lines,
    ...notices.map((notice) => `Notice: ${notice}`),
    `To confirm: ${toConfirm.length ? toConfirm.join(', ') : 'nothing'}`,
    `Ask about: ${missing.length ? missing.join(', ') : 'nothing'}`,
    ...(saved ? [`Saved in ${file}`] : []),
  ]
    .map(printable)
    .join('\n');
}

// Only inventory errors can carry a client file name; `new` keeps its messages as they were (git stderr included).
async function run(
  io: Io,
  command: string,
  task: () => Promise<string | { out: string; code: number }>,
  shown = (text: string) => text,
): Promise<number> {
  try {
    const result = await task();
    io.out(typeof result === 'string' ? result : result.out);
    return typeof result === 'string' ? 0 : result.code;
  } catch (error) {
    io.err(
      `specmate ${command}: ${shown(error instanceof SpecmateError ? error.message : `unexpected error: ${(error as Error).message}`)}`,
    );
    return 1;
  }
}

/** `specmate profile <slug> [propose | set <field> <value> | confirm <field> | pick <field>]` (US-17). */
async function profileCommand(
  io: Io,
  deps: CliDeps,
  rest: readonly string[],
  slugArg: string,
  clientsOption: string | undefined,
): Promise<number> {
  const [, sub, fieldArg, valueArg, ...more] = rest;
  const clients = clientsOption || io.env[CLIENTS_ENV];
  const siteDir = path.resolve(io.cwd, slugArg);
  const clientFolder = () => {
    const root = path.resolve(io.cwd, clients as string);
    return { clientsRoot: root, clientDir: path.join(root, parseSlug(slugArg)) };
  };
  if (sub === undefined || sub === 'propose') {
    if (fieldArg !== undefined) return usageError(io, `unexpected arguments: ${rest.join(' ')}`);
    if (sub === 'propose' && !clients)
      return usageError(
        io,
        `profile propose needs the root of the client folders: pass --clients <dir> or set ${CLIENTS_ENV}`,
      );
    return run(
      io,
      'profile',
      async () => {
        parseSlug(slugArg);
        const result =
          sub === 'propose'
            ? await proposeProfile({ ...clientFolder(), siteDir, proposalText: await io.stdin() }, deps)
            : await showProfile({ siteDir, ...(clients ? { client: clientFolder() } : {}) }, deps);
        return formatProfile(result);
      },
      printable,
    );
  }
  if (sub !== 'set' && sub !== 'confirm' && sub !== 'pick')
    return usageError(io, `unknown profile subcommand: ${sub} (use propose, set, confirm or pick)`);
  if (clientsOption !== undefined) return usageError(io, `profile ${sub} does not take --clients`);
  if (fieldArg === undefined || !isFieldName(fieldArg))
    return usageError(
      io,
      fieldArg === undefined
        ? `profile ${sub} needs a field: ${FIELD_NAMES.join(', ')}`
        : `unknown field ${printable(JSON.stringify(fieldArg))}: ${FIELD_NAMES.join(', ')}`,
    );
  if (sub === 'set' ? valueArg === undefined || more.length > 0 : valueArg !== undefined)
    return usageError(
      io,
      sub === 'set' ? 'profile set needs one field and one value' : `profile ${sub} takes only a field`,
    );
  const request: ChangeRequest = {
    siteDir,
    action: sub,
    field: fieldArg,
    ...(valueArg === undefined ? {} : { value: valueArg }),
  };
  return run(
    io,
    'profile',
    async () => {
      parseSlug(slugArg);
      return formatProfile(await changeProfile(request, deps));
    },
    printable,
  );
}

export async function main(argv: readonly string[], io: Io, deps: CliDeps): Promise<number> {
  let parsed: ReturnType<
    typeof parseArgs<{
      options: {
        help: { type: 'boolean'; short: 'h' };
        clients: { type: 'string' };
        file: { type: 'string' };
        confirm: { type: 'boolean' };
      };
      allowPositionals: true;
      strict: true;
    }>
  >;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        clients: { type: 'string' },
        file: { type: 'string' },
        confirm: { type: 'boolean' },
      },
    });
  } catch (error) {
    return usageError(io, (error as Error).message);
  }
  const [command, ...rest] = parsed.positionals;
  if (parsed.values.help === true) {
    io.out(USAGE);
    return 0;
  }
  const slugArg = command === 'profile' ? rest[0] : rest.length === 1 ? rest[0] : undefined;
  if (
    (command !== 'new' && command !== 'inventory' && command !== 'tokens' && command !== 'profile') ||
    slugArg === undefined
  ) {
    return usageError(
      io,
      command === undefined ? 'missing command' : `unexpected arguments: ${parsed.positionals.join(' ')}`,
    );
  }
  const { clients: clientsOption, file, confirm } = parsed.values;
  if (command !== 'tokens' && (file !== undefined || confirm !== undefined))
    return usageError(io, `${command} does not take --file or --confirm`);
  if (command === 'new') {
    if (clientsOption !== undefined) return usageError(io, 'new does not take --clients');
    return run(io, 'new', async () => {
      const slug = parseSlug(slugArg);
      const { dir } = await createClientRepo({ slug, targetDir: path.resolve(io.cwd, slug) }, deps);
      return `Created ${dir}\nNext: cd ${slug} && npm ci && npm test`;
    });
  }
  if (command === 'profile') return profileCommand(io, deps, rest, slugArg, clientsOption);
  const clients = clientsOption || io.env[CLIENTS_ENV];
  if (!clients)
    return usageError(
      io,
      `${command} needs the root of the client folders: pass --clients <dir> or set ${CLIENTS_ENV}`,
    );
  if (command === 'tokens')
    return run(
      io,
      'tokens',
      async () => {
        const slug = parseSlug(slugArg);
        const clientsRoot = path.resolve(io.cwd, clients);
        const result = await applyClientTokens(
          {
            clientsRoot,
            clientDir: path.join(clientsRoot, slug),
            siteDir: path.resolve(io.cwd, slug),
            ...(file === undefined ? {} : { file }),
            confirm: confirm === true,
          },
          deps,
        );
        return { out: formatTokens(result), code: result.blocked ? 1 : 0 };
      },
      printable,
    );
  return run(
    io,
    'inventory',
    async () => {
      const slug = parseSlug(slugArg);
      const clientsRoot = path.resolve(io.cwd, clients);
      const result = await inventoryClientFolder(
        { clientsRoot, clientDir: path.join(clientsRoot, slug), siteDir: path.resolve(io.cwd, slug) },
        deps,
      );
      return formatInventory(result);
    },
    printable,
  );
}
