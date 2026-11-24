// Color contrast of the token pairs (US-16 FR-007; plan decision 6): WCAG 2.2 relative luminance and contrast ratio.
// The ratio is compared unrounded and rounded to two decimals only for display, so 4.478 fails 4.5 even if it reads 4.48.

export type Mode = 'light' | 'dark';
export type ColorName = 'bg' | 'surface' | 'text' | 'text-muted' | 'accent' | 'on-accent' | 'focus';
export type Palette = Readonly<Record<ColorName, string>>;

export interface ContrastPair {
  /** [foreground, background] */
  pair: readonly [ColorName, ColorName];
  min: number;
}

export interface ContrastResult {
  mode: Mode;
  pair: [ColorName, ColorName];
  colors: [string, string];
  ratio: number;
  min: number;
  ok: boolean;
}

const TEXT = 4.5; // WCAG 2.2 SC 1.4.3, normal text
const NON_TEXT = 3; // WCAG 2.2 SC 1.4.11, focus indicator

/** The combinations the template uses today: text on its backgrounds, text on the accent, the focus ring on the page. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { pair: ['text', 'bg'], min: TEXT },
  { pair: ['text', 'surface'], min: TEXT },
  { pair: ['text-muted', 'bg'], min: TEXT },
  { pair: ['text-muted', 'surface'], min: TEXT },
  { pair: ['on-accent', 'accent'], min: TEXT },
  { pair: ['focus', 'bg'], min: NON_TEXT },
  { pair: ['focus', 'surface'], min: NON_TEXT },
];

function channel(hex: string, at: number): number {
  const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export function checkContrast(palettes: Readonly<Record<Mode, Palette>>): ContrastResult[] {
  return (['light', 'dark'] as const).flatMap((mode) =>
    CONTRAST_PAIRS.map(({ pair: [fore, back], min }) => {
      const colors: [string, string] = [palettes[mode][fore], palettes[mode][back]];
      const ratio = contrastRatio(...colors);
      return { mode, pair: [fore, back], colors, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min };
    }),
  );
}
