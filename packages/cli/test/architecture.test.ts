// Rule (US-13 FR-008, FR-009, AC-7, AC-8, AC-9; ADR-0034): domain imports only domain; application imports only
// domain and application (no node:*, no packages); infrastructure never imports cli; every file lives in a layer;
// no file builds a path by concatenating "/" or "\\". The rule is proven on invented violations, then on src/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkArchitecture } from './lib/architecture.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', 'arch', name);

describe('architecture rule, on invented violations', () => {
  it('accepts a valid layering', async () => {
    expect(await checkArchitecture(fixture('valid'))).toEqual([]);
  });

  it.each([
    ['domain-imports-infra', /domain[\\/]x\.ts: domain imports \.\.\/infrastructure\/y\.ts/],
    ['application-imports-fs', /application[\\/]x\.ts: application imports node:fs\/promises/],
    ['application-imports-cli', /application[\\/]x\.ts: application imports \.\.\/cli\/y\.ts/],
    ['path-concat', /infrastructure[\\/]x\.ts: builds a path by concatenating a separator/],
    ['outside-layer', /stray\.ts: outside the layers/],
  ])('fails on %s, naming the file and the import', async (name, expected) => {
    const problems = await checkArchitecture(fixture(name));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(expected);
  });
});

describe('architecture rule, on the real code', () => {
  it('src/ has the 3 layers plus cli, and respects the rule', async () => {
    const src = path.join(here, '..', 'src');
    expect(await checkArchitecture(src, { requireLayers: true })).toEqual([]);
  });
});
