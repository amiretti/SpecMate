// Rules (FR-004, AC-4, SC-003): visible HTML, JSON-LD and metadata come from the same data. Name, phone (by its
// digits), email, address and hours match between visible HTML and JSON-LD; name and URL also match the metadata.
// A changed value replaces the old one everywhere; an absent one is missing in all three.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hoursText, parseSite } from '../src/lib/site.ts';
import { CHANGED, PREVIOUS } from './fixtures/sites/changed.mjs';
import { FIXTURES, readPages, VARIANTS } from './lib/build.mjs';
import { digits, element, metas, normalize, schemaOf, tags, titles, visibleText } from './lib/html.mjs';

const TARGETS = { ...VARIANTS, ...FIXTURES };

async function home(name) {
  const target = TARGETS[name];
  const index = (await readPages(target.out)).find((p) => p.rel === 'index.html');
  assert.ok(index, `${name}: no index.html`);
  const data = (await import(`file:///${target.data.replaceAll('\\', '/')}`)).default;
  return { html: index.html, site: parseSite(data), ...schemaOf(index.html) };
}

const contact = (business) => business.contactPoint ?? business;

for (const name of Object.keys(TARGETS)) {
  describe(`${name}: one source for HTML, JSON-LD and metadata`, () => {
    it('name: h1, JSON-LD, <title> and og:title', async () => {
      const { html, site, business } = await home(name);
      assert.equal(normalize(element(html, 'h1') ?? ''), site.name);
      assert.equal(business.name, site.name);
      assert.ok(titles(html)[0].includes(site.name));
      assert.ok(metas(html, 'og:title')[0].includes(site.name));
    });

    it('URL: canonical, og:url and JSON-LD url', async () => {
      const { html, site, business } = await home(name);
      const canonical = tags(html, 'link').find((l) => l.rel === 'canonical')?.href;
      assert.equal(canonical, `${site.url}/`);
      assert.equal(metas(html, 'og:url')[0], canonical);
      assert.equal(business.url, canonical);
    });

    it('phone (by digits) and email: visible text, links and JSON-LD', async () => {
      const { html, site, business } = await home(name);
      const text = visibleText(html);
      const tel = tags(html, 'a').find((a) => a.href?.startsWith('tel:'));
      assert.equal(digits(tel?.href), digits(site.phone.e164));
      assert.equal(digits(contact(business).telephone), digits(site.phone.e164));
      assert.ok(text.includes(site.phone.display), `visible phone ${site.phone.display}`);
      assert.ok(text.includes(site.email));
      assert.equal(contact(business).email, site.email);
    });

    it('hours: each visible line and its schema entry come from the same pair', async () => {
      const { html, site, business } = await home(name);
      const list = normalize((element(html, 'dl') ?? '').replace(/<[^>]*>/g, ' '));
      const schemaHours = business.openingHoursSpecification ?? business.contactPoint.hoursAvailable;
      const open = site.hours.filter((h) => h.opens);
      for (const h of site.hours) assert.ok(list.includes(`${h.label} ${hoursText(h)}`), `${h.label} ${hoursText(h)}`);
      assert.deepEqual(
        schemaHours.map((s) => [s.dayOfWeek, s.opens, s.closes]),
        open.map((h) => [h.days, h.opens, h.closes]),
      );
    });

    it('address: in <address> and JSON-LD when confirmed, missing in all three otherwise', async () => {
      const { html, site, business } = await home(name);
      const block = element(html, 'address');
      if (site.address) {
        const shown = normalize((block ?? '').replace(/<[^>]*>/g, ' '));
        assert.ok(shown.includes(site.address.street) && shown.includes(site.address.locality), shown);
        assert.equal(business.address.streetAddress, site.address.street);
        assert.equal(business.address.addressLocality, site.address.locality);
      } else {
        assert.equal(block, undefined, 'no <address> element');
        assert.equal('address' in business, false);
        assert.doesNotMatch(visibleText(html), /Cómo llegar/);
        assert.equal(metas(html, 'og:street-address').length, 0);
      }
    });
  });
}

describe('changed values replace the old ones everywhere (AC-4)', () => {
  it('the new name, phone and hours are in visible HTML, JSON-LD and metadata', async () => {
    const { html, business } = await home('changed');
    const text = visibleText(html);
    assert.ok(text.includes(CHANGED.name) && business.name === CHANGED.name && titles(html)[0].includes(CHANGED.name));
    assert.ok(text.includes(CHANGED.phone.display));
    assert.equal(business.telephone, CHANGED.phone.e164);
    assert.ok(text.includes(CHANGED.hours.text));
    assert.equal(business.openingHoursSpecification[0].opens, CHANGED.hours.opens);
    assert.equal(business.openingHoursSpecification[0].closes, CHANGED.hours.closes);
  });

  it('the previous values appear 0 times in the page', async () => {
    const { html } = await home('changed');
    const page = normalize(html);
    for (const old of [
      PREVIOUS.name,
      PREVIOUS.phoneDisplay,
      PREVIOUS.phoneE164,
      digits(PREVIOUS.phoneE164),
      PREVIOUS.hoursText,
    ]) {
      assert.equal(page.includes(old), false, `"${old}" still in the page`);
    }
    assert.equal(html.includes(`"opens":"${PREVIOUS.opens}"`), false);
    assert.equal(html.includes(`"closes":"${PREVIOUS.closes}"`), false);
  });
});
