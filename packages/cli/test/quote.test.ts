// Rule (US-17 FR-004, plan decision 4): a quote is found in a text ignoring case and the spaces and line breaks that
// separate words; an empty quote is never found.
import { describe, expect, it } from 'vitest';
import { MAX_QUOTE, normalizeQuote, quoteIn } from '../src/domain/quote.ts';

describe('quote', () => {
  it('finds a quote copied with other spacing and case', () => {
    expect(
      quoteIn('Somos una\r\n  peluquería   de barrio.\nAbrimos a las 9.', 'somos una peluquería de   BARRIO'),
    ).toBe(true);
  });

  it('does not find a phrase that is not in the text', () => {
    expect(quoteIn('Somos una peluquería de barrio', 'Somos una barbería')).toBe(false);
  });

  it('never finds an empty quote', () => {
    expect(quoteIn('anything', '')).toBe(false);
    expect(quoteIn('anything', '   \n ')).toBe(false);
  });

  it('collapses every run of whitespace, including a no-break space, and ignores a BOM', () => {
    expect(normalizeQuote(`﻿  a  b\n\tc `)).toBe('a b c');
  });

  it('caps a saved quote at 300 characters', () => {
    expect(MAX_QUOTE).toBe(300);
  });
});

describe('minimum quote (security review of US-17)', () => {
  it('does not count a quote under 12 characters once normalized, even when it is in the text', () => {
    expect(quoteIn('Somos una peluquería', 'peluquería')).toBe(false);
    expect(quoteIn('Somos una peluquería', '  Somos   una  ')).toBe(false);
  });
  it('counts one of exactly 12', () => {
    expect(quoteIn('Somos una peluquería', 'somos una pe')).toBe(true);
  });
});
