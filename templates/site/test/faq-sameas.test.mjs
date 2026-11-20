// Rules (FR-009, FR-010, AC-9, AC-10, constitution XI): only confirmed questions are shown, each as a question
// heading followed by its plain-text answer, and FAQPage carries exactly those; with none confirmed there is no
// section and no FAQPage; the template writes no question text of its own. sameAs lists only confirmed https
// profiles; none confirmed, no sameAs (a non-https one fails the build: build-failures.test.mjs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readExample, readPages, VARIANTS } from './lib/build.mjs';
import { normalize, schemaOf } from './lib/html.mjs';
import { srcDir } from './lib/paths.mjs';
import { listFiles } from './lib/scan.mjs';

const DATA = Object.fromEntries(['address', 'area', 'online'].map((n) => [n, readExample(n).brief]));
const { address, online } = DATA;
const home = async (name) => (await readPages(VARIANTS[name].out)).find((p) => p.rel === 'index.html').html;
const strip = (html) => normalize(html.replace(/<[^>]*>/g, ' '));

/** The FAQ section as [question, answer] pairs, read from <h3> + <p> in order. */
function shownFaq(html) {
  const section = html.match(/<section\b[^>]*id="preguntas"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  if (section === undefined) return undefined;
  return [...section.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => [
    strip(m[1]),
    strip(m[2]),
  ]);
}

describe('FAQ (AC-9)', () => {
  it('address: 3 questions, 1 unconfirmed -> HTML and FAQPage show exactly the 2 confirmed, identical text', async () => {
    const html = await home('address');
    const confirmed = address.faq.filter((f) => f.confirmedBy).map((f) => [f.question, f.answer]);
    assert.equal(address.faq.length, 3);
    assert.equal(confirmed.length, 2);
    assert.deepEqual(shownFaq(html), confirmed);
    const { faq } = schemaOf(html);
    assert.deepEqual(
      faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
      confirmed,
    );
    const unconfirmed = address.faq.find((f) => !f.confirmedBy);
    assert.equal(html.includes(unconfirmed.question), false);
    assert.equal(html.includes(unconfirmed.answer), false);
  });

  it('the answers are plain text: no markup inside the answer paragraph', async () => {
    const section = (await home('address')).match(/id="preguntas"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    for (const [, answer] of section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) assert.doesNotMatch(answer, /</);
  });

  for (const name of ['area', 'online']) {
    it(`${name}: 0 confirmed -> 0 section, 0 FAQPage, no nav link, no unconfirmed text`, async () => {
      const html = await home(name);
      assert.equal(shownFaq(html), undefined);
      assert.equal(schemaOf(html).faq, undefined);
      assert.doesNotMatch(html, /#preguntas|Preguntas frecuentes/);
      for (const f of DATA[name].faq ?? []) assert.equal(html.includes(f.question), false);
    });
  }

  it('the template code holds no question or answer text outside the example relevamientos', async () => {
    const texts = Object.values(DATA).flatMap((d) => (d.faq ?? []).flatMap((f) => [f.question, f.answer]));
    const hits = [];
    for (const file of await listFiles(srcDir)) {
      const rel = path.relative(srcDir, file).replaceAll('\\', '/');
      if (rel.startsWith('data/')) continue;
      const text = await readFile(file, 'utf8').catch(() => '');
      if (text.includes('¿')) hits.push(`${rel}: contains a question mark "¿"`);
      for (const t of texts) if (text.includes(t)) hits.push(`${rel}: ${t}`);
    }
    assert.deepEqual(hits, []);
  });
});

describe('sameAs (AC-10)', () => {
  it('address: lists only the confirmed profiles, all https; the unconfirmed one is nowhere', async () => {
    const html = await home('address');
    const { business } = schemaOf(html);
    const confirmed = address.profiles.filter((p) => p.confirmedBy).map((p) => p.url);
    assert.deepEqual(business.sameAs, confirmed);
    assert.ok(business.sameAs.every((u) => new URL(u).protocol === 'https:'));
    assert.equal(html.includes(address.profiles.find((p) => !p.confirmedBy).url), false);
  });

  it('online: its one confirmed profile', async () => {
    assert.deepEqual(schemaOf(await home('online')).business.sameAs, [online.profiles[0].url]);
  });

  it('area: no profiles -> no sameAs', async () => {
    assert.equal('sameAs' in schemaOf(await home('area')).business, false);
  });
});
