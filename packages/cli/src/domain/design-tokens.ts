// The client's design tokens file (US-16; plan decisions 2-5, 7). It is data: values are read by path and converted to
// the template contract, nothing in it is interpreted. A DTCG 2025.10 file (https://www.designtokens.org/tr/2025.10/format/)
// is read with inherited types and resolved references; any other JSON is read leaf by leaf.
import { SpecmateError } from './errors.ts';

export const TOKEN_LIMITS = { bytes: 1_000_000, depth: 32, tokens: 10_000 } as const;

export type TokensFormat = 'dtcg' | 'custom';

/** A value found in the client's file. `type` is the DTCG `$type`, absent in any other format. */
export interface SourceToken {
  type?: string;
  value: unknown;
}

/** Something that keeps a value from reaching the contract. `token` is the contract path, `source` the client's path. */
export interface TokenProblem {
  token?: string;
  source?: string;
  value?: unknown;
  reason: string;
}

export interface TokensFile {
  format: TokensFormat;
  tokens: Map<string, SourceToken>;
  problems: TokenProblem[];
}

/** The file as a whole cannot be read: not JSON, over a cap, a cycle or an unsupported feature. */
export class TokensFileError extends SpecmateError {
  constructor(problem: string) {
    super(`tokens file: ${problem}`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DTCG_KEYS = ['$value', '$type', '$ref', '$extends'];
const REFERENCE = /^\{([^{}]+)\}$/;

function isDtcg(node: unknown, depth = 0): boolean {
  if (!isRecord(node) || depth > TOKEN_LIMITS.depth) return false;
  return (
    Object.keys(node).some((key) => DTCG_KEYS.includes(key)) || Object.values(node).some((v) => isDtcg(v, depth + 1))
  );
}

export function readTokensFile(text: string): TokensFile {
  let root: unknown;
  try {
    root = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new TokensFileError('is not valid JSON');
  }
  if (!isRecord(root)) throw new TokensFileError('must be a JSON object');
  const file: TokensFile = { format: isDtcg(root) ? 'dtcg' : 'custom', tokens: new Map(), problems: [] };
  if (file.format === 'dtcg') readDtcg(root, file);
  else readCustom(root, [], file);
  return file;
}

function add(file: TokensFile, path: string, token: SourceToken): void {
  if (file.tokens.size >= TOKEN_LIMITS.tokens) throw new TokensFileError(`has more than ${TOKEN_LIMITS.tokens} tokens`);
  file.tokens.set(path, token);
}

function checkDepth(path: readonly string[]): void {
  if (path.length > TOKEN_LIMITS.depth) throw new TokensFileError(`nests deeper than ${TOKEN_LIMITS.depth} levels`);
}

function readCustom(node: Record<string, unknown>, path: string[], file: TokensFile): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue; // $schema, $comment and the like are not values
    const here = [...path, key];
    checkDepth(here);
    if (key.includes('.')) {
      file.problems.push({
        source: here.join('.'),
        value,
        reason: 'the key has a dot, so it cannot be mapped by path',
      });
    } else if (isRecord(value)) {
      readCustom(value, here, file);
    } else {
      add(file, here.join('.'), { value });
    }
  }
}

interface RawToken {
  type: string | undefined;
  value: unknown;
}

function readDtcg(root: Record<string, unknown>, file: TokensFile): void {
  const raw = new Map<string, RawToken>();
  const walk = (node: Record<string, unknown>, path: string[], inherited: string | undefined) => {
    const name = path.join('.');
    if ('$ref' in node) throw new TokensFileError(`${name} uses $ref, which is not supported`);
    if ('$extends' in node) throw new TokensFileError(`${name} uses $extends, which is not supported`);
    const type = typeof node.$type === 'string' ? node.$type : inherited;
    if ('$value' in node) {
      if (raw.size >= TOKEN_LIMITS.tokens) throw new TokensFileError(`has more than ${TOKEN_LIMITS.tokens} tokens`);
      raw.set(name, { type, value: node.$value });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$') && key !== '$root') continue; // $description, $extensions, $deprecated, $schema
      if (/[.{}]/.test(key))
        throw new TokensFileError(`token or group name ${JSON.stringify(key)} is not valid in DTCG`);
      const here = [...path, key];
      checkDepth(here);
      if (isRecord(value)) walk(value, here, type);
    }
  };
  walk(root, [], undefined);

  const resolve = (path: string, chain: string[]): RawToken | TokenProblem => {
    const token = raw.get(path);
    if (!token) return { reason: `refers to ${path}, which does not exist` };
    const target = typeof token.value === 'string' ? REFERENCE.exec(token.value)?.[1] : undefined;
    if (target === undefined) return token;
    if (chain.includes(target)) throw new TokensFileError(`circular reference: ${[...chain, target].join(' -> ')}`);
    if (!raw.has(target)) return { reason: `refers to ${target}, which does not exist` };
    const resolved = resolve(target, [...chain, target]);
    return 'reason' in resolved ? resolved : { type: token.type ?? resolved.type, value: resolved.value };
  };
  for (const [path, token] of raw) {
    const resolved = resolve(path, [path]);
    if ('reason' in resolved) file.problems.push({ source: path, value: token.value, reason: resolved.reason });
    else
      add(
        file,
        path,
        resolved.type === undefined ? { value: resolved.value } : { type: resolved.type, value: resolved.value },
      );
  }
}

// --- Conversion to the template contract (plan decision 4) ---------------------------------------------------------

type Expected = 'color' | 'family' | 'number' | 'length';
export type ConvertedValue = string | number;

/** What a contract token holds, from its path: colors, the font stack, the line height, and lengths for the rest. */
function expected(contractPath: string): Expected {
  if (contractPath.startsWith('color.')) return 'color';
  if (contractPath === 'font.family') return 'family';
  if (contractPath === 'font.lineHeight') return 'number';
  return 'length';
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const LENGTH = /^(0|\d*\.?\d+(rem|em|px|vw|vh|ch|%))$/;
const CLAMP = /^clamp\([0-9a-z.+\-*/%, ]+\)$/;
const FONT_NAME = /^[A-Za-z0-9 _-]+$/;
const FONT_STACK = /^[A-Za-z0-9 ,'"_-]+$/;
const GENERIC_FAMILIES = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
];

const TYPE_NAMES: Record<Expected, string> = {
  color: 'color',
  family: 'fontFamily',
  number: 'number',
  length: 'dimension',
};
const article = (type: string) => (/^[aeiou]/i.test(type) ? `an ${type}` : `a ${type}`);

type Result = { value: ConvertedValue } | { reason: string };

function hexColor(value: unknown): Result {
  if (typeof value === 'string' && HEX.test(value)) {
    const digits = value.slice(1).toLowerCase();
    return { value: `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}` };
  }
  if (!isRecord(value)) return { reason: 'expected a color as #rrggbb' };
  if (value.colorSpace !== 'srgb')
    return { reason: `colorSpace ${String(value.colorSpace)} is not supported (only srgb)` };
  const parts = value.components;
  if (!Array.isArray(parts) || parts.length !== 3 || !parts.every((c) => typeof c === 'number' && c >= 0 && c <= 1))
    return { reason: 'a color component is not a number from 0 to 1' };
  if (value.alpha !== undefined && value.alpha !== 1)
    return { reason: `a transparent color is not supported (alpha ${String(value.alpha)})` };
  return {
    value: `#${parts
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`,
  };
}

function length(value: unknown): Result {
  if (isRecord(value)) {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value))
      return { reason: 'expected a length with its unit' };
    if (value.unit !== 'px' && value.unit !== 'rem')
      return { reason: `unit ${String(value.unit)} is not supported (only px or rem)` };
    if (value.value < 0) return { reason: 'a negative length is not supported' };
    return { value: `${value.value}${value.unit}` };
  }
  if (typeof value === 'string' && (LENGTH.test(value) || CLAMP.test(value))) return { value };
  return { reason: 'expected a length with its unit' };
}

function family(value: unknown): Result {
  // A string that is already a CSS font stack (the template's own format) is kept as is if it has only allowed characters.
  if (typeof value === 'string' && /[,'"]/.test(value))
    return FONT_STACK.test(value.trim())
      ? { value: value.trim() }
      : { reason: 'a font name has characters that are not allowed' };
  const names = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(names) || names.length === 0 || !names.every((n) => typeof n === 'string' && n.trim() !== ''))
    return { reason: 'expected a font name or a list of font names' };
  const trimmed = names.map((n: string) => n.trim());
  if (!trimmed.every((n) => FONT_NAME.test(n))) return { reason: 'a font name has characters that are not allowed' };
  return { value: trimmed.map((n) => (n.includes(' ') && !GENERIC_FAMILIES.includes(n) ? `"${n}"` : n)).join(', ') };
}

function positiveNumber(value: unknown): Result {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { value }
    : { reason: 'expected a positive number' };
}

const CONVERT: Record<Expected, (value: unknown) => Result> = {
  color: hexColor,
  family,
  number: positiveNumber,
  length,
};

/** Converts one client value to what the contract token at `contractPath` accepts, or says why it cannot. */
export function convertToken(contractPath: string, token: SourceToken): Result {
  const wants = expected(contractPath);
  if (token.type !== undefined && token.type !== TYPE_NAMES[wants])
    return {
      reason: `expected ${article(TYPE_NAMES[wants] === 'dimension' ? 'length' : TYPE_NAMES[wants])}, got ${article(token.type)}`,
    };
  return CONVERT[wants](token.value);
}

// --- Mapping, merge with the saved step and translation (FR-003 to FR-005, FR-009; plan decision 8) ---------------

/** Contract path -> path in the client's file, or null when nothing is mapped yet. */
export type TokenMapping = Record<string, string | null>;

export interface TokensSource {
  path: string;
  sha256: string;
}

/** A saved `steps.tokens` that does not have the expected shape; the message names the field. */
export class InvalidTokensStepError extends SpecmateError {}

/** Only exact path matches are proposed: nothing is guessed by likeness (FR-003). */
export function proposeMapping(contract: readonly string[], file: TokensFile): TokenMapping {
  return Object.fromEntries(contract.map((path) => [path, file.tokens.has(path) ? path : null]));
}

interface SavedStep {
  source: TokensSource;
  mapping: TokenMapping;
  confirmed: boolean;
}

function savedStep(saved: unknown, contract: readonly string[]): SavedStep {
  const bad = (field: string, problem: string): never => {
    throw new InvalidTokensStepError(`steps.tokens${field} ${problem}`);
  };
  if (!isRecord(saved)) return bad('', 'must be an object');
  const source = saved.source;
  if (!isRecord(source)) return bad('.source', 'must be an object');
  if (typeof source.path !== 'string') bad('.source.path', 'must be a string');
  if (typeof source.sha256 !== 'string') bad('.source.sha256', 'must be a string');
  if (!isRecord(saved.mapping)) return bad('.mapping', 'must be an object');
  for (const [token, path] of Object.entries(saved.mapping)) {
    const field = `.mapping[${JSON.stringify(token)}]`;
    if (!contract.includes(token)) bad(field, 'is not a token of the template contract');
    if (path !== null && typeof path !== 'string') bad(field, 'must be a path or null');
  }
  if (typeof saved.confirmed !== 'boolean') bad('.confirmed', 'must be true or false');
  return saved as unknown as SavedStep;
}

export interface MergedMapping {
  mapping: TokenMapping;
  confirmed: boolean;
  notices: string[];
}

export function mergeMapping(
  saved: unknown,
  {
    contract,
    proposed,
    source,
    confirm,
  }: {
    contract: readonly string[];
    proposed: TokenMapping;
    source: TokensSource;
    confirm: boolean;
  },
): MergedMapping {
  if (saved === undefined) return { mapping: proposed, confirmed: confirm, notices: [] };
  const previous = savedStep(saved, contract);
  if (previous.source.path !== source.path)
    return {
      mapping: proposed,
      confirmed: confirm,
      notices: [`the tokens file is now ${source.path} (was ${previous.source.path}): the mapping was proposed again`],
    };
  const mapping = Object.fromEntries(
    contract.map((path) => [
      path,
      path in previous.mapping ? (previous.mapping[path] ?? null) : (proposed[path] ?? null),
    ]),
  );
  const changed = previous.source.sha256 !== source.sha256;
  const notices =
    changed && previous.confirmed && !confirm
      ? ['the tokens file changed since the mapping was confirmed: review it and run again with --confirm']
      : [];
  return { mapping, confirmed: confirm || (previous.confirmed && !changed), notices };
}

export interface Translation {
  values: Map<string, ConvertedValue>;
  missing: string[];
  problems: TokenProblem[];
}

/** Every contract token gets its converted value, or is missing (null), or is a problem: never a default (FR-005). */
export function translate(contract: readonly string[], mapping: TokenMapping, file: TokensFile): Translation {
  const result: Translation = { values: new Map(), missing: [], problems: [...file.problems] };
  for (const token of contract) {
    const source = mapping[token] ?? null;
    if (source === null) {
      result.missing.push(token);
      continue;
    }
    const found = file.tokens.get(source);
    if (!found) {
      result.problems.push({ token, source, reason: `${source} is not in the tokens file` });
      continue;
    }
    const converted = convertToken(token, found);
    if ('value' in converted) result.values.set(token, converted.value);
    else result.problems.push({ token, source, value: found.value, reason: converted.reason });
  }
  return result;
}

/** The site's `tokens.json`: values nested by contract path, in contract order. */
export function buildContractTokens(
  contract: readonly string[],
  values: ReadonlyMap<string, ConvertedValue>,
  sourcePath: string,
): Record<string, unknown> {
  const tokens: Record<string, unknown> = {
    $comment: `From the client's tokens file ${sourcePath}, mapped and confirmed in steps.tokens of relevamiento.json.`,
  };
  for (const path of contract) {
    const value = values.get(path);
    if (value === undefined) continue;
    const keys = path.split('.');
    const last = keys.pop() ?? path;
    let node = tokens;
    for (const key of keys) {
      if (!isRecord(node[key])) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    node[last] = value;
  }
  return tokens;
}
