// Rule (US-13 FR-004, AC-4): lowercase letters, digits and hyphens, no leading or trailing hyphen, at most 63 chars.
import { describe, expect, it } from 'vitest';
import { InvalidSlugError, parseSlug } from '../src/domain/slug.ts';

describe('slug', () => {
  it.each(['panaderia-ejemplo', 'a', '0', 'a1-b2-c3', 'a'.repeat(63)])('accepts %s', (raw) => {
    expect(parseSlug(raw)).toBe(raw);
  });

  it.each(['Mayus', '-guion', 'guion-', 'con espacio', 'ñandu', 'a'.repeat(64), '', 'a_b', 'a.b', '../x'])(
    'rejects %j, naming the format',
    (raw) => {
      expect(() => parseSlug(raw)).toThrow(InvalidSlugError);
      expect(() => parseSlug(raw)).toThrow(/lowercase letters, digits and hyphens.*63/);
    },
  );
});
