// Rule (ADR-0041, plan decision 7; principle IX): the CLI calls no model. This fails if the CLI declares a package of a
// model SDK, if any of its sources reads the key of an AI provider or imports such a package, or if the `client-reader`
// role (the only thing that reads client text with a model) is allowed anything but reading.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cliDir = fileURLToPath(new URL('..', import.meta.url));
const repoDir = path.resolve(cliDir, '..', '..');
const ROLE = path.join(repoDir, '.agents', 'roles', 'client-reader.md');

const SDK_PACKAGE = /anthropic|openai|@google\/generative|mistral|cohere|ollama|langchain/i;
const PROVIDER_KEY = /(ANTHROPIC|OPENAI|GEMINI|GOOGLE_API)\w*/;
const IMPORT_SPECIFIER = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

/** Names of the packages a package.json declares, in any section. */
function declaredPackages(manifest: Record<string, unknown>): string[] {
  return DEPENDENCY_SECTIONS.flatMap((section) => Object.keys((manifest[section] as object | undefined) ?? {}));
}

/** What in a source file reads a provider key or imports a model SDK. */
function modelUses(source: string): string[] {
  const found = source.match(PROVIDER_KEY) ? [`reads ${source.match(PROVIDER_KEY)?.[0]}`] : [];
  for (const match of source.matchAll(IMPORT_SPECIFIER))
    if (SDK_PACKAGE.test(match[1] ?? '')) found.push(`imports ${match[1]}`);
  return found;
}

/** The frontmatter of a role as `key -> raw value`; fails if there is none. */
function frontmatter(markdown: string): Map<string, string> {
  const match = markdown.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('the role has no frontmatter');
  const keys = new Map<string, string>();
  for (const line of (match[1] ?? '').split('\n')) {
    const entry = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (entry) keys.set(entry[1] as string, (entry[2] ?? '').trim());
  }
  return keys;
}

/** Why a role is not read only, or none. */
function roleProblems(markdown: string): string[] {
  const keys = frontmatter(markdown);
  const problems: string[] = [];
  if (keys.get('capabilities')?.replace(/\s+/g, '') !== '[read]') problems.push('capabilities must be exactly [read]');
  if (keys.has('mcp')) problems.push('mcp must not be declared');
  return problems;
}

async function sources(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...(await sources(full)));
    else if (item.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

describe('the CLI declares no model SDK', () => {
  it('has none in packages/cli/package.json', async () => {
    const manifest = JSON.parse(await readFile(path.join(cliDir, 'package.json'), 'utf8'));
    expect(declaredPackages(manifest).filter((name) => SDK_PACKAGE.test(name))).toEqual([]);
  });

  it('would fail on a manifest that declares one, in any section', () => {
    for (const section of DEPENDENCY_SECTIONS)
      for (const name of [
        '@anthropic-ai/sdk',
        'openai',
        '@google/generative-ai',
        '@mistralai/mistralai',
        'cohere-ai',
        'ollama',
        '@langchain/core',
      ])
        expect(declaredPackages({ [section]: { [name]: '1.0.0' } }).filter((n) => SDK_PACKAGE.test(n))).toEqual([name]);
  });
});

describe('the CLI sources read no provider key and import no model SDK', () => {
  it('has none under packages/cli/src', async () => {
    const files = await sources(path.join(cliDir, 'src'));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files)
      for (const use of modelUses(await readFile(file, 'utf8')))
        offenders.push(`${path.relative(cliDir, file)} ${use}`);
    expect(offenders).toEqual([]);
  });

  it('would fail on a source that reads a provider key or imports an SDK', () => {
    for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'])
      expect(modelUses(`const k = process.env.${key};`)).toEqual([`reads ${key}`]);
    expect(modelUses("import Anthropic from '@anthropic-ai/sdk';")).toEqual(['imports @anthropic-ai/sdk']);
    expect(modelUses("const o = await import('openai');")).toEqual(['imports openai']);
    expect(modelUses("const o = require('ollama');")).toEqual(['imports ollama']);
    expect(modelUses("import { node } from 'node:path';")).toEqual([]);
  });
});

describe('the client-reader role only reads (ADR-0041)', () => {
  it('has capabilities [read] and no mcp', async () => {
    const text = await readFile(ROLE, 'utf8').catch(() => {
      throw new Error(`${ROLE} does not exist: the role that reads the client's texts must be written first`);
    });
    expect(roleProblems(text)).toEqual([]);
  });

  it('would fail on a role with more capabilities, another list, or an mcp of any value', () => {
    const role = (lines: string) => `---\nname: x\n${lines}\n---\nbody\n`;
    expect(roleProblems(role('capabilities: [read]'))).toEqual([]);
    expect(roleProblems(role('capabilities: [ read ]\nmcp: []'))).toEqual(['mcp must not be declared']);
    expect(roleProblems(role('capabilities: [read, write]'))).toEqual(['capabilities must be exactly [read]']);
    expect(roleProblems(role('capabilities: [read, execute]'))).toHaveLength(1);
    expect(roleProblems(role('name2: y'))).toEqual(['capabilities must be exactly [read]']);
    expect(roleProblems(role('capabilities: [read]\nmcp: [playwright]'))).toEqual(['mcp must not be declared']);
  });
});
