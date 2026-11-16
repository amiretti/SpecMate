// tokens.json -> CSS custom properties (FR-001, ADR-0030 "Estilos"). Throws naming the offending token, so a
// broken tokens file fails the build instead of shipping a half-styled site.

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LENGTH = /^(0|\d*\.?\d+(rem|em|px|vw|vh|ch|%))$/;
const CLAMP = /^clamp\([0-9a-z.+\-*/%, ()]+\)$/;
const FAMILY = /^[A-Za-z0-9 ,'"_-]+$/;

type Check = (value: unknown) => boolean;
const isColor: Check = (v) => typeof v === 'string' && HEX_COLOR.test(v);
const isLength: Check = (v) => typeof v === 'string' && LENGTH.test(v);
const isSize: Check = (v) => typeof v === 'string' && (LENGTH.test(v) || (CLAMP.test(v) && balanced(v)));
const isFamily: Check = (v) => typeof v === 'string' && FAMILY.test(v.trim()) && v.trim().length > 0;
const isLineHeight: Check = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

function balanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const COLORS = ['bg', 'surface', 'text', 'text-muted', 'accent', 'on-accent', 'focus'] as const;
const SIZES = ['base', 'small', 'h1', 'h2'] as const;
const STEPS = ['1', '2', '3', '4', '5'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, problem: string): never {
  throw new Error(`tokens.json: token "${path}" ${problem}`);
}

function section(parent: Record<string, unknown>, key: string, path: string): Record<string, unknown> {
  const value = parent[key];
  if (value === undefined) fail(path, 'is missing');
  if (!isRecord(value)) fail(path, 'must be an object');
  return value;
}

function leaf(parent: Record<string, unknown>, key: string, path: string, check: Check, expects: string): string {
  const value = parent[key];
  if (value === undefined) fail(path, 'is missing');
  if (!check(value)) fail(path, `is invalid (expected ${expects}, got ${JSON.stringify(value)})`);
  return String(value);
}

function noExtras(node: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(node)) {
    if (!allowed.includes(key)) fail(path === '' ? key : `${path}.${key}`, 'is not a known token');
  }
}

export function buildTokensCss(tokens: unknown): string {
  if (!isRecord(tokens)) throw new Error('tokens.json: tokens must be a JSON object');
  noExtras(tokens, ['$comment', 'color', 'font', 'space', 'radius', 'contentWidth', 'focusWidth'], '');

  const colorRoot = section(tokens, 'color', 'color');
  noExtras(colorRoot, ['light', 'dark'], 'color');
  const palette = (mode: 'light' | 'dark'): Array<readonly [string, string]> => {
    const colors = section(colorRoot, mode, `color.${mode}`);
    noExtras(colors, COLORS, `color.${mode}`);
    return COLORS.map((name) => [name, leaf(colors, name, `color.${mode}.${name}`, isColor, '#rrggbb')] as const);
  };
  const light = palette('light');
  const dark = palette('dark');

  const font = section(tokens, 'font', 'font');
  noExtras(font, ['family', 'size', 'lineHeight'], 'font');
  const family = leaf(font, 'family', 'font.family', isFamily, 'a font stack');
  const sizes = section(font, 'size', 'font.size');
  noExtras(sizes, SIZES, 'font.size');
  const sizeValues = SIZES.map((n) => [n, leaf(sizes, n, `font.size.${n}`, isSize, 'a length or clamp()')] as const);
  const lineHeight = leaf(font, 'lineHeight', 'font.lineHeight', isLineHeight, 'a positive number');

  const space = section(tokens, 'space', 'space');
  noExtras(space, STEPS, 'space');
  const spaceValues = STEPS.map((n) => [n, leaf(space, n, `space.${n}`, isLength, 'a length')] as const);

  const radius = leaf(tokens, 'radius', 'radius', isLength, 'a length');
  const contentWidth = leaf(tokens, 'contentWidth', 'contentWidth', isLength, 'a length');
  const focusWidth = leaf(tokens, 'focusWidth', 'focusWidth', isLength, 'a length');

  const colorLines = (rows: Array<readonly [string, string]>, indent: string) =>
    rows.map(([n, v]) => `${indent}--color-${n}: ${v};`).join('\n');

  return `/* Generated from src/data/tokens.json (ADR-0030). Do not edit by hand. */
:root {
  color-scheme: light dark;

${colorLines(light, '  ')}

  --font-body: ${family};
${sizeValues.map(([n, v]) => `  --font-size-${n}: ${v};`).join('\n')}
  --line-height: ${lineHeight};

${spaceValues.map(([n, v]) => `  --space-${n}: ${v};`).join('\n')}

  --radius: ${radius};
  --content-width: ${contentWidth};
  --focus-width: ${focusWidth};
}

@media (prefers-color-scheme: dark) {
  :root {
${colorLines(dark, '    ')}
  }
}
`;
}
