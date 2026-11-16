// Rule (FR-001, AC-1): the detector that proves hand-written CSS has no literal colour, font family,
// font size, spacing or radius. Media-query breakpoints are exempt (they cannot use variables).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findLiterals } from './lib/css-literals.mjs';

const fixture = (name) => readFile(fileURLToPath(new URL(`./fixtures/tokens/${name}`, import.meta.url)), 'utf8');

describe('css literal detector', () => {
  it('flags every kind of literal with its line and kind', async () => {
    const found = findLiterals(await fixture('literals.css')).map((f) => `${f.line}:${f.kind}`);
    assert.deepEqual(found, [
      '2:color',
      '3:color',
      '4:color',
      '5:font-family',
      '6:font-size',
      '7:spacing',
      '8:spacing',
      '9:radius',
      '10:font',
    ]);
  });

  it('names the property and value in each finding', async () => {
    const [first] = findLiterals(await fixture('literals.css'));
    assert.equal(first?.property, 'color');
    assert.equal(first?.value, '#fff');
  });

  it('accepts variables, zero, keywords, unitless numbers, calc over variables and @media breakpoints', async () => {
    assert.deepEqual(findLiterals(await fixture('clean.css')), []);
  });

  it('ignores literals inside comments', () => {
    assert.deepEqual(findLiterals('/* color: #fff; margin: 1rem; */ a { color: var(--c); }'), []);
  });
});
