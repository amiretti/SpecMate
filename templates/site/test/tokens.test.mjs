// Rule (FR-001, AC-1, ADR-0030 "Estilos"): brand styles come from tokens.json -> custom properties; hand-written
// CSS has 0 literals; a missing or invalid token fails naming it; changing a value changes the CSS.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildTokensCss } from '../src/lib/tokens.ts';
import { findLiterals } from './lib/css-literals.mjs';
import { distDir, srcDir } from './lib/paths.mjs';
import { listFiles } from './lib/scan.mjs';

const tokens = JSON.parse(await readFile(path.join(srcDir, 'data', 'tokens.json'), 'utf8'));
const clone = () => structuredClone(tokens);
const declarations = (css) => [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);

// Custom properties and values that US-09's tokens.css defined: the example tokens.json keeps them.
const LEGACY = {
  '--color-bg': '#fffaf2',
  '--color-surface': '#f4e9d8',
  '--color-text': '#1f1a14',
  '--color-text-muted': '#4a3f33',
  '--color-accent': '#7a3e0c',
  '--color-on-accent': '#ffffff',
  '--color-focus': '#1d4ed8',
  '--font-body': '"Inter Variable", system-ui, sans-serif',
  '--font-size-base': '1.125rem',
  '--font-size-small': '1rem',
  '--font-size-h1': 'clamp(2rem, 1.4rem + 3vw, 3.25rem)',
  '--font-size-h2': 'clamp(1.5rem, 1.2rem + 1.5vw, 2rem)',
  '--line-height': '1.6',
  '--space-1': '0.5rem',
  '--space-2': '1rem',
  '--space-3': '1.5rem',
  '--space-4': '2.5rem',
  '--space-5': '4rem',
  '--radius': '0.5rem',
  '--content-width': '68rem',
  '--focus-width': '3px',
};
const LEGACY_DARK = {
  '--color-bg': '#1a1612',
  '--color-surface': '#2a231c',
  '--color-text': '#f3ead9',
  '--color-text-muted': '#d6c8b2',
  '--color-accent': '#f0b06e',
  '--color-on-accent': '#1a1612',
  '--color-focus': '#93c5fd',
};

describe('tokens.json -> CSS custom properties', () => {
  const css = buildTokensCss(tokens);
  const [lightPart, darkPart] = css.split('@media (prefers-color-scheme: dark)');

  it('keeps the custom properties and light values of the US-09 stylesheet', () => {
    assert.deepEqual(Object.fromEntries(declarations(lightPart ?? '')), LEGACY);
    assert.match(lightPart ?? '', /color-scheme:\s*light dark/);
  });

  it('keeps the dark palette inside prefers-color-scheme: dark', () => {
    assert.deepEqual(Object.fromEntries(declarations(darkPart ?? '')), LEGACY_DARK);
  });

  it('declares one custom property per token (21 light + 7 dark)', () => {
    assert.equal(declarations(lightPart ?? '').length, 21);
    assert.equal(declarations(darkPart ?? '').length, 7);
  });

  it('changing a token value changes the generated CSS, only that declaration', () => {
    const changed = clone();
    changed.color.light.accent = '#112233';
    changed.space['3'] = '2rem';
    const next = buildTokensCss(changed);
    assert.notEqual(next, css);
    assert.match(next, /--color-accent:\s*#112233;/);
    assert.match(next, /--space-3:\s*2rem;/);
    const before = new Set(declarations(css).map(([k, v]) => `${k}: ${v}`));
    const added = declarations(next).map(([k, v]) => `${k}: ${v}`).filter((d) => !before.has(d));
    assert.deepEqual(added.sort(), ['--color-accent: #112233', '--space-3: 2rem']);
  });

  it('the output has no @import, url(), markup or escapes', () => {
    assert.ok(css.length > 0);
    assert.doesNotMatch(css, /@import|url\(|<|\\/);
  });

  it('is deterministic', () => {
    assert.equal(buildTokensCss(tokens), buildTokensCss(clone()));
  });
});

describe('invalid tokens fail naming the token', () => {
  const cases = [
    ['a missing colour', (t) => delete t.color.light.bg, 'color.light.bg'],
    ['a missing dark colour', (t) => delete t.color.dark.focus, 'color.dark.focus'],
    ['a missing category', (t) => delete t.space, 'space'],
    ['a missing size', (t) => delete t.font.size.h1, 'font.size.h1'],
    ['a missing spacing step', (t) => delete t.space['4'], 'space.4'],
    ['a missing radius', (t) => delete t.radius, 'radius'],
    ['a missing content width', (t) => delete t.contentWidth, 'contentWidth'],
    ['a missing line height', (t) => delete t.font.lineHeight, 'font.lineHeight'],
    ['an invalid colour', (t) => Object.assign(t.color.light, { text: 'red' }), 'color.light.text'],
    ['a short hex colour', (t) => Object.assign(t.color.dark, { accent: '#fff' }), 'color.dark.accent'],
    ['a size without unit', (t) => Object.assign(t.font.size, { base: '18' }), 'font.size.base'],
    ['a non-string size', (t) => Object.assign(t.font.size, { small: 16 }), 'font.size.small'],
    ['a malformed clamp()', (t) => Object.assign(t.font.size, { h2: 'clamp(1rem; color: red)' }), 'font.size.h2'],
    ['an invalid spacing', (t) => Object.assign(t.space, { 2: 'big' }), 'space.2'],
    ['an invalid radius', (t) => Object.assign(t, { radius: '1 rem' }), 'radius'],
    [
      'a font family with CSS injection',
      (t) => Object.assign(t.font, { family: 'a; } body { color: red' }),
      'font.family',
    ],
    ['a non-numeric line height', (t) => Object.assign(t.font, { lineHeight: 'tall' }), 'font.lineHeight'],
    ['an unknown token', (t) => Object.assign(t.color.light, { extra: '#000000' }), 'color.light.extra'],
  ];
  for (const [label, mutate, name] of cases) {
    it(`${label} -> error naming ${name}`, () => {
      const broken = clone();
      mutate(broken);
      assert.throws(
        () => buildTokensCss(broken),
        (error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(name), `message "${error.message}" must name ${name}`);
          return true;
        },
      );
    });
  }

  it('a file that is not an object -> error naming tokens', () => {
    assert.throws(() => buildTokensCss(null), /tokens/);
    assert.throws(() => buildTokensCss([]), /tokens/);
  });
});

describe('hand-written CSS has no literals', () => {
  it('every .css under src/ is free of colour, font, size, spacing and radius literals', async () => {
    const files = (await listFiles(srcDir)).filter((f) => f.endsWith('.css'));
    assert.ok(
      files.some((f) => f.endsWith('global.css')),
      'global.css not found',
    );
    const hits = [];
    for (const file of files) {
      for (const hit of findLiterals(await readFile(file, 'utf8'))) {
        hits.push(`${path.relative(srcDir, file)}:${hit.line} ${hit.property}: ${hit.value}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it('src/ keeps no hand-written copy of the tokens stylesheet', async () => {
    const files = (await listFiles(srcDir)).map((f) => path.relative(srcDir, f).replaceAll('\\', '/'));
    assert.equal(files.includes('styles/tokens.css'), false);
  });
});

describe('dist/ loads tokens as an external stylesheet', () => {
  it('serves dist/tokens.css generated from tokens.json', async () => {
    const built = await readFile(path.join(distDir, 'tokens.css'), 'utf8').catch(() => '');
    assert.equal(built.trim(), buildTokensCss(tokens).trim());
  });

  it('index.html links /tokens.css and carries no inline style', async () => {
    const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
    const link = html.match(/<link\b[^>]*href="\/tokens\.css"[^>]*>/)?.[0] ?? '';
    assert.match(link, /rel="stylesheet"/);
    assert.doesNotMatch(html, /<style\b|\sstyle=/i);
  });

  it('the bundled stylesheet no longer inlines the tokens', async () => {
    const files = (await listFiles(path.join(distDir, '_astro'))).filter((f) => f.endsWith('.css'));
    assert.ok(files.length > 0);
    for (const file of files) {
      assert.doesNotMatch(await readFile(file, 'utf8'), /--color-bg\s*:/, path.basename(file));
    }
  });
});
