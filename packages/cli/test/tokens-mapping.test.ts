// Rule (US-16 FR-003 to FR-005, FR-009, AC-3, AC-5; plan decisions 3, 8): the mapping is proposed only for exact path
// matches; a saved mapping wins token by token; the confirmation holds only for the file hash it was given; a token
// without a value is missing and a value that cannot be converted is a problem, never a default.
import { describe, expect, it } from 'vitest';
import {
  buildContractTokens,
  InvalidTokensStepError,
  mergeMapping,
  proposeMapping,
  readTokensFile,
  translate,
} from '../src/domain/design-tokens.ts';

const CONTRACT = ['color.light.bg', 'color.light.text', 'font.family', 'space.1'] as const;
const custom = readTokensFile(
  JSON.stringify({ color: { light: { bg: '#FFFFFF' } }, brand: { ink: '#111111', type: ['Inter', 'sans-serif'] } }),
);
const source = { path: 'marca/brand.tokens.json', sha256: 'aaa' };

describe('proposeMapping', () => {
  it('maps only the contract paths that exist as is, and leaves the rest null', () => {
    expect(proposeMapping(CONTRACT, custom)).toEqual({
      'color.light.bg': 'color.light.bg',
      'color.light.text': null,
      'font.family': null,
      'space.1': null,
    });
  });
});

describe('mergeMapping', () => {
  const proposed = proposeMapping(CONTRACT, custom);

  it('without a saved step, takes the proposal, unconfirmed unless --confirm', () => {
    expect(mergeMapping(undefined, { contract: CONTRACT, proposed, source, confirm: false })).toEqual({
      mapping: proposed,
      confirmed: false,
      notices: [],
    });
    expect(mergeMapping(undefined, { contract: CONTRACT, proposed, source, confirm: true }).confirmed).toBe(true);
  });

  it('keeps what the operator wrote, token by token, and the confirmation for the same hash', () => {
    const saved = {
      source,
      mapping: { 'color.light.bg': null, 'color.light.text': 'brand.ink', 'font.family': 'brand.type' },
      confirmed: true,
    };
    expect(mergeMapping(saved, { contract: CONTRACT, proposed, source, confirm: false })).toEqual({
      mapping: {
        'color.light.bg': null,
        'color.light.text': 'brand.ink',
        'font.family': 'brand.type',
        'space.1': null,
      },
      confirmed: true,
      notices: [],
    });
  });

  it('loses the confirmation when the file changed, and says so (AC-5)', () => {
    const saved = { source, mapping: proposed, confirmed: true };
    const merged = mergeMapping(saved, {
      contract: CONTRACT,
      proposed,
      source: { ...source, sha256: 'bbb' },
      confirm: false,
    });
    expect(merged.confirmed).toBe(false);
    expect(merged.notices).toEqual([
      'the tokens file changed since the mapping was confirmed: review it and run again with --confirm',
    ]);
  });

  it('starts over when another file is chosen', () => {
    const saved = {
      source: { path: 'otro/tokens.json', sha256: 'aaa' },
      mapping: { 'font.family': 'x' },
      confirmed: true,
    };
    expect(mergeMapping(saved, { contract: CONTRACT, proposed, source, confirm: false })).toEqual({
      mapping: proposed,
      confirmed: false,
      notices: [
        'the tokens file is now marca/brand.tokens.json (was otro/tokens.json): the mapping was proposed again',
      ],
    });
  });

  it.each([
    ['not an object', 'x', 'steps.tokens must be an object'],
    [
      'a source without a hash',
      { source: { path: 'a' }, mapping: {}, confirmed: false },
      'steps.tokens.source.sha256 must be a string',
    ],
    [
      'a mapping to a number',
      { source, mapping: { 'font.family': 3 }, confirmed: false },
      'steps.tokens.mapping["font.family"] must be a path or null',
    ],
    [
      'an unknown contract token',
      { source, mapping: { 'font.weight': 'x' }, confirmed: false },
      'steps.tokens.mapping["font.weight"] is not a token of the template contract',
    ],
    ['confirmed as text', { source, mapping: {}, confirmed: 'yes' }, 'steps.tokens.confirmed must be true or false'],
  ])('refuses a saved step that is %s, naming the field', (_, saved, message) => {
    expect(() => mergeMapping(saved, { contract: CONTRACT, proposed, source, confirm: false })).toThrow(
      new InvalidTokensStepError(message),
    );
  });
});

describe('translate', () => {
  it('converts the mapped values, lists null as missing and a bad value as a problem, with no default (FR-005, FR-006)', () => {
    const result = translate(
      CONTRACT,
      {
        'color.light.bg': 'color.light.bg',
        'color.light.text': 'brand.type',
        'font.family': 'brand.type',
        'space.1': null,
      },
      custom,
    );
    expect(Object.fromEntries(result.values)).toEqual({
      'color.light.bg': '#ffffff',
      'font.family': 'Inter, sans-serif',
    });
    expect(result.missing).toEqual(['space.1']);
    expect(result.problems).toEqual([
      {
        token: 'color.light.text',
        source: 'brand.type',
        value: ['Inter', 'sans-serif'],
        reason: 'expected a color as #rrggbb',
      },
    ]);
  });

  it('a mapped path that is not in the file is a problem', () => {
    const result = translate(['space.1'], { 'space.1': 'brand.spacing' }, custom);
    expect(result.problems).toEqual([
      { token: 'space.1', source: 'brand.spacing', reason: 'brand.spacing is not in the tokens file' },
    ]);
  });

  it('carries the problems found while reading the file', () => {
    const file = readTokensFile(JSON.stringify({ 'a.b': '#000000' }));
    expect(translate([], {}, file).problems).toEqual(file.problems);
  });
});

describe('buildContractTokens', () => {
  it('nests the values by path, in contract order, with a comment naming the source', () => {
    const values = new Map<string, string | number>([
      ['space.1', '0.5rem'],
      ['color.light.bg', '#ffffff'],
      ['font.family', 'Inter'],
      ['color.light.text', '#111111'],
    ]);
    const tokens = buildContractTokens(CONTRACT, values, 'marca/brand.tokens.json');
    expect(JSON.stringify(tokens)).toBe(
      JSON.stringify({
        $comment:
          "From the client's tokens file marca/brand.tokens.json, mapped and confirmed in steps.tokens of relevamiento.json.",
        color: { light: { bg: '#ffffff', text: '#111111' } },
        font: { family: 'Inter' },
        space: { 1: '0.5rem' },
      }),
    );
  });
});
