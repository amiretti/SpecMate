// Rules (FR-005 URL, FR-009/FR-010 confirmed data, constitution XI): the single data source of the site is
// validated before anything renders; a bad field fails the build naming it; unconfirmed optional data is dropped.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import address from '../src/data/examples/address.ts';
import area from '../src/data/examples/area.ts';
import online from '../src/data/examples/online.ts';
import { hoursText, mapsUrl, parseSite } from '../src/lib/site.ts';

const base = () => structuredClone(address);

function throwsNaming(mutate, name) {
  const input = base();
  mutate(input);
  assert.throws(
    () => parseSite(input),
    (error) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(name), `message "${error.message}" must name ${name}`);
      return true;
    },
  );
}

describe('example data', () => {
  for (const [name, data] of Object.entries({ address, area, online })) {
    it(`${name} parses and is marked as invented`, () => {
      const site = parseSite(data);
      assert.match(data.$comment, /FICTITIOUS/);
      assert.match(site.exampleNotice ?? '', /ficticio/);
      assert.match(new URL(site.url).hostname, /\.example$/, 'reserved fictitious domain');
    });
  }
  it('address has an address and no area; area has areas and no address; online has neither', () => {
    const [a, b, c] = [address, area, online].map(parseSite);
    assert.ok(a.address);
    assert.equal(b.address, undefined);
    assert.ok(b.areaServed.length > 0);
    assert.equal(c.address, undefined);
    assert.deepEqual(c.areaServed, []);
  });
});

describe('site URL (FR-005)', () => {
  it('is required', () => throwsNaming((d) => delete d.site.url, 'site.url'));
  it('must be https', () =>
    throwsNaming((d) => Object.assign(d.site, { url: 'http://horno-azul.example' }), 'site.url'));
  it('must be absolute', () => throwsNaming((d) => Object.assign(d.site, { url: '/inicio' }), 'site.url'));
  it('must not carry a query or fragment', () =>
    throwsNaming((d) => Object.assign(d.site, { url: 'https://a.example/?x=1' }), 'site.url'));
  it('drops the trailing slash', () => {
    const d = base();
    d.site.url = 'https://horno-azul.example/';
    assert.equal(parseSite(d).url, 'https://horno-azul.example');
  });
});

describe('AI crawler policy (FR-006)', () => {
  it('defaults to allow', () => {
    const d = base();
    delete d.site.aiCrawlers;
    assert.equal(parseSite(d).aiCrawlers, 'allow');
  });
  it('accepts block', () => {
    const d = base();
    d.site.aiCrawlers = 'block';
    assert.equal(parseSite(d).aiCrawlers, 'block');
  });
  it('rejects any other value', () =>
    throwsNaming((d) => Object.assign(d.site, { aiCrawlers: 'maybe' }), 'site.aiCrawlers'));
});

describe('required fields fail naming them', () => {
  const cases = [
    ['empty name', (d) => Object.assign(d, { name: ' ' }), 'name'],
    ['missing tagline', (d) => delete d.tagline, 'tagline'],
    ['missing about', (d) => delete d.about, 'about'],
    ['missing image alt', (d) => Object.assign(d, { image: {} }), 'image.alt'],
    ['bad e164', (d) => Object.assign(d.phone, { e164: '011 1234' }), 'phone.e164'],
    [
      'display digits differ from e164',
      (d) => Object.assign(d.phone, { display: '+54 11 9999-0000' }),
      'phone.display',
    ],
    ['unconfirmed phone', (d) => Object.assign(d.phone, { confirmed: false }), 'phone'],
    ['phone without source', (d) => Object.assign(d.phone, { source: '' }), 'phone.source'],
    ['bad email', (d) => Object.assign(d.email, { address: 'no-at-sign' }), 'email.address'],
    ['unconfirmed email', (d) => Object.assign(d.email, { confirmed: false }), 'email'],
    ['no hours', (d) => Object.assign(d, { hours: [] }), 'hours'],
    ['unconfirmed hours', (d) => Object.assign(d.hours[0], { confirmed: false }), 'hours[0]'],
    ['opens without closes', (d) => delete d.hours[0].closes, 'hours[0]'],
    ['bad time', (d) => Object.assign(d.hours[0], { opens: '7am' }), 'hours[0].opens'],
    ['unknown day', (d) => Object.assign(d.hours[0], { days: ['Lunes'] }), 'hours[0].days'],
    ['address without street', (d) => Object.assign(d.address, { street: '' }), 'address.street'],
    ['address without source', (d) => Object.assign(d.address, { source: '' }), 'address.source'],
    ['FAQ without answer', (d) => Object.assign(d.faq[0], { answer: '' }), 'faq[0].answer'],
    ['FAQ without source', (d) => Object.assign(d.faq[0], { source: '' }), 'faq[0].source'],
    ['profile without source', (d) => Object.assign(d.profiles[0], { source: '' }), 'profiles[0].source'],
  ];
  for (const [label, mutate, name] of cases) {
    it(`${label} -> error naming ${name}`, () => throwsNaming(mutate, name));
  }
  it('a value that is not an object fails', () => {
    assert.throws(() => parseSite(null), /site data/);
  });
});

describe('unconfirmed optional data never reaches the site (constitution XI)', () => {
  it('an unconfirmed address is absent', () => {
    const d = base();
    d.address.confirmed = false;
    assert.equal(parseSite(d).address, undefined);
  });
  it('an unconfirmed service area is dropped', () => {
    const d = base();
    d.areaServed = [
      { name: 'Zona A', source: 'llamada', confirmed: true },
      { name: 'Zona B', source: 'llamada', confirmed: false },
    ];
    assert.deepEqual(parseSite(d).areaServed, ['Zona A']);
  });
  it('FAQ keeps only confirmed items, in order, with identical text (FR-009)', () => {
    const d = base();
    const confirmed = d.faq.filter((f) => f.confirmed).map(({ question, answer }) => ({ question, answer }));
    assert.equal(d.faq.length, 3);
    assert.equal(confirmed.length, 2);
    assert.deepEqual(parseSite(d).faq, confirmed);
  });
  it('profiles keep only confirmed https URLs (FR-010)', () => {
    const d = base();
    assert.equal(d.profiles.length, 3);
    assert.deepEqual(
      parseSite(d).profiles,
      d.profiles.filter((p) => p.confirmed).map((p) => p.url),
    );
  });
  it('a non-https profile fails even if unconfirmed (FR-010)', () => {
    throwsNaming(
      (d) => Object.assign(d.profiles[2], { url: 'http://perfil.example/horno', confirmed: false }),
      'profiles[2].url',
    );
    throwsNaming((d) => Object.assign(d.profiles[0], { url: 'ftp://perfil.example/x' }), 'profiles[0].url');
  });
});

describe('display helpers', () => {
  it('hours text comes from the same opens/closes pair as the schema', () => {
    assert.equal(hoursText({ label: 'x', days: ['Monday'], opens: '07:00', closes: '20:30' }), '7:00 a 20:30');
    assert.equal(hoursText({ label: 'x', days: ['Sunday'] }), 'Cerrado');
  });
  it('"Cómo llegar" is a Google Maps search built from the confirmed address only (ADR-0035)', () => {
    const url = new URL(mapsUrl({ street: 'Calle 1', locality: 'Ciudad', country: 'AR' }));
    assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/search/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.get('query'), 'Calle 1, Ciudad, AR');
  });
});
