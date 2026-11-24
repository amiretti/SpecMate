// Rule (US-16 FR-001, FR-004, FR-005, FR-007 to FR-009, AC-1, AC-3 to AC-6; plan "Comando"): `specmate tokens <slug>`
// run as a real process. It reads the tokens file the inventory found, saves the mapping in steps.tokens and writes the
// site's src/data/tokens.json only when the mapping is confirmed, complete and readable. The contract and its check come
// from the site's own src/lib/tokens.ts. Clients, files and sites are invented, in the system temp dir.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
const template = fileURLToPath(new URL('../../../templates/site', import.meta.url));
const SLUG = 'cliente-inventado';

function specmate(args: string[], cwd: string) {
  const env = { ...process.env };
  delete env.SPECMATE_CLIENTS_DIR;
  const res = spawnSync(process.execPath, [entry, ...args], { cwd, env, encoding: 'utf8' });
  return { status: res.status, out: res.stdout, err: res.stderr };
}

const EXAMPLE = JSON.parse(await readFile(path.join(template, 'src', 'data', 'tokens.json'), 'utf8'));
const hex = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);

/** The example contract written as DTCG 2025.10, with the light bg as a reference to a base token. */
function dtcgOf(tokens: typeof EXAMPLE) {
  const colors = (mode: 'light' | 'dark') =>
    Object.fromEntries(
      Object.entries(tokens.color[mode] as Record<string, string>).map(([k, v]) => [
        k,
        { $value: { colorSpace: 'srgb', components: hex(v) } },
      ]),
    );
  return {
    base: { paper: { $type: 'color', $value: { colorSpace: 'srgb', components: hex(tokens.color.light.bg) } } },
    color: { $type: 'color', light: { ...colors('light'), bg: { $value: '{base.paper}' } }, dark: colors('dark') },
    font: {
      family: { $type: 'fontFamily', $value: ['Inter Variable', 'system-ui', 'sans-serif'] },
      size: Object.fromEntries(Object.entries(tokens.font.size).map(([k, v]) => [k, { $value: v }])),
      lineHeight: { $type: 'number', $value: tokens.font.lineHeight },
    },
    space: Object.fromEntries(Object.entries(tokens.space).map(([k, v]) => [k, { $value: v }])),
    radius: { $value: tokens.radius },
    contentWidth: { $value: tokens.contentWidth },
    focusWidth: { $value: tokens.focusWidth },
  };
}

let work: string;
let folder: string;
let sites: string;
let site: string;
const siteTokens = () => path.join(site, 'src', 'data', 'tokens.json');
const steps = async () => JSON.parse(await readFile(path.join(site, 'relevamiento.json'), 'utf8')).steps;

async function inventoryWith(files: string[]) {
  const json = JSON.parse(await readFile(path.join(site, 'relevamiento.json'), 'utf8'));
  json.steps.inventory = {
    version: 1,
    summary: { files: files.length, ignored: 0, omitted: 0 },
    missing: [],
    entries: files.map((p) => ({ path: p, kind: 'tokens', detectedKind: 'tokens', notices: [], status: 'present' })),
    omitted: [],
  };
  await writeFile(path.join(site, 'relevamiento.json'), `${JSON.stringify(json, null, 2)}\n`);
}

beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-tokens-'));
  folder = path.join(work, 'clientes', SLUG);
  sites = path.join(work, 'sitios');
  site = path.join(sites, SLUG);
  await mkdir(path.join(folder, 'marca'), { recursive: true });
  await mkdir(path.join(site, 'src', 'lib'), { recursive: true });
  await mkdir(path.join(site, 'src', 'data'), { recursive: true });
  await copyFile(path.join(template, 'src', 'lib', 'tokens.ts'), path.join(site, 'src', 'lib', 'tokens.ts'));
  await writeFile(siteTokens(), '{"$comment": "example, to be replaced"}\n');
  await writeFile(
    path.join(site, 'relevamiento.json'),
    `${JSON.stringify({ $schemaVersion: 1, $comment: 'Invented client for a test.', brief: {}, steps: { other: { keep: true } } }, null, 2)}\n`,
  );
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

const run = (...extra: string[]) =>
  specmate(['tokens', SLUG, '--clients', path.join(work, 'clientes'), ...extra], sites);

describe('specmate tokens, choosing the file (FR-001)', () => {
  it('without an inventory it says to run inventory first', async () => {
    const res = run();
    expect(res.status).toBe(1);
    expect(res.err).toContain('no inventory in');
    expect(res.err).toContain('run specmate inventory first');
  });

  it('with two tokens files it lists them and asks for --file', async () => {
    await writeFile(path.join(folder, 'marca', 'a.tokens.json'), '{}');
    await writeFile(path.join(folder, 'marca', 'b.tokens.json'), '{}');
    await inventoryWith(['marca/a.tokens.json', 'marca/b.tokens.json']);
    const res = run();
    expect(res.status).toBe(1);
    expect(res.err).toContain(
      'more than one tokens file: marca/a.tokens.json, marca/b.tokens.json; choose one with --file',
    );
  });

  it('refuses a --file that is not a tokens file of the inventory', async () => {
    await inventoryWith(['marca/a.tokens.json']);
    const res = run('--file', '../../etc/passwd');
    expect(res.status).toBe(1);
    expect(res.err).toContain('"../../etc/passwd" is not a tokens file of the inventory');
  });
});

describe('specmate tokens, DTCG read directly (AC-1)', () => {
  beforeEach(async () => {
    await writeFile(path.join(folder, 'marca', 'brand.tokens.json'), JSON.stringify(dtcgOf(EXAMPLE)));
    await inventoryWith(['marca/brand.tokens.json']);
  });

  it('proposes the identity mapping and writes nothing until --confirm', async () => {
    const res = run();
    expect(res.status).toBe(0);
    expect(res.out).toContain('Mapping proposed: 28 of 28 tokens');
    expect(res.out).toContain('Not written: run again with --confirm');
    const saved = await steps();
    expect(saved.other).toEqual({ keep: true });
    expect(saved.tokens).toMatchObject({ format: 'dtcg', confirmed: false, missing: [], problems: [], written: false });
    expect(saved.tokens.mapping['color.light.bg']).toBe('color.light.bg');
    expect(await readFile(siteTokens(), 'utf8')).toBe('{"$comment": "example, to be replaced"}\n');
  });

  it('with --confirm writes the 28 values, which the template accepts', async () => {
    const res = run('--confirm');
    expect(res.status).toBe(0);
    expect(res.out).toContain(`Written ${siteTokens()}`);
    const written = JSON.parse(await readFile(siteTokens(), 'utf8'));
    const { $comment, ...values } = written;
    const { $comment: _, ...example } = EXAMPLE;
    expect(values).toEqual({
      ...example,
      font: { ...example.font, family: '"Inter Variable", system-ui, sans-serif' },
    });
    expect($comment).toContain('marca/brand.tokens.json');
    expect((await steps()).tokens).toMatchObject({ confirmed: true, written: true });
  });

  it('a contrast failure blocks, with both values (AC-6)', async () => {
    const low = structuredClone(EXAMPLE);
    low.color.light.text = '#777777';
    low.color.light.bg = '#ffffff';
    await writeFile(path.join(folder, 'marca', 'brand.tokens.json'), JSON.stringify(dtcgOf(low)));
    const res = run('--confirm');
    expect(res.status).toBe(1);
    expect(res.out).toContain('Contrast: light text on bg #777777 / #ffffff = 4.48:1, needs 4.5:1');
    expect(res.out).toContain('Not written');
    expect(await readFile(siteTokens(), 'utf8')).toBe('{"$comment": "example, to be replaced"}\n');
  });
});

describe('specmate tokens, a custom format through a confirmed mapping (AC-3 to AC-5)', () => {
  const file = () => path.join(folder, 'marca', 'tokens-marca.json');

  beforeEach(async () => {
    await writeFile(file(), JSON.stringify({ brand: { paper: '#FFFAF2', ink: '#1f1a14' }, radius: '0.5rem' }));
    await inventoryWith(['marca/tokens-marca.json']);
  });

  it('proposes only exact matches, lists the rest as missing and writes nothing (AC-3)', async () => {
    const res = run();
    expect(res.status).toBe(1);
    expect(res.out).toContain('Mapping proposed: 1 of 28 tokens');
    expect(res.out).toContain('Missing (27): color.light.bg, color.light.surface');
    const { tokens } = await steps();
    expect(tokens.format).toBe('custom');
    expect(tokens.mapping.radius).toBe('radius');
    expect(tokens.mapping['color.light.bg']).toBeNull();
    expect(tokens.written).toBe(false);
  });

  it('writes once the operator completes and confirms the mapping (AC-4), and stops when the file changes (AC-5)', async () => {
    const full = structuredClone(EXAMPLE);
    delete full.$comment;
    await writeFile(file(), JSON.stringify({ marca: full }));
    run();
    const json = JSON.parse(await readFile(path.join(site, 'relevamiento.json'), 'utf8'));
    for (const token of Object.keys(json.steps.tokens.mapping)) json.steps.tokens.mapping[token] = `marca.${token}`;
    await writeFile(path.join(site, 'relevamiento.json'), JSON.stringify(json, null, 2));

    const confirmed = run('--confirm');
    expect(confirmed.out + confirmed.err).toContain('Written');
    expect(confirmed.status).toBe(0);
    expect(JSON.parse(await readFile(siteTokens(), 'utf8')).color.light.bg).toBe(EXAMPLE.color.light.bg);

    full.color.light.bg = '#ffffff';
    await writeFile(file(), JSON.stringify({ marca: full }));
    const changed = run();
    expect(changed.status).toBe(0);
    expect(changed.out).toContain('the tokens file changed since the mapping was confirmed');
    expect(JSON.parse(await readFile(siteTokens(), 'utf8')).color.light.bg).toBe(EXAMPLE.color.light.bg);
    expect((await steps()).tokens).toMatchObject({ confirmed: false, written: false });
  });
});

describe('specmate tokens, usage', () => {
  it('is listed in the help', () => {
    const res = specmate(['--help'], work);
    expect(res.out).toContain('specmate tokens <slug> [--clients <dir>] [--file <path>] [--confirm]');
  });

  it('new and inventory do not take --confirm or --file', () => {
    for (const args of [
      ['new', SLUG, '--confirm'],
      ['inventory', SLUG, '--clients', work, '--file', 'x'],
    ]) {
      expect(specmate(args, work).status).toBe(2);
    }
  });
});
