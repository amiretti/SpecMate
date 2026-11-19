// Rules (US-14 FR-005..FR-008, FR-012 · AC-2, AC-4, AC-7): what the built page shows from the relevamiento.
// An unconfirmed optional datum is in neither the HTML nor the JSON-LD; one confirmed contact channel shows only
// that channel (a WhatsApp number makes no "Llamar" button); free sections render in order and escaped; the logo
// renders for light and dark backgrounds with its alt.
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { CONTENT } from './fixtures/sites/content.mjs';
import { SMALL } from './fixtures/sites/small.mjs';
import { buildSite, FIXTURES, readExample, readPages } from './lib/build.mjs';
import { schemaOf, tags, visibleText } from './lib/html.mjs';

const home = async (out) => (await readPages(out)).find((p) => p.rel === 'index.html').html;
const contactLinks = (html) =>
  tags(html, 'a')
    .map((a) => a.href ?? '')
    .filter((href) => /^(tel:|mailto:|https:\/\/wa\.me\/)/.test(href));

describe('unconfirmed optional data is in neither the HTML nor the JSON-LD (AC-2)', () => {
  it('an hours entry, a profile and a free section without confirmedBy are absent', async () => {
    const html = await home(FIXTURES.content.out);
    const { unconfirmed } = CONTENT;
    for (const text of [
      unconfirmed.hours.label,
      unconfirmed.profile,
      unconfirmed.section.title,
      unconfirmed.section.body,
    ]) {
      assert.equal(html.includes(text), false, `"${text}" must not be in the page`);
    }
    assert.equal(html.includes(`id="${unconfirmed.section.id}"`), false);
    const { business } = schemaOf(html);
    assert.equal(JSON.stringify(business).includes(unconfirmed.profile), false);
    const hours = business.openingHoursSpecification ?? [];
    assert.equal(
      hours.some((h) => h.opens === unconfirmed.hours.opens && h.closes === unconfirmed.hours.closes),
      false,
    );
  });
});

describe('one confirmed contact channel shows only that channel (FR-004, FR-005, AC-4)', () => {
  const dirs = {};
  const only = (channel) => {
    const data = readExample('address');
    data.brief.contact = { [channel]: data.brief.contact[channel] };
    return data;
  };
  before(async () => {
    for (const channel of ['phone', 'email']) {
      const dir = await mkdtemp(path.join(tmpdir(), `site-only-${channel}-`));
      const data = path.join(dir, 'relevamiento.json');
      await writeFile(data, JSON.stringify(only(channel)));
      const out = path.join(dir, 'dist');
      const { status, output } = buildSite({ data, out });
      assert.equal(status, 0, output.slice(-1500));
      dirs[channel] = { dir, out };
    }
  });
  after(async () => {
    for (const { dir } of Object.values(dirs)) await rm(dir, { recursive: true, force: true });
  });

  it('only phone -> a "Llamar" link and no WhatsApp or email', async () => {
    const html = await home(dirs.phone.out);
    assert.deepEqual(contactLinks(html), ['tel:+541100000000']);
    const business = schemaOf(html).business;
    assert.equal(business.telephone, '+541100000000');
    assert.equal('email' in business, false);
  });

  it('only WhatsApp -> a WhatsApp link, no "Llamar" button and no email (AC-6)', async () => {
    const html = await home(FIXTURES.small.out);
    const links = contactLinks(html);
    assert.equal(links.length, 1, links.join(', '));
    assert.ok(links[0].startsWith(`https://wa.me/${SMALL.whatsapp.e164.slice(1)}?`), links[0]);
    assert.doesNotMatch(visibleText(html), /Llamar/);
    assert.ok(visibleText(html).includes(SMALL.whatsapp.display), 'the WhatsApp number is visible');
    const contact = schemaOf(html).business.contactPoint;
    assert.equal(contact.telephone, SMALL.whatsapp.e164, 'the business number in the JSON-LD');
    assert.equal('email' in contact, false);
  });

  it('only email -> a mailto link and no phone or WhatsApp', async () => {
    const html = await home(dirs.email.out);
    assert.deepEqual(contactLinks(html), ['mailto:hola@horno-azul.example']);
    const business = schemaOf(html).business;
    assert.equal(business.email, 'hola@horno-azul.example');
    assert.equal('telephone' in business, false);
  });
});

describe('a small site without hours, address or own domain (AC-6)', () => {
  it('has no hours or location section, no "Cómo llegar", and its canonical is the Workers URL', async () => {
    const html = await home(FIXTURES.small.out);
    assert.doesNotMatch(html, /id="horarios"|id="ubicacion"|#horarios|#ubicacion/);
    assert.doesNotMatch(visibleText(html), /Cómo llegar|Horarios/);
    assert.equal(tags(html, 'link').find((l) => l.rel === 'canonical')?.href, `${SMALL.url}/`);
    const business = schemaOf(html).business;
    assert.equal(business['@type'], 'Organization');
    assert.equal('hoursAvailable' in business.contactPoint, false);
  });
});

describe('free sections and logo (FR-007, FR-008, FR-012, AC-7)', () => {
  it('the sections appear after "Nosotros", in their order, with their text escaped', async () => {
    const html = await home(FIXTURES.content.out);
    const [first, second] = CONTENT.sections;
    const at = (needle) => html.indexOf(needle);
    assert.ok(at('id="nosotros"') >= 0 && at('id="nosotros"') < at(`id="${first.id}"`), 'after Nosotros');
    assert.ok(at(`id="${first.id}"`) < at(`id="${second.id}"`), 'in their order');
    const escaped = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    for (const piece of [first.title, first.body, second.title, ...second.items]) {
      assert.ok(html.includes(escaped(piece)), `"${piece}" must be in the page, escaped`);
    }
    assert.doesNotMatch(html, /<b>hoy|<i>mañana|<script>alert/);
    const section = html.match(new RegExp(`<section\\b[^>]*id="${second.id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? '';
    assert.equal((section.match(/<li\b/g) ?? []).length, second.items.length, 'the list is a list');
  });

  it('the logo is in the header, light by default and dark by prefers-color-scheme, with its alt', async () => {
    const html = await home(FIXTURES.content.out);
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
    const img = tags(header, 'img')[0];
    assert.ok(img, 'an <img> in the header');
    assert.equal(img.alt, CONTENT.logo.alt);
    assert.ok(img.width && img.height, 'width and height');
    assert.match(img.src, /logo-claro/);
    const source = tags(header, 'source')[0];
    assert.equal(source?.media, '(prefers-color-scheme: dark)');
    assert.match(source?.srcset ?? '', /logo-oscuro/);
  });

  it('without a logo there is no image in the header', async () => {
    const header = (await home(FIXTURES.small.out)).match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '';
    assert.equal(tags(header, 'img').length, 0);
  });
});
