// Rule (US-15 FR-003 to FR-008, AC-1, AC-3, AC-5, AC-6, AC-8, AC-12; plan "Comando"): `specmate inventory <slug>` run
// as a real process. The client folder is <root>/<slug>, the root comes from --clients or SPECMATE_CLIENTS_DIR and
// cannot be inside the SpecMate repo; the result goes to steps.inventory of ./<slug>/relevamiento.json, keeping the
// rest of the file, and the client folder is left untouched. Clients and sites are invented, in the system temp dir.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
const specmateRepo = fileURLToPath(new URL('../../..', import.meta.url));
const SLUG = 'cliente-inventado';

function specmate(args: string[], cwd: string, env: Record<string, string | undefined> = {}) {
  const base = { ...process.env };
  delete base.SPECMATE_CLIENTS_DIR;
  const res = spawnSync(process.execPath, [entry, ...args], { cwd, env: { ...base, ...env }, encoding: 'utf8' });
  return { status: res.status, out: res.stdout, err: res.stderr };
}

const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const png = (w: number, h: number) =>
  Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32be(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...u32be(w),
    ...u32be(h),
  ]);

async function treeHashes(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    const file = path.join(e.parentPath, e.name);
    out[path.relative(dir, file)] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  }
  return out;
}

const RELEVAMIENTO = {
  $schemaVersion: 1,
  $comment: 'Invented client for a test, not a real business.',
  brief: { name: { value: 'Cliente Inventado', source: 'test', confirmedBy: 'test' } },
  steps: { other: { keep: true } },
};

let work: string;
let clients: string;
let folder: string;
let sites: string;
let relevamiento: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'specmate-inventory-'));
  clients = path.join(work, 'clientes');
  folder = path.join(clients, SLUG);
  sites = path.join(work, 'sitios');
  relevamiento = path.join(sites, SLUG, 'relevamiento.json');
  await mkdir(path.join(folder, 'fotos'), { recursive: true });
  await mkdir(path.join(sites, SLUG), { recursive: true });
  await writeFile(path.join(folder, 'Guía de Marca.pdf'), '%PDF invented');
  await writeFile(path.join(folder, 'logo.png'), png(400, 200));
  await writeFile(path.join(folder, 'fotos', 'vidriera.png'), png(2000, 1333));
  await writeFile(path.join(folder, 'fotos', 'chica.png'), png(600, 400));
  await writeFile(path.join(folder, 'planilla.xlsx'), 'invented sheet');
  await writeFile(path.join(folder, '.DS_Store'), 'mac');
  await writeFile(path.join(folder, '.env'), 'TOKEN=supersecreto');
  await writeFile(relevamiento, `${JSON.stringify(RELEVAMIENTO, null, 2)}\n`);
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const saved = async () => JSON.parse(await readFile(relevamiento, 'utf8'));

describe('specmate inventory <slug>', () => {
  it('shows found, missing and notices, and saves steps.inventory keeping the rest of the file (AC-1, AC-3)', async () => {
    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
    for (const line of [
      'Found',
      'brand-manual: Guía de Marca.pdf',
      'logo: logo.png (400×200)',
      'photo: fotos/chica.png (600×400, low-resolution)',
      'photo: fotos/vidriera.png (2000×1333)',
      'unclassified: planilla.xlsx',
      'secret: .env (possible-secret-not-read)',
      'Missing: text, prices, tokens',
      'Ignored: 1',
    ]) {
      expect(res.out).toContain(line);
    }
    expect(res.out).not.toContain('supersecreto'); // the content of .env is never shown

    const json = await saved();
    const { inventory, ...otherSteps } = json.steps;
    expect({ ...json, steps: otherSteps }).toEqual(RELEVAMIENTO);
    expect(Object.keys(json)).toEqual(Object.keys(RELEVAMIENTO));
    expect(inventory.version).toBe(1);
    expect(inventory.missing).toEqual(['text', 'prices', 'tokens']);
    expect(inventory.entries.map((e: { path: string; kind: string }) => [e.path, e.kind])).toEqual([
      ['.env', 'secret'],
      ['Guía de Marca.pdf', 'brand-manual'], // sorted by code unit: stable on every platform
      ['fotos/chica.png', 'photo'],
      ['fotos/vidriera.png', 'photo'],
      ['logo.png', 'logo'],
      ['planilla.xlsx', 'unclassified'],
    ]);
    expect(JSON.stringify(inventory)).not.toContain('TOKEN');
    expect(await readFile(relevamiento, 'utf8')).toMatch(/\n$/);
    expect(await readFile(relevamiento, 'utf8')).not.toContain('\r');
  });

  it('shows a file name with bidi controls escaped, never raw on the terminal', async () => {
    const rlo = String.fromCharCode(0x202e); // right-to-left override
    await writeFile(path.join(folder, `foto${rlo}gpj.exe`), 'invented');
    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.status).toBe(0);
    expect(res.out).toContain('foto\\u202egpj.exe');
    expect(res.out).not.toContain(rlo);
  });

  it('leaves the client folder identical (AC-12)', async () => {
    const before = await treeHashes(folder);
    expect(specmate(['inventory', SLUG, '--clients', clients], sites).status).toBe(0);
    expect(await treeHashes(folder)).toEqual(before);
  });

  it('keeps a correction by hand, adds a new file and marks a deleted one as gone (AC-5, AC-6, SC-002)', async () => {
    expect(specmate(['inventory', SLUG, '--clients', clients], sites).status).toBe(0);
    const first = await saved();
    const planilla = first.steps.inventory.entries.find((e: { path: string }) => e.path === 'planilla.xlsx');
    planilla.kind = 'prices';
    await writeFile(relevamiento, `${JSON.stringify(first, null, 2)}\n`);
    await unlink(path.join(folder, 'logo.png'));
    await writeFile(path.join(folder, 'historia.md'), '# invented');

    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.status).toBe(0);
    expect(res.out).toContain('prices: planilla.xlsx (corrected by hand)');
    expect(res.out).toContain('Gone: logo.png');
    const entries = (await saved()).steps.inventory.entries;
    expect(entries).toContainEqual(
      expect.objectContaining({
        path: 'planilla.xlsx',
        kind: 'prices',
        detectedKind: 'unclassified',
        correctedBy: 'manual',
      }),
    );
    expect(entries).toContainEqual(expect.objectContaining({ path: 'logo.png', status: 'gone' }));
    expect(entries).toContainEqual(expect.objectContaining({ path: 'historia.md', kind: 'text' }));

    const second = await readFile(relevamiento, 'utf8');
    expect(specmate(['inventory', SLUG, '--clients', clients], sites).status).toBe(0);
    expect(await readFile(relevamiento, 'utf8')).toBe(second);
  });
});

describe('specmate inventory, the clients root (AC-8, FR-007)', () => {
  it('takes it from SPECMATE_CLIENTS_DIR', () => {
    expect(specmate(['inventory', SLUG], sites, { SPECMATE_CLIENTS_DIR: clients }).status).toBe(0);
  });

  it('--clients wins over SPECMATE_CLIENTS_DIR', () => {
    const res = specmate(['inventory', SLUG, '--clients', clients], sites, {
      SPECMATE_CLIENTS_DIR: path.join(work, 'nada'),
    });
    expect(res.err).toBe('');
    expect(res.status).toBe(0);
  });

  it('without either, it is wrong usage naming both', () => {
    const res = specmate(['inventory', SLUG], sites);
    expect(res.status).toBe(2);
    expect(res.err).toMatch(/--clients.*SPECMATE_CLIENTS_DIR/);
  });

  it('fails when the clients root is inside the SpecMate repo, without reading anything', async () => {
    const res = specmate(['inventory', 'packages', '--clients', specmateRepo], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain('inside the SpecMate repo');
  });

  it('fails when the client folder is inside the SpecMate repo through a junction', async () => {
    const { symlink } = await import('node:fs/promises');
    await symlink(path.join(specmateRepo, 'specs'), path.join(clients, 'atajo'), 'junction');
    await mkdir(path.join(sites, 'atajo'));
    await writeFile(path.join(sites, 'atajo', 'relevamiento.json'), '{"steps":{}}\n');
    const res = specmate(['inventory', 'atajo', '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain('inside the SpecMate repo');
  });
});

describe('specmate inventory, failures', () => {
  it('fails naming the client folder when it does not exist', () => {
    const res = specmate(['inventory', 'otro-cliente', '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain(path.join(clients, 'otro-cliente'));
  });

  it('fails naming relevamiento.json when the site has none', async () => {
    await rm(relevamiento);
    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain(relevamiento);
  });

  it('fails without touching relevamiento.json when it is not valid JSON', async () => {
    await writeFile(relevamiento, '{ "brief": ');
    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain('relevamiento.json');
    expect(await readFile(relevamiento, 'utf8')).toBe('{ "brief": ');
  });

  it('fails naming the entry when steps.inventory was edited into an unknown kind', async () => {
    expect(specmate(['inventory', SLUG, '--clients', clients], sites).status).toBe(0);
    const json = await saved();
    json.steps.inventory.entries[0].kind = 'fotos';
    await writeFile(relevamiento, JSON.stringify(json));
    const res = specmate(['inventory', SLUG, '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain('steps.inventory.entries[0].kind "fotos"');
  });

  it.each([
    [['inventory']],
    [['inventory', 'a', 'b']],
    [['inventory', '--force', SLUG]],
    [['new', '--clients', 'x', 'a']],
  ])('wrong usage %j exits 2 with the usage text', (args) => {
    const res = specmate(args, sites, { SPECMATE_CLIENTS_DIR: clients });
    expect(res.status).toBe(2);
    expect(res.err).toContain('specmate inventory <slug> [--clients <dir>]');
  });

  it('rejects an invalid slug before touching anything', () => {
    const res = specmate(['inventory', '../afuera', '--clients', clients], sites);
    expect(res.status).toBe(1);
    expect(res.err).toContain('invalid slug');
  });
});
