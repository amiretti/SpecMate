// Rule (US-16 FR-007, AC-6; plan decision 6): every color pair is checked against WCAG 2.2 AA in light and dark mode,
// 4.5:1 for text and 3:1 for the focus ring; the ratio is compared unrounded and a failure keeps both values.
import { describe, expect, it } from 'vitest';
import { CONTRAST_PAIRS, checkContrast, contrastRatio } from '../src/domain/contrast.ts';

const palette = (overrides: Record<string, string> = {}) => ({
  bg: '#ffffff',
  surface: '#f4f4f4',
  text: '#111111',
  'text-muted': '#444444',
  accent: '#7a3e0c',
  'on-accent': '#ffffff',
  focus: '#1d4ed8',
  ...overrides,
});

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#ffffff', 21],
    ['#ffffff', '#ffffff', 1],
    ['#777777', '#ffffff', 4.478],
  ])('%s on %s is %f', (a, b, expected) => {
    expect(contrastRatio(a, b)).toBeCloseTo(expected, 3);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1d4ed8', '#fffaf2')).toBe(contrastRatio('#fffaf2', '#1d4ed8'));
  });
});

describe('checkContrast', () => {
  it('checks the seven pairs the template uses, in both modes', () => {
    expect(CONTRAST_PAIRS.map((p) => `${p.pair.join('/')}:${p.min}`)).toEqual([
      'text/bg:4.5',
      'text/surface:4.5',
      'text-muted/bg:4.5',
      'text-muted/surface:4.5',
      'on-accent/accent:4.5',
      'focus/bg:3',
      'focus/surface:3',
    ]);
    const results = checkContrast({ light: palette(), dark: palette() });
    expect(results).toHaveLength(14);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('#777777 on white fails at 4.48 against 4.5, with both values (AC-6)', () => {
    const failed = checkContrast({ light: palette({ text: '#777777' }), dark: palette() }).filter((r) => !r.ok);
    expect(failed).toEqual([
      { mode: 'light', pair: ['text', 'bg'], colors: ['#777777', '#ffffff'], ratio: 4.48, min: 4.5, ok: false },
      { mode: 'light', pair: ['text', 'surface'], colors: ['#777777', '#f4f4f4'], ratio: 4.07, min: 4.5, ok: false },
    ]);
  });

  it('the focus ring only needs 3:1', () => {
    const results = checkContrast({ light: palette({ focus: '#949494' }), dark: palette() });
    expect(results.find((r) => r.mode === 'light' && r.pair.join() === 'focus,bg')?.ok).toBe(true);
    expect(results.find((r) => r.mode === 'light' && r.pair.join() === 'focus,surface')?.ok).toBe(false);
  });

  it('reports each mode on its own', () => {
    const failed = checkContrast({ light: palette(), dark: palette({ 'on-accent': '#7a3e0c' }) }).filter((r) => !r.ok);
    expect(failed.map((r) => `${r.mode}:${r.pair.join('/')}`)).toEqual(['dark:on-accent/accent']);
  });
});
