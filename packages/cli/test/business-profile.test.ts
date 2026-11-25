// Rules (US-17 FR-002, FR-003, FR-005, FR-007 to FR-009, AC-2, AC-4 to AC-6; plan decisions 1 to 5): the catalog and
// its table, the validation of a proposal and of what is saved, and confirm, correct, delegate and merge.
import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  confirmField,
  emptyProfile,
  InvalidProfileStepError,
  InvalidProposalError,
  InvalidValueError,
  mergeProposal,
  parseProfileStep,
  parseProposal,
  pickField,
  setField,
  suggestionFor,
} from '../src/domain/business-profile.ts';

const SOURCES = new Set(['textos/a.txt', 'marca/manual.pdf']);
const BY = 'Harvi, specmate profile set, 2026-11-24';
const sample = { close: 'c', professional: 'p', energetic: 'e' };

const TABLE: [string, string, string][] = [
  ['peluqueria', 'book', 'close'],
  ['estetica', 'book', 'close'],
  ['restaurante', 'book', 'close'],
  ['cafeteria', 'visit', 'close'],
  ['panaderia', 'visit', 'close'],
  ['comercio', 'visit', 'close'],
  ['ferreteria', 'visit', 'close'],
  ['taller-mecanico', 'quote', 'professional'],
  ['veterinaria', 'book', 'close'],
  ['consultorio-medico', 'book', 'professional'],
  ['odontologia', 'book', 'professional'],
  ['psicologia', 'book', 'professional'],
  ['estudio-juridico', 'call', 'professional'],
  ['estudio-contable', 'quote', 'professional'],
  ['gimnasio', 'visit', 'energetic'],
  ['oficios', 'quote', 'close'],
];

describe('table of categories (FR-002, FR-005)', () => {
  it('has exactly the 16 rows, each with its suggested action and tone', () => {
    expect(CATEGORIES.map((row) => [row.id, row.action, row.tone])).toEqual(TABLE);
  });

  it('suggests from the table and gives nothing for "other"', () => {
    const profile = setField(emptyProfile(), 'business.category', 'gimnasio', BY).profile;
    expect(suggestionFor(profile, 'goal.action')).toBe('visit');
    expect(suggestionFor(profile, 'tone.choice')).toBe('energetic');
    const other = setField(emptyProfile(), 'business.category', 'other:Kiosco', BY).profile;
    expect(suggestionFor(other, 'goal.action')).toBeUndefined();
    expect(suggestionFor(other, 'tone.choice')).toBeUndefined();
  });
});

const field = (over: Record<string, unknown> = {}) => ({
  value: 'peluqueria',
  kind: 'found',
  source: 'textos/a.txt',
  quote: 'Somos una peluquería',
  ...over,
});
const reject = (proposal: unknown, naming: string) => {
  const attempt = () => parseProposal(proposal, SOURCES);
  expect(attempt).toThrow(InvalidProposalError);
  expect(attempt).toThrow(naming);
};

describe('parseProposal (FR-003, AC-2)', () => {
  it('accepts a valid proposal', () => {
    const proposal = parseProposal(
      {
        fields: {
          'business.category': field(),
          'business.audience': field({
            value: 'familias',
            kind: 'inferred',
            quote: undefined,
            source: 'marca/manual.pdf',
          }),
        },
        samples: sample,
      },
      SOURCES,
    );
    expect(proposal.fields['business.category']).toEqual({
      value: 'peluqueria',
      kind: 'found',
      source: 'textos/a.txt',
      quote: 'Somos una peluquería',
    });
    expect(proposal.fields['business.audience']?.kind).toBe('inferred');
    expect(proposal.samples).toEqual(sample);
  });

  it('accepts "other:<name>" and an empty proposal', () => {
    expect(
      parseProposal({ fields: { 'business.category': field({ value: 'other:Kiosco' }) } }, SOURCES).fields[
        'business.category'
      ]?.value,
    ).toBe('other:Kiosco');
    expect(parseProposal({}, SOURCES).fields).toEqual({});
  });

  it('rejects an unknown top-level key, naming it', () => reject({ fields: {}, extra: 1 }, 'proposal.extra'));
  it('rejects an unknown field, naming it', () =>
    reject({ fields: { 'business.name': field() } }, 'proposal.fields["business.name"]'));
  it('rejects goal.action and tone.choice: they come from the table', () => {
    reject({ fields: { 'goal.action': field({ value: 'call' }) } }, 'proposal.fields["goal.action"]');
    reject({ fields: { 'tone.choice': field({ value: 'close' }) } }, 'proposal.fields["tone.choice"]');
  });
  it('rejects a key of a field that is not known', () =>
    reject({ fields: { 'business.category': field({ confidence: 1 }) } }, '["business.category"].confidence'));
  it('rejects a category outside the catalog', () =>
    reject({ fields: { 'business.category': field({ value: 'abogado' }) } }, '["business.category"].value'));
  it('rejects "other:" with an empty or a too long name', () => {
    reject({ fields: { 'business.category': field({ value: 'other:  ' }) } }, '["business.category"].value');
    reject({ fields: { 'business.category': field({ value: `other:${'x'.repeat(61)}` }) } }, '.value');
  });
  it('rejects a text over 280 characters and an empty one', () => {
    reject({ fields: { 'business.audience': field({ value: 'x'.repeat(281) }) } }, '["business.audience"].value');
    reject({ fields: { 'business.differentiator': field({ value: ' ' }) } }, '["business.differentiator"].value');
  });
  it('rejects a kind that is not found or inferred', () =>
    reject({ fields: { 'business.category': field({ kind: 'confirmed' }) } }, '["business.category"].kind'));
  it('rejects a source outside the inventory', () => {
    reject({ fields: { 'business.category': field({ source: '../secreto.txt' }) } }, '["business.category"].source');
    reject({ fields: { 'business.category': field({ source: undefined }) } }, '["business.category"].source');
  });
  it('rejects a found value without quote, or with a quote over 300 characters', () => {
    reject({ fields: { 'business.category': field({ quote: undefined }) } }, '["business.category"].quote');
    reject({ fields: { 'business.category': field({ quote: 'q'.repeat(301) }) } }, '["business.category"].quote');
  });
  it('rejects samples with a missing tone, an extra key or a text over 240 characters', () => {
    reject({ samples: { close: 'c', professional: 'p' } }, 'proposal.samples.energetic');
    reject({ samples: { ...sample, loud: 'x' } }, 'proposal.samples.loud');
    reject({ samples: { ...sample, close: 'x'.repeat(241) } }, 'proposal.samples.close');
  });
  it('rejects what is not an object', () => {
    reject(null, 'proposal');
    reject({ fields: [] }, 'proposal.fields');
  });
  it('never lets a __proto__ key through', () => {
    reject(JSON.parse('{"fields":{"__proto__":{"value":"x"}}}'), '__proto__');
  });
});

const candidate = (over: Record<string, unknown> = {}) => ({
  value: 'peluqueria',
  state: 'found' as const,
  source: 'textos/a.txt',
  quote: 'Somos una peluquería',
  ...over,
});

describe('mergeProposal (FR-001, FR-009, AC-6)', () => {
  it('saves found and inferred, and fills action and tone from the table as inferred', () => {
    const { profile } = mergeProposal(
      emptyProfile(),
      {
        'business.category': candidate(),
        'business.audience': candidate({ value: 'familias', state: 'inferred', source: 'marca/manual.pdf' }),
      },
      sample,
    );
    expect(profile.fields['business.category']).toEqual({
      state: 'found',
      value: 'peluqueria',
      source: 'textos/a.txt',
      quote: 'Somos una peluquería',
    });
    expect(profile.fields['business.audience']).toEqual({
      state: 'inferred',
      value: 'familias',
      source: 'marca/manual.pdf',
    });
    expect(profile.fields['goal.action']).toEqual({ state: 'inferred', value: 'book', source: 'table' });
    expect(profile.fields['tone.choice']).toEqual({ state: 'inferred', value: 'close', source: 'table' });
    expect(profile.samples).toEqual({ ...sample, source: 'agent' });
  });

  it('keeps a confirmed field when a new proposal changes it, and says so', () => {
    const confirmed = setField(emptyProfile(), 'business.audience', 'jóvenes', BY).profile;
    const { profile, notices } = mergeProposal(
      confirmed,
      { 'business.audience': candidate({ value: 'familias', state: 'inferred' }) },
      undefined,
    );
    expect(profile.fields['business.audience']).toEqual(confirmed.fields['business.audience']);
    expect(notices.join('\n')).toContain('business.audience');
  });

  it('updates the fields that are still inferred or found', () => {
    const first = mergeProposal(emptyProfile(), { 'business.audience': candidate({ value: 'a' }) }, undefined).profile;
    const next = mergeProposal(first, { 'business.audience': candidate({ value: 'b', state: 'inferred' }) }, undefined);
    expect(next.profile.fields['business.audience']).toMatchObject({ state: 'inferred', value: 'b' });
  });

  it('drops the quote of an inferred value', () => {
    const { profile } = mergeProposal(
      emptyProfile(),
      { 'business.audience': candidate({ value: 'b', state: 'inferred' }) },
      undefined,
    );
    expect(profile.fields['business.audience']).not.toHaveProperty('quote');
  });
});

describe('setField, confirmField, pickField (FR-007, FR-008, AC-4, AC-5)', () => {
  it('"pick" takes the table action, confirmed and marked as delegated', () => {
    const base = setField(emptyProfile(), 'business.category', 'peluqueria', BY).profile;
    const { profile } = pickField(base, 'goal.action', 'Harvi, specmate profile pick, 2026-11-24');
    expect(profile.fields['goal.action']).toEqual({
      state: 'confirmed',
      value: 'book',
      source: 'table',
      confirmedBy: 'Harvi, specmate profile pick, 2026-11-24',
      delegated: true,
    });
  });

  it('"pick" without a suggestion says so and changes nothing', () => {
    const other = setField(emptyProfile(), 'business.category', 'other:Kiosco', BY).profile;
    expect(() => pickField(other, 'goal.action', BY)).toThrow(InvalidValueError);
    expect(() => pickField(other, 'goal.action', BY)).toThrow('goal.action: there is no suggestion');
    expect(() => pickField(emptyProfile(), 'business.audience', BY)).toThrow(
      'business.audience: there is no suggestion',
    );
  });

  it('"pick" takes the value a proposal gave for a text field', () => {
    const merged = mergeProposal(emptyProfile(), { 'business.audience': candidate({ value: 'familias' }) }, undefined);
    const { profile } = pickField(merged.profile, 'business.audience', BY);
    expect(profile.fields['business.audience']).toMatchObject({
      state: 'confirmed',
      value: 'familias',
      delegated: true,
    });
  });

  it('"confirm" confirms what was inferred as it is, not delegated', () => {
    const merged = mergeProposal(emptyProfile(), { 'business.audience': candidate({ value: 'familias' }) }, undefined);
    const { profile } = confirmField(merged.profile, 'business.audience', BY);
    expect(profile.fields['business.audience']).toEqual({
      state: 'confirmed',
      value: 'familias',
      source: 'textos/a.txt',
      quote: 'Somos una peluquería',
      confirmedBy: BY,
      delegated: false,
    });
  });

  it('"confirm" of a missing field fails naming it', () => {
    expect(() => confirmField(emptyProfile(), 'business.audience', BY)).toThrow(
      'business.audience: nothing to confirm',
    );
  });

  it('"set" confirms a value of Harvi and rejects one outside the catalog, naming the field', () => {
    const { profile } = setField(emptyProfile(), 'goal.action', 'whatsapp', BY);
    expect(profile.fields['goal.action']).toEqual({
      state: 'confirmed',
      value: 'whatsapp',
      confirmedBy: BY,
      delegated: false,
    });
    expect(() => setField(emptyProfile(), 'goal.action', 'shout', BY)).toThrow(InvalidValueError);
    expect(() => setField(emptyProfile(), 'goal.action', 'shout', BY)).toThrow('goal.action');
    expect(() => setField(emptyProfile(), 'tone.choice', 'loud', BY)).toThrow('tone.choice');
  });

  it('changing the category keeps a confirmed action and tone and warns the new category suggests another', () => {
    let profile = setField(emptyProfile(), 'business.category', 'peluqueria', BY).profile;
    profile = setField(profile, 'goal.action', 'call', BY).profile;
    profile = setField(profile, 'tone.choice', 'close', BY).profile;
    const changed = setField(profile, 'business.category', 'gimnasio', BY);
    expect(changed.profile.fields['goal.action']).toMatchObject({ state: 'confirmed', value: 'call' });
    expect(changed.profile.fields['tone.choice']).toMatchObject({ state: 'confirmed', value: 'close' });
    const text = changed.notices.join('\n');
    expect(text).toContain('goal.action');
    expect(text).toContain('visit');
    expect(text).toContain('tone.choice');
    expect(text).toContain('energetic');
  });

  it('changing the category recalculates the inferred suggestions, and "other" clears them', () => {
    let profile = setField(emptyProfile(), 'business.category', 'peluqueria', BY).profile;
    expect(profile.fields['goal.action']).toMatchObject({ state: 'inferred', value: 'book' });
    profile = setField(profile, 'business.category', 'gimnasio', BY).profile;
    expect(profile.fields['goal.action']).toMatchObject({ state: 'inferred', value: 'visit' });
    profile = setField(profile, 'business.category', 'other:Kiosco', BY).profile;
    expect(profile.fields['goal.action']).toBeUndefined();
    expect(profile.fields['tone.choice']).toBeUndefined();
  });

  it('does not warn when the confirmed action is the one the new category suggests', () => {
    let profile = setField(emptyProfile(), 'business.category', 'peluqueria', BY).profile;
    profile = setField(profile, 'goal.action', 'visit', BY).profile;
    expect(setField(profile, 'business.category', 'gimnasio', BY).notices).toEqual([]);
  });
});

describe('parseProfileStep (plan decision 5)', () => {
  it('reads an absent step as empty', () => {
    expect(parseProfileStep(undefined)).toEqual(emptyProfile());
  });

  it('round-trips what the operations produce', () => {
    const { profile } = setField(emptyProfile(), 'business.category', 'peluqueria', BY);
    expect(parseProfileStep(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });

  it.each([
    [{ version: 2, fields: {} }, 'steps.profile.version'],
    [{ version: 1, fields: [] }, 'steps.profile.fields'],
    [
      { version: 1, fields: { 'business.name': { state: 'found', value: 'x' } } },
      'steps.profile.fields["business.name"]',
    ],
    [
      { version: 1, fields: { 'goal.action': { state: 'maybe', value: 'call' } } },
      'steps.profile.fields["goal.action"].state',
    ],
    [
      {
        version: 1,
        fields: { 'goal.action': { state: 'confirmed', value: 'shout', confirmedBy: 'x', delegated: false } },
      },
      'steps.profile.fields["goal.action"].value',
    ],
    [
      { version: 1, fields: { 'goal.action': { state: 'confirmed', value: 'call', delegated: false } } },
      'steps.profile.fields["goal.action"].confirmedBy',
    ],
    [{ version: 1, fields: {}, samples: { close: 'c' } }, 'steps.profile.samples.professional'],
  ])('fails naming the field of a step with another shape: %#', (saved, naming) => {
    expect(() => parseProfileStep(saved)).toThrow(InvalidProfileStepError);
    expect(() => parseProfileStep(saved)).toThrow(naming);
  });
});

// Security review of US-17: a value that looks like a secret, or has control or invisible characters, is never saved.
const SECRETS = [
  ['a PEM header', '-----BEGIN PRIVATE KEY-----'],
  ['an AWS key id', 'AKIAIOSFODNN7EXAMPLE'],
  ['an sk- key', 'usa sk-proj-abc123 para entrar'],
  ['a GitHub token', 'ghp_abcdefghijklmnop'],
  ['a GitHub fine-grained token', 'github_pat_11ABCDEFG'],
  ['a Slack token', 'xoxb-1234-abcd'],
  ['24 characters of base64', 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldY'],
  ['a long hex string', 'deadbeefdeadbeefdeadbeef'],
] as const;
const UNSAFE = [
  ['an escape', `corte${String.fromCharCode(27)}[31m`],
  ['a bidi override', `corte${String.fromCharCode(0x202e)}rojo`],
  ['a line break', 'corte\nrojo'],
  ['a zero width space', `corte${String.fromCharCode(0x200b)}rojo`],
] as const;

describe('values that look like a secret or hide characters', () => {
  it.each(SECRETS)('set rejects %s, naming the field', (_name, value) => {
    expect(() => setField(emptyProfile(), 'business.audience', value, BY)).toThrow(InvalidValueError);
    expect(() => setField(emptyProfile(), 'business.audience', value, BY)).toThrow(
      'business.audience: looks like a secret: it is not saved',
    );
  });
  it.each(SECRETS)('a proposal field with %s is rejected, naming the field', (_name, value) =>
    reject(
      { fields: { 'business.differentiator': field({ value, kind: 'inferred', quote: undefined }) } },
      '["business.differentiator"].value looks like a secret: it is not saved',
    ),
  );
  it.each(SECRETS)('a sample with %s is rejected, naming the tone', (_name, value) =>
    reject({ samples: { ...sample, professional: value } }, 'proposal.samples.professional looks like a secret'),
  );
  it.each(UNSAFE)('set rejects %s, naming the field', (_name, value) => {
    expect(() => setField(emptyProfile(), 'business.audience', value, BY)).toThrow(
      'business.audience: has control or invisible characters',
    );
  });
  it.each(UNSAFE)('a proposal field with %s is rejected, naming the field', (_name, value) =>
    reject(
      { fields: { 'business.audience': field({ value, kind: 'inferred', quote: undefined }) } },
      '["business.audience"].value has control or invisible characters',
    ),
  );
  it.each(UNSAFE)('a sample with %s is rejected, naming the tone', (_name, value) =>
    reject(
      { samples: { ...sample, energetic: value } },
      'proposal.samples.energetic has control or invisible characters',
    ),
  );
  it('keeps accepting an ordinary sentence with accents and punctuation', () => {
    const text = 'Atendemos a familias del barrio, con turno o sin él: ¡venite!';
    expect(setField(emptyProfile(), 'business.audience', text, BY).profile.fields['business.audience']?.value).toBe(
      text,
    );
  });
});
