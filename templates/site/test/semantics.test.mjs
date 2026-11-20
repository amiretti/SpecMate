// Rules (FR-008, AC-8): read without CSS, every page has header, nav, main and footer, one h1, no skipped heading
// level; the address sits in <address>, the hours in a definition list; name, phone, email, address and hours
// are visible text, in a reading order that starts with who the business is and what it offers.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addressText, hoursText } from '../src/lib/site.ts';
import { FIXTURES, readPages, siteOf, VARIANTS } from './lib/build.mjs';
import { element, normalize, visibleText } from './lib/html.mjs';

const TARGETS = { ...VARIANTS, ...FIXTURES };
const headingLevels = (html) => [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));

/** Problems of a heading sequence: not exactly one h1 first, or a level deeper than previous + 1. */
export function headingProblems(levels) {
  const problems = [];
  if (levels.filter((l) => l === 1).length !== 1) problems.push('needs exactly one h1');
  if (levels[0] !== 1) problems.push('the first heading must be the h1');
  levels.forEach((level, i) => {
    if (i > 0 && level > levels[i - 1] + 1) problems.push(`h${levels[i - 1]} -> h${level} skips a level`);
  });
  return problems;
}

describe('heading checker', () => {
  it('accepts h1 h2 h3 h2 h3 h3', () => assert.deepEqual(headingProblems([1, 2, 3, 2, 3, 3]), []));
  it('rejects a skip h2 -> h4', () => assert.ok(headingProblems([1, 2, 4]).length > 0));
  it('rejects two h1', () => assert.ok(headingProblems([1, 2, 1]).length > 0));
  it('rejects no h1', () => assert.ok(headingProblems([2, 3]).length > 0));
});

for (const [name, target] of Object.entries(TARGETS)) {
  describe(`${name}: HTML that reads without CSS`, () => {
    it('every page has header, nav, main and footer, one each', async () => {
      for (const { rel, html } of await readPages(target.out)) {
        for (const landmark of ['header', 'nav', 'main', 'footer']) {
          const count = (html.match(new RegExp(`<${landmark}\\b`, 'gi')) ?? []).length;
          assert.equal(count, 1, `${rel}: ${landmark}`);
        }
      }
    });

    it('every page has one h1 and no skipped heading level', async () => {
      for (const { rel, html } of await readPages(target.out)) {
        assert.deepEqual(headingProblems(headingLevels(html)), [], rel);
      }
    });

    it('the home page shows the business data as text, in reading order', async () => {
      const site = siteOf(target.data);
      const html = (await readPages(target.out)).find((p) => p.rel === 'index.html').html;
      const main = normalize((element(html, 'main') ?? '').replace(/<[^>]*>/g, ' '));
      const sequence = [
        site.name,
        site.tagline,
        site.about,
        ...site.sections.flatMap((s) => [s.title, ...('body' in s ? [s.body] : s.items)]),
        ...site.hours.flatMap((h) => [h.label, hoursText(h)]),
        ...(site.address ? [addressText(site.address)] : []),
        ...[site.contact.phone ?? site.contact.whatsapp].flatMap((n) => (n ? [n.display] : [])),
        ...(site.contact.email ? [site.contact.email] : []),
      ];
      let from = 0;
      for (const piece of sequence) {
        const at = main.indexOf(piece, from);
        assert.ok(at >= 0, `"${piece}" missing or out of order in <main>`);
        from = at + piece.length;
      }
      assert.ok(visibleText(html).startsWith('Saltar al contenido'), 'skip link first, then the header');
    });

    it('hours are a definition list; the address, when confirmed, is an <address>', async () => {
      const site = siteOf(target.data);
      const html = (await readPages(target.out)).find((p) => p.rel === 'index.html').html;
      const list = element(html, 'dl') ?? '';
      assert.equal((list.match(/<dt\b/g) ?? []).length, site.hours.length);
      assert.equal((list.match(/<dd\b/g) ?? []).length, site.hours.length);
      if (site.address) assert.equal(normalize(element(html, 'address') ?? ''), addressText(site.address));
      else assert.equal(element(html, 'address'), undefined);
    });
  });
}
