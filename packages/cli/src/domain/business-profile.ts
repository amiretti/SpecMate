// Steps 2 to 4 of the relevamiento: the business, the main action and the tone (US-17, ADR-0041). Everything here is
// deterministic: the action and the tone come from a table by category, never from a model, and a proposal made by an
// agent is data that is validated field by field before anything is saved (principle V). Nothing inferred becomes
// confirmed without an action of Harvi (principle XI).
import { SpecmateError } from './errors.ts';
import { MAX_QUOTE } from './quote.ts';

export type Action = 'call' | 'whatsapp' | 'book' | 'visit' | 'quote';
export type Tone = 'close' | 'professional' | 'energetic';

export const ACTIONS: readonly Action[] = ['call', 'whatsapp', 'book', 'visit', 'quote'];
export const TONES: readonly Tone[] = ['close', 'professional', 'energetic'];

export const TEXT_MAX = 280;
export const OTHER_MAX = 60;
export const SAMPLE_MAX = 240;

export interface CategoryRow {
  id: string;
  /** Suggested main action (FR-005). */
  action: Action;
  /** Suggested tone (FR-005). */
  tone: Tone;
  /** Data the category requires beyond the common ones, for US-19. */
  required: readonly string[];
}

const row = (id: string, action: Action, tone: Tone, required: readonly string[] = []): CategoryRow => ({
  id,
  action,
  tone,
  required,
});

/** The closed catalog (plan decision 2). Adding a category is one line here. */
export const CATEGORIES: readonly CategoryRow[] = [
  row('peluqueria', 'book', 'close'),
  row('estetica', 'book', 'close'),
  row('restaurante', 'book', 'close'),
  row('cafeteria', 'visit', 'close'),
  row('panaderia', 'visit', 'close'),
  row('comercio', 'visit', 'close'),
  row('ferreteria', 'visit', 'close'),
  row('taller-mecanico', 'quote', 'professional'),
  row('veterinaria', 'book', 'close', ['license-number']),
  row('consultorio-medico', 'book', 'professional', ['license-number']),
  row('odontologia', 'book', 'professional', ['license-number']),
  row('psicologia', 'book', 'professional', ['license-number']),
  row('estudio-juridico', 'call', 'professional', ['bar-registration']),
  row('estudio-contable', 'quote', 'professional', ['professional-registration']),
  row('gimnasio', 'visit', 'energetic'),
  row('oficios', 'quote', 'close'),
];

export const FIELD_NAMES = [
  'business.category',
  'business.differentiator',
  'business.audience',
  'goal.action',
  'tone.choice',
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

/** The fields an agent may propose: the action and the tone come from the table (ADR-0041 point 4). */
export const PROPOSABLE: readonly FieldName[] = ['business.category', 'business.differentiator', 'business.audience'];

/** The three steps, in order, with their fields (ADR-0031 steps 2 to 4). */
export const STEPS: readonly { number: number; title: string; fields: readonly FieldName[] }[] = [
  { number: 2, title: 'business', fields: ['business.category', 'business.differentiator', 'business.audience'] },
  { number: 3, title: 'goal', fields: ['goal.action'] },
  { number: 4, title: 'tone', fields: ['tone.choice'] },
];

export type State = 'found' | 'inferred' | 'confirmed';
const STATES: readonly string[] = ['missing', 'found', 'inferred', 'confirmed'];

export interface FieldValue {
  state: State;
  value: string;
  /** A file of the inventory, or "table". */
  source?: string;
  quote?: string;
  confirmedBy?: string;
  delegated?: boolean;
}

export interface Samples extends Record<Tone, string> {
  source: 'agent';
}

/** `steps.profile` (plan decision 5). A field that is missing is simply not there. */
export interface Profile {
  version: 1;
  fields: Partial<Record<FieldName, FieldValue>>;
  samples?: Samples;
}

export const emptyProfile = (): Profile => ({ version: 1, fields: {} });

export class InvalidProposalError extends SpecmateError {}
export class InvalidProfileStepError extends SpecmateError {}
export class InvalidValueError extends SpecmateError {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const length = (text: string) => [...text].length;
export const isFieldName = (name: string): name is FieldName => (FIELD_NAMES as readonly string[]).includes(name);
const rowOf = (category: string | undefined) => CATEGORIES.find((candidate) => candidate.id === category);

const OTHER = 'other:';

/** Why `value` is not valid for `name`, or undefined when it is. */
function valueProblem(name: FieldName, value: unknown): string | undefined {
  if (typeof value !== 'string') return 'must be text';
  const text = value.trim();
  switch (name) {
    case 'business.category': {
      if (rowOf(text)) return undefined;
      if (text.startsWith(OTHER)) {
        const given = text.slice(OTHER.length).trim();
        if (given === '') return 'needs a name after "other:"';
        return length(given) > OTHER_MAX ? `the name after "other:" is longer than ${OTHER_MAX} characters` : undefined;
      }
      return `${JSON.stringify(text)} is not one of: ${CATEGORIES.map((c) => c.id).join(', ')}, other:<name>`;
    }
    case 'goal.action':
      return (ACTIONS as readonly string[]).includes(text) ? undefined : `must be one of: ${ACTIONS.join(', ')}`;
    case 'tone.choice':
      return (TONES as readonly string[]).includes(text) ? undefined : `must be one of: ${TONES.join(', ')}`;
    default:
      if (text === '') return 'must not be empty';
      return length(text) > TEXT_MAX ? `is longer than ${TEXT_MAX} characters` : undefined;
  }
}

function normalizeValue(name: FieldName, value: string): string {
  const text = value.trim();
  return name === 'business.category' && text.startsWith(OTHER) ? `${OTHER}${text.slice(OTHER.length).trim()}` : text;
}

/** The action or the tone the table suggests for the current category, or the value a proposal gave for a text field. */
export function suggestionFor(profile: Profile, name: FieldName): string | undefined {
  if (name === 'goal.action') return rowOf(profile.fields['business.category']?.value)?.action;
  if (name === 'tone.choice') return rowOf(profile.fields['business.category']?.value)?.tone;
  const current = profile.fields[name];
  return current && current.state !== 'confirmed' ? current.value : undefined;
}

// ---- the proposal (FR-003; plan decision 3) ----

export interface ProposedField {
  value: string;
  kind: 'found' | 'inferred';
  source: string;
  quote?: string;
}

export interface Proposal {
  fields: Partial<Record<FieldName, ProposedField>>;
  samples?: Record<Tone, string>;
}

const PROPOSED_KEYS = ['value', 'kind', 'source', 'quote'];

/** Validates a proposal whole; fails naming the first field that does not hold. `sources` are the inventory's files. */
export function parseProposal(input: unknown, sources: ReadonlySet<string>): Proposal {
  const fail = (at: string, problem: string) => new InvalidProposalError(`proposal${at} ${problem}`);
  if (!isRecord(input)) throw fail('', 'must be an object');
  for (const key of Object.keys(input))
    if (key !== 'fields' && key !== 'samples') throw fail(`.${key}`, 'is not a known key (allowed: fields, samples)');
  const fields: Proposal['fields'] = {};
  const given = input.fields ?? {};
  if (!isRecord(given)) throw fail('.fields', 'must be an object');
  for (const [key, raw] of Object.entries(given)) {
    const at = `.fields[${JSON.stringify(key)}]`;
    if (key === 'goal.action' || key === 'tone.choice')
      throw fail(at, 'is not accepted in a proposal: the action and the tone come from the table of categories');
    if (!isFieldName(key) || !PROPOSABLE.includes(key))
      throw fail(at, `is not a known field (allowed: ${PROPOSABLE.join(', ')})`);
    if (!isRecord(raw)) throw fail(at, 'must be an object');
    for (const extra of Object.keys(raw))
      if (!PROPOSED_KEYS.includes(extra)) throw fail(`${at}.${extra}`, 'is not a known key');
    const problem = valueProblem(key, raw.value);
    if (problem) throw fail(`${at}.value`, problem);
    if (raw.kind !== 'found' && raw.kind !== 'inferred') throw fail(`${at}.kind`, 'must be "found" or "inferred"');
    if (typeof raw.source !== 'string' || !sources.has(raw.source))
      throw fail(
        `${at}.source`,
        `${JSON.stringify(raw.source)} is not a text, brand manual or prices file of the inventory`,
      );
    if (raw.quote !== undefined && typeof raw.quote !== 'string') throw fail(`${at}.quote`, 'must be text');
    if (raw.kind === 'found' && (raw.quote === undefined || raw.quote.trim() === ''))
      throw fail(`${at}.quote`, 'is required for a found value: copy the phrase from the file');
    if (typeof raw.quote === 'string' && length(raw.quote) > MAX_QUOTE)
      throw fail(`${at}.quote`, `is longer than ${MAX_QUOTE} characters`);
    fields[key] = {
      value: normalizeValue(key, raw.value as string),
      kind: raw.kind,
      source: raw.source,
      ...(typeof raw.quote === 'string' ? { quote: raw.quote } : {}),
    };
  }
  const proposal: Proposal = { fields };
  if (input.samples !== undefined) {
    if (!isRecord(input.samples)) throw fail('.samples', 'must be an object');
    for (const key of Object.keys(input.samples))
      if (!(TONES as readonly string[]).includes(key)) throw fail(`.samples.${key}`, 'is not a known tone');
    const samples = {} as Record<Tone, string>;
    for (const tone of TONES) {
      const text = input.samples[tone];
      if (typeof text !== 'string' || text.trim() === '') throw fail(`.samples.${tone}`, 'must be text');
      if (length(text.trim()) > SAMPLE_MAX) throw fail(`.samples.${tone}`, `is longer than ${SAMPLE_MAX} characters`);
      samples[tone] = text.trim();
    }
    proposal.samples = samples;
  }
  return proposal;
}

// ---- what is saved (plan decision 5) ----

const FIELD_KEYS = ['state', 'value', 'source', 'quote', 'confirmedBy', 'delegated'];

/** Reads `steps.profile` as saved; an absent step is empty. Fails naming the field that has another shape. */
export function parseProfileStep(saved: unknown): Profile {
  if (saved === undefined) return emptyProfile();
  const fail = (at: string, problem: string) => new InvalidProfileStepError(`steps.profile${at} ${problem}`);
  if (!isRecord(saved)) throw fail('', 'must be an object');
  if (saved.version !== 1) throw fail('.version', 'must be 1');
  if (!isRecord(saved.fields)) throw fail('.fields', 'must be an object');
  const fields: Profile['fields'] = {};
  for (const [key, raw] of Object.entries(saved.fields)) {
    const at = `.fields[${JSON.stringify(key)}]`;
    if (!isFieldName(key)) throw fail(at, `is not a known field (allowed: ${FIELD_NAMES.join(', ')})`);
    if (!isRecord(raw)) throw fail(at, 'must be an object');
    for (const extra of Object.keys(raw))
      if (!FIELD_KEYS.includes(extra)) throw fail(`${at}.${extra}`, 'is not a known key');
    if (typeof raw.state !== 'string' || !STATES.includes(raw.state))
      throw fail(`${at}.state`, `must be one of: ${STATES.join(', ')}`);
    if (raw.state === 'missing') continue;
    const problem = valueProblem(key, raw.value);
    if (problem) throw fail(`${at}.value`, problem);
    for (const text of ['source', 'quote'] as const)
      if (raw[text] !== undefined && typeof raw[text] !== 'string') throw fail(`${at}.${text}`, 'must be text');
    if (raw.state === 'confirmed') {
      if (typeof raw.confirmedBy !== 'string' || raw.confirmedBy === '')
        throw fail(`${at}.confirmedBy`, 'must be text');
      if (typeof raw.delegated !== 'boolean') throw fail(`${at}.delegated`, 'must be true or false');
    }
    fields[key] = {
      state: raw.state as State,
      value: normalizeValue(key, raw.value as string),
      ...(typeof raw.source === 'string' ? { source: raw.source } : {}),
      ...(typeof raw.quote === 'string' ? { quote: raw.quote } : {}),
      ...(raw.state === 'confirmed'
        ? { confirmedBy: raw.confirmedBy as string, delegated: raw.delegated as boolean }
        : {}),
    };
  }
  const profile: Profile = { version: 1, fields };
  if (saved.samples !== undefined) {
    const at = '.samples';
    if (!isRecord(saved.samples)) throw fail(at, 'must be an object');
    const samples = { source: 'agent' } as Samples;
    for (const tone of TONES) {
      const text = saved.samples[tone];
      if (typeof text !== 'string' || text === '') throw fail(`${at}.${tone}`, 'must be text');
      samples[tone] = text;
    }
    if (saved.samples.source !== 'agent') throw fail(`${at}.source`, 'must be "agent"');
    profile.samples = samples;
  }
  return profile;
}

// ---- changes ----

export interface Change {
  profile: Profile;
  /** What Harvi should know about the change: a proposal that did not apply, a suggestion that is now another. */
  notices: string[];
}

/**
 * Recomputes the action and the tone the table suggests: a field that is not confirmed follows the category (or is
 * cleared when the category has no suggestion); a confirmed one is kept, and `warn` says when it differs (FR-008).
 */
function followCategory(fields: Profile['fields'], warn: boolean): string[] {
  const notices: string[] = [];
  const category = rowOf(fields['business.category']?.value);
  for (const [name, suggested] of [
    ['goal.action', category?.action],
    ['tone.choice', category?.tone],
  ] as const) {
    const current = fields[name];
    if (current?.state === 'confirmed') {
      if (warn && current.value !== suggested)
        notices.push(
          suggested
            ? `${name}: the new category suggests ${suggested}; your confirmed ${current.value} is kept`
            : `${name}: the new category has no suggestion; your confirmed ${current.value} is kept`,
        );
    } else if (suggested) fields[name] = { state: 'inferred', value: suggested, source: 'table' };
    else delete fields[name];
  }
  return notices;
}

const categoryOf = (profile: Profile) => profile.fields['business.category']?.value;

export interface Candidate {
  value: string;
  state: 'found' | 'inferred';
  source: string;
  quote?: string;
}

/** Merges a validated proposal: it never touches a confirmed field (FR-009). */
export function mergeProposal(
  profile: Profile,
  candidates: Partial<Record<FieldName, Candidate>>,
  samples: Record<Tone, string> | undefined,
): Change {
  const fields = { ...profile.fields };
  const notices: string[] = [];
  for (const name of PROPOSABLE) {
    const next = candidates[name];
    if (!next) continue;
    if (fields[name]?.state === 'confirmed') {
      notices.push(`${name}: already confirmed, the proposal did not change it`);
      continue;
    }
    fields[name] = {
      state: next.state,
      value: next.value,
      source: next.source,
      ...(next.state === 'found' && next.quote !== undefined ? { quote: next.quote } : {}),
    };
  }
  notices.push(...followCategory(fields, categoryOf({ ...profile, fields }) !== categoryOf(profile)));
  return {
    profile: {
      version: 1,
      fields,
      ...(samples ? { samples: { ...samples, source: 'agent' } } : profile.samples ? { samples: profile.samples } : {}),
    },
    notices,
  };
}

function confirmed(value: string, by: string, delegated: boolean, source?: string, quote?: string): FieldValue {
  return {
    state: 'confirmed',
    value,
    ...(source === undefined ? {} : { source }),
    ...(quote === undefined ? {} : { quote }),
    confirmedBy: by,
    delegated,
  };
}

function withField(profile: Profile, name: FieldName, next: FieldValue): Change {
  const fields = { ...profile.fields, [name]: next };
  const notices = followCategory(
    fields,
    name === 'business.category' && categoryOf({ ...profile, fields }) !== categoryOf(profile),
  );
  return { profile: { ...profile, fields }, notices };
}

/** Harvi's own value: confirmed, never delegated. Fails naming the field when the value is not valid. */
export function setField(profile: Profile, name: FieldName, value: string, by: string): Change {
  const problem = valueProblem(name, value);
  if (problem) throw new InvalidValueError(`${name}: ${problem}`);
  return withField(profile, name, confirmed(normalizeValue(name, value), by, false));
}

/** Confirms what was found or inferred, as it is. */
export function confirmField(profile: Profile, name: FieldName, by: string): Change {
  const current = profile.fields[name];
  if (!current) throw new InvalidValueError(`${name}: nothing to confirm yet; give a value with set`);
  if (current.state === 'confirmed') return { profile, notices: [] };
  return withField(profile, name, confirmed(current.value, by, false, current.source, current.quote));
}

/** "No sé, elegí vos": takes the suggestion and confirms it, marked as delegated (FR-007). */
export function pickField(profile: Profile, name: FieldName, by: string): Change {
  const value = suggestionFor(profile, name);
  if (value === undefined)
    throw new InvalidValueError(`${name}: there is no suggestion to take; give a value with set`);
  const current = profile.fields[name];
  const source = name === 'goal.action' || name === 'tone.choice' ? 'table' : current?.source;
  return withField(profile, name, confirmed(value, by, true, source, current?.quote));
}
