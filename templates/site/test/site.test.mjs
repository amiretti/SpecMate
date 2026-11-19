// Rules (US-14 FR-001..FR-011, AC-1, AC-3, AC-5, AC-8; constitution XI): the site is built from relevamiento.json,
// validated before anything renders. Every publishable datum carries `source` and `confirmedBy`; a required one
// without them fails naming its full path; an unconfirmed optional one is dropped; an unknown key fails naming it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { directionsUrl, hoursText, loadRelevamiento, mapsUrl, parseRelevamiento } from '../src/lib/site.ts';
import { readExample, root } from './lib/build.mjs';

const EXAMPLES = ['address', 'area', 'online'];
const base = () => readExample('address');
const parse = (input) => parseRelevamiento(input, { root });
const CONFIRMED = 'fixture: cliente inventado, por WhatsApp, 2026-01-01';
const LOGO_LIGHT = 'src/assets/examples/logo-claro.svg';
const LOGO_DARK = 'src/assets/examples/logo-oscuro.svg';

function throwsNaming(mutate, name) {
  const input = base();
  mutate(input);
  assert.throws(
    () => parse(input),
    (error) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(`"${name}"`), `message "${error.message}" must name "${name}"`);
      return true;
    },
  );
}

/** The address example with only `channel` among the contact channels. */
function onlyChannel(channel) {
  const d = base();
  d.brief.contact = { [channel]: d.brief.contact[channel] };
  return d;
}

describe('example relevamientos (FR-013)', () => {
  for (const name of EXAMPLES) {
    it(`${name} parses and is marked as invented`, () => {
      const data = readExample(name);
      const site = parse(data);
      assert.match(data.$comment, /FICTITIOUS/);
      assert.match(site.exampleNotice ?? '', /ficticio/);
      assert.match(new URL(site.url).hostname, /\.example$/, 'reserved fictitious domain');
    });
  }
  it('the relevamiento.json at the repo root is valid; while it is the example, it is the address one (AC-11)', () => {
    const file = path.join(root, 'relevamiento.json');
    const site = loadRelevamiento(file, root);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (/FICTITIOUS/.test(data.$comment ?? '')) assert.deepEqual(data, readExample('address'));
    else assert.ok(site.name);
  });
  it('address has an address and no area; area has areas and no address; online has neither', () => {
    const [a, b, c] = EXAMPLES.map((n) => parse(readExample(n)));
    assert.ok(a.address);
    assert.equal(b.address, undefined);
    assert.ok(b.areaServed.length > 0);
    assert.equal(c.address, undefined);
    assert.deepEqual(c.areaServed, []);
  });
});

describe('the file (FR-001)', () => {
  it('needs $schemaVersion 1', () => {
    throwsNaming((d) => delete d.$schemaVersion, '$schemaVersion');
    throwsNaming((d) => Object.assign(d, { $schemaVersion: 2 }), '$schemaVersion');
  });
  it('needs a brief object', () => throwsNaming((d) => delete d.brief, 'brief'));
  it('accepts the steps of the relevamiento as an opaque object, ignored by the build', () => {
    const d = base();
    d.steps = { inventory: { done: true, anything: [1, 2] } };
    assert.equal(parse(d).name, 'Panadería El Horno Azul');
    throwsNaming((x) => Object.assign(x, { steps: 'hecho' }), 'steps');
  });
  it('a value that is not an object fails', () => {
    assert.throws(() => parse(null), /relevamiento/);
  });
  it('loadRelevamiento reads a file and names it when it is missing or not JSON', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'specmate-relevamiento-'));
    try {
      const missing = path.join(dir, 'no-existe.json');
      assert.throws(
        () => loadRelevamiento(missing, root),
        (e) => e.message.includes(missing),
      );
      const broken = path.join(dir, 'roto.json');
      await writeFile(broken, '{ "brief": ');
      assert.throws(
        () => loadRelevamiento(broken, root),
        (e) => e.message.includes(broken),
      );
      const good = path.join(dir, 'relevamiento.json');
      await writeFile(good, JSON.stringify(base()));
      assert.equal(loadRelevamiento(good, root).name, 'Panadería El Horno Azul');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('a required datum without source or confirmedBy fails naming its path (FR-003, AC-1)', () => {
  const rows = [
    ...['site', 'name', 'tagline', 'about'].map((key) => [key, (d) => d.brief[key]]),
    ...['phone', 'whatsapp', 'email'].map((channel) => [`contact.${channel} (single channel)`, null, channel]),
  ];
  for (const [label, pick, channel] of rows) {
    for (const field of ['source', 'confirmedBy']) {
      const datum = channel ? `contact.${channel}` : label;
      it(`${label} without ${field} -> brief.${datum}.${field}`, () => {
        const d = channel ? onlyChannel(channel) : base();
        delete (channel ? d.brief.contact[channel] : pick(d))[field];
        assert.throws(
          () => parse(d),
          (e) => e.message.includes(`"brief.${datum}.${field}"`) || assert.fail(e.message),
        );
      });
    }
  }
  it('an empty confirmedBy is unconfirmed: a required datum with it fails (plan decision 2)', () =>
    throwsNaming((d) => Object.assign(d.brief.name, { confirmedBy: '  ' }), 'brief.name.confirmedBy'));
  it('a confirmedBy that is not text fails', () =>
    throwsNaming((d) => Object.assign(d.brief.tagline, { confirmedBy: true }), 'brief.tagline.confirmedBy'));
  it('the old `confirmed` flag is an unknown key', () =>
    throwsNaming((d) => Object.assign(d.brief.about, { confirmed: true }), 'brief.about.confirmed'));
});

describe('an unknown key fails naming it, at every level (FR-011, AC-3)', () => {
  const cases = [
    ['top level', (d) => Object.assign(d, { breif: {} }), 'breif'],
    ['brief', (d) => Object.assign(d.brief, { telefono: '1' }), 'brief.telefono'],
    ['site', (d) => Object.assign(d.brief.site, { urls: 'x' }), 'brief.site.urls'],
    ['contact', (d) => Object.assign(d.brief.contact, { fax: {} }), 'brief.contact.fax'],
    ['a channel', (d) => Object.assign(d.brief.contact.phone, { whatsapp: true }), 'brief.contact.phone.whatsapp'],
    ['an hours entry', (d) => Object.assign(d.brief.hours[1], { open: '08:00' }), 'brief.hours[1].open'],
    ['the address', (d) => Object.assign(d.brief.address, { streetName: 'x' }), 'brief.address.streetName'],
    ['a FAQ entry', (d) => Object.assign(d.brief.faq[0], { answr: 'x' }), 'brief.faq[0].answr'],
    ['a profile', (d) => Object.assign(d.brief.profiles[0], { href: 'x' }), 'brief.profiles[0].href'],
    [
      'an allowed origin',
      (d) => d.brief.allowedOrigins.push({ origin: 'https://a.example', reason: 'x', why: 'y' }),
      'brief.allowedOrigins[0].why',
    ],
    ['the image', (d) => Object.assign(d.brief.image, { title: 'x' }), 'brief.image.title'],
  ];
  for (const [label, mutate, name] of cases) it(`${label} -> ${name}`, () => throwsNaming(mutate, name));
  it('$comment is accepted anywhere', () => {
    const d = base();
    d.brief.$comment = 'x';
    d.brief.name.$comment = 'x';
    d.brief.contact.$comment = 'x';
    assert.equal(parse(d).name, 'Panadería El Horno Azul');
  });
});

describe('contact: one confirmed channel is enough (FR-004, FR-005, AC-4, AC-5)', () => {
  for (const channel of ['phone', 'whatsapp', 'email']) {
    it(`only ${channel} -> parses with only that channel`, () => {
      const contact = parse(onlyChannel(channel)).contact;
      assert.deepEqual(Object.keys(contact), [channel]);
    });
  }
  it('no confirmed channel -> fails saying a contact channel is missing', () => {
    for (const mutate of [
      (d) => delete d.brief.contact,
      (d) => Object.assign(d.brief, { contact: {} }),
      (d) => {
        for (const c of Object.values(d.brief.contact)) delete c.confirmedBy;
      },
    ]) {
      const d = base();
      mutate(d);
      assert.throws(() => parse(d), /"brief\.contact".*contact channel/);
    }
  });
  it('an unconfirmed channel is dropped when another one is confirmed', () => {
    const d = base();
    delete d.brief.contact.phone.confirmedBy;
    assert.deepEqual(Object.keys(parse(d).contact).sort(), ['email', 'whatsapp']);
  });
  it('phone and WhatsApp are separate channels: a WhatsApp number is not a phone', () => {
    const site = parse(onlyChannel('whatsapp'));
    assert.equal(site.contact.phone, undefined);
    assert.equal(site.contact.whatsapp?.e164, '+541100000000');
  });
});

describe('field formats fail naming them', () => {
  const cases = [
    ['empty name', (d) => Object.assign(d.brief.name, { text: ' ' }), 'brief.name.text'],
    ['missing tagline', (d) => delete d.brief.tagline, 'brief.tagline'],
    ['missing about text', (d) => delete d.brief.about.text, 'brief.about.text'],
    ['missing image alt', (d) => Object.assign(d.brief, { image: {} }), 'brief.image.alt'],
    ['bad e164', (d) => Object.assign(d.brief.contact.phone, { e164: '011 1234' }), 'brief.contact.phone.e164'],
    [
      'display digits differ from e164',
      (d) => Object.assign(d.brief.contact.phone, { display: '+54 11 9999-0000' }),
      'brief.contact.phone.display',
    ],
    [
      'bad WhatsApp e164, even unconfirmed',
      (d) => Object.assign(d.brief.contact.whatsapp, { e164: '15-1234', confirmedBy: undefined }),
      'brief.contact.whatsapp.e164',
    ],
    ['phone without source', (d) => Object.assign(d.brief.contact.phone, { source: '' }), 'brief.contact.phone.source'],
    [
      'bad email',
      (d) => Object.assign(d.brief.contact.email, { address: 'no-at-sign' }),
      'brief.contact.email.address',
    ],
    // Security review: mailto header injection and characters that change a mailto: URL or break attributes.
    ...[
      'a@negocio.example?bcc=evil%40attacker.example&subject=%0d%0aX',
      'a@negocio.example#x',
      'a%0d@negocio.example',
      'a&b@negocio.example',
      'a"b@negocio.example',
      "a'b@negocio.example",
      'a b@negocio.example',
      'a@nego cio.example',
      'a\u0001b@negocio.example',
      'a@negocio.example\u0000',
      'a@negocio?.example',
      'a@negocio.example&cc=x',
    ].map((address) => [
      `email ${JSON.stringify(address)}`,
      (d) => Object.assign(d.brief.contact.email, { address }),
      'brief.contact.email.address',
    ]),
    [
      'a lone surrogate in the name',
      (d) => Object.assign(d.brief.name, { text: 'Pan \uD800 azul' }),
      'brief.name.text',
    ],
    [
      'a lone surrogate in a FAQ answer',
      (d) => Object.assign(d.brief.faq[0], { answer: 'Sí \uDC00' }),
      'brief.faq[0].answer',
    ],
    [
      'a lone surrogate in confirmedBy',
      (d) => Object.assign(d.brief.name, { confirmedBy: 'A \uD800' }),
      'brief.name.confirmedBy',
    ],
    ['hours not a list', (d) => Object.assign(d.brief, { hours: {} }), 'brief.hours'],
    ['opens without closes', (d) => delete d.brief.hours[0].closes, 'brief.hours[0]'],
    ['bad time', (d) => Object.assign(d.brief.hours[0], { opens: '7am' }), 'brief.hours[0].opens'],
    ['unknown day', (d) => Object.assign(d.brief.hours[0], { days: ['Lunes'] }), 'brief.hours[0].days'],
    ['hours without source', (d) => delete d.brief.hours[2].source, 'brief.hours[2].source'],
    ['address without street', (d) => Object.assign(d.brief.address, { street: '' }), 'brief.address.street'],
    ['address without source', (d) => Object.assign(d.brief.address, { source: '' }), 'brief.address.source'],
    ['FAQ without answer', (d) => Object.assign(d.brief.faq[0], { answer: '' }), 'brief.faq[0].answer'],
    ['FAQ without source', (d) => Object.assign(d.brief.faq[0], { source: '' }), 'brief.faq[0].source'],
    ['profile without source', (d) => Object.assign(d.brief.profiles[0], { source: '' }), 'brief.profiles[0].source'],
    [
      'an allowed origin with a path',
      (d) => d.brief.allowedOrigins.push({ origin: 'https://cdn.example/x', reason: 'x' }),
      'brief.allowedOrigins[0].origin',
    ],
  ];
  for (const [label, mutate, name] of cases) {
    it(`${label} -> error naming ${name}`, () => throwsNaming(mutate, name));
  }
});

describe('site URL (FR-004)', () => {
  it('is required', () => throwsNaming((d) => delete d.brief.site.url, 'brief.site.url'));
  it('must be https', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { url: 'http://horno-azul.example' }), 'brief.site.url'));
  it('must be absolute', () => throwsNaming((d) => Object.assign(d.brief.site, { url: '/inicio' }), 'brief.site.url'));
  it('must not carry a path that pageUrl would drop', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { url: 'https://a.example/tienda' }), 'brief.site.url'));
  it('must not carry credentials', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { url: 'https://user:pw@a.example' }), 'brief.site.url'));
  it('must not carry a fragment', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { url: 'https://a.example/#x' }), 'brief.site.url'));
  it('must not carry a query or fragment', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { url: 'https://a.example/?x=1' }), 'brief.site.url'));
  it('drops the trailing slash', () => {
    const d = base();
    d.brief.site.url = 'https://horno-azul.example/';
    assert.equal(parse(d).url, 'https://horno-azul.example');
  });
  it('accepts a Workers URL when there is no own domain (ADR-0040)', () => {
    const d = base();
    d.brief.site.url = 'https://horno-azul.cuenta-inventada.workers.dev';
    assert.equal(parse(d).url, 'https://horno-azul.cuenta-inventada.workers.dev');
  });
});

describe('AI crawler policy', () => {
  it('defaults to allow', () => {
    const d = base();
    delete d.brief.site.aiCrawlers;
    assert.equal(parse(d).aiCrawlers, 'allow');
  });
  it('accepts block', () => {
    const d = base();
    d.brief.site.aiCrawlers = 'block';
    assert.equal(parse(d).aiCrawlers, 'block');
  });
  it('rejects any other value', () =>
    throwsNaming((d) => Object.assign(d.brief.site, { aiCrawlers: 'maybe' }), 'brief.site.aiCrawlers'));
});

describe('unconfirmed optional data never reaches the site (FR-003, FR-006, AC-2)', () => {
  it('an unconfirmed address is absent', () => {
    const d = base();
    delete d.brief.address.confirmedBy;
    assert.equal(parse(d).address, undefined);
  });
  it('an unconfirmed service area is dropped', () => {
    const d = base();
    d.brief.areaServed = [
      { name: 'Zona A', source: 'llamada', confirmedBy: CONFIRMED },
      { name: 'Zona B', source: 'llamada' },
    ];
    assert.deepEqual(parse(d).areaServed, ['Zona A']);
  });
  it('an unconfirmed hours entry is dropped; hours are optional', () => {
    const d = base();
    delete d.brief.hours[1].confirmedBy;
    assert.deepEqual(
      parse(d).hours.map((h) => h.label),
      ['Lunes a viernes', 'Domingos'],
    );
    delete d.brief.hours;
    assert.deepEqual(parse(d).hours, []);
  });
  it('FAQ keeps only confirmed items, in order, with identical text', () => {
    const d = base();
    const confirmed = d.brief.faq.filter((f) => f.confirmedBy).map(({ question, answer }) => ({ question, answer }));
    assert.equal(d.brief.faq.length, 3);
    assert.equal(confirmed.length, 2);
    assert.deepEqual(parse(d).faq, confirmed);
  });
  it('profiles keep only confirmed https URLs', () => {
    const d = base();
    assert.equal(d.brief.profiles.length, 3);
    assert.deepEqual(
      parse(d).profiles,
      d.brief.profiles.filter((p) => p.confirmedBy).map((p) => p.url),
    );
  });
  it('an unconfirmed free section, logo, geo or Maps link is dropped', () => {
    const d = base();
    d.brief.sections = [{ id: 'como-funciona', title: 'Cómo funciona', body: 'x', source: 's' }];
    d.brief.logo = { light: LOGO_LIGHT, alt: 'Logo', source: 's' };
    d.brief.geo = { latitude: -34.6, longitude: -58.4, source: 's' };
    d.brief.mapsUrl = { url: 'https://maps.example/x', source: 's' };
    const site = parse(d);
    assert.deepEqual(site.sections, []);
    assert.equal(site.logo, undefined);
    assert.equal(site.geo, undefined);
    assert.equal(site.mapsUrl, undefined);
  });
  it('a profile URL with credentials fails (security review)', () => {
    throwsNaming(
      (d) => Object.assign(d.brief.profiles[0], { url: 'https://trusted.example@evil.example/x' }),
      'brief.profiles[0].url',
    );
    throwsNaming(
      (d) => Object.assign(d.brief.profiles[1], { url: 'https://user:pw@social-dos.example/x' }),
      'brief.profiles[1].url',
    );
  });
  it('accepts a plain email address', () => {
    const d = base();
    d.brief.contact.email.address = 'ventas.norte+web@horno-azul.example';
    assert.equal(parse(d).contact.email, 'ventas.norte+web@horno-azul.example');
  });
  it('a non-https profile fails even if unconfirmed', () => {
    throwsNaming(
      (d) => Object.assign(d.brief.profiles[2], { url: 'http://perfil.example/horno' }),
      'brief.profiles[2].url',
    );
    throwsNaming((d) => Object.assign(d.brief.profiles[0], { url: 'ftp://perfil.example/x' }), 'brief.profiles[0].url');
  });
});

describe('free content sections (FR-007)', () => {
  const section = (extra) => ({ source: 's', confirmedBy: CONFIRMED, ...extra });
  it('keeps confirmed sections in their order, with text or a list', () => {
    const d = base();
    d.brief.sections = [
      section({ id: 'como-funciona', title: 'Cómo funciona', body: 'Pedís y retirás.' }),
      section({ id: 'que-incluye', title: 'Qué incluye', items: ['Pan', 'Facturas'] }),
    ];
    assert.deepEqual(parse(d).sections, [
      { id: 'como-funciona', title: 'Cómo funciona', body: 'Pedís y retirás.' },
      { id: 'que-incluye', title: 'Qué incluye', items: ['Pan', 'Facturas'] },
    ]);
  });
  const bad = [
    ['an id that is not lowercase and hyphens', { id: 'Cómo Funciona', title: 't', body: 'b' }, 'brief.sections[0].id'],
    ['an id taken by the page', { id: 'contacto', title: 't', body: 'b' }, 'brief.sections[0].id'],
    ['both body and items', { id: 'a', title: 't', body: 'b', items: ['x'] }, 'brief.sections[0]'],
    ['neither body nor items', { id: 'a', title: 't' }, 'brief.sections[0]'],
    ['an empty list', { id: 'a', title: 't', items: [] }, 'brief.sections[0].items'],
    ['an empty list item', { id: 'a', title: 't', items: ['x', ' '] }, 'brief.sections[0].items[1]'],
    ['no title', { id: 'a', body: 'b' }, 'brief.sections[0].title'],
  ];
  for (const [label, raw, name] of bad) {
    it(`${label} -> ${name}`, () => throwsNaming((d) => Object.assign(d.brief, { sections: [section(raw)] }), name));
  }
  it('a repeated id fails naming the second one', () =>
    throwsNaming(
      (d) =>
        Object.assign(d.brief, {
          sections: [section({ id: 'a', title: 't', body: 'b' }), section({ id: 'a', title: 'u', body: 'c' })],
        }),
      'brief.sections[1].id',
    ));
});

describe('logo (FR-008, AC-8)', () => {
  const logo = (extra) => ({ light: LOGO_LIGHT, alt: 'Logo inventado', source: 's', confirmedBy: CONFIRMED, ...extra });
  it('keeps a confirmed logo for light and dark backgrounds with its alt', () => {
    const d = base();
    d.brief.logo = logo({ dark: LOGO_DARK });
    assert.deepEqual(parse(d).logo, { light: LOGO_LIGHT, dark: LOGO_DARK, alt: 'Logo inventado' });
  });
  const bad = [
    ['a path that leaves the repo', { light: '../x.svg' }, 'brief.logo.light'],
    ['a path that leaves the repo midway', { light: 'src/assets/../../../x.svg' }, 'brief.logo.light'],
    ['an absolute path', { light: path.join(root, LOGO_LIGHT) }, 'brief.logo.light'],
    ['a root-relative path', { light: `/${LOGO_LIGHT}` }, 'brief.logo.light'],
    ['a file that does not exist', { light: 'src/assets/examples/no-existe.svg' }, 'brief.logo.light'],
    ['a dark file that does not exist', { dark: 'src/assets/examples/no-existe.svg' }, 'brief.logo.dark'],
    ['a file outside src/assets', { light: 'package.json' }, 'brief.logo.light'],
    ['a directory', { light: 'src/assets/examples' }, 'brief.logo.light'],
    ['no alt', { alt: '' }, 'brief.logo.alt'],
  ];
  for (const [label, extra, name] of bad) {
    it(`${label} -> ${name}, even unconfirmed`, () => {
      throwsNaming((d) => Object.assign(d.brief, { logo: logo(extra) }), name);
      throwsNaming((d) => Object.assign(d.brief, { logo: { ...logo(extra), confirmedBy: undefined } }), name);
    });
  }
});

describe('coordinates and Maps link (FR-009)', () => {
  const geo = (latitude, longitude) => ({ latitude, longitude, source: 's', confirmedBy: CONFIRMED });
  it('keeps valid confirmed coordinates and an https Maps link', () => {
    const d = base();
    d.brief.geo = geo(-34.6037, -58.3816);
    d.brief.mapsUrl = { url: 'https://maps.example/?q=horno', source: 's', confirmedBy: CONFIRMED };
    const site = parse(d);
    assert.deepEqual(site.geo, { latitude: -34.6037, longitude: -58.3816 });
    assert.equal(site.mapsUrl, 'https://maps.example/?q=horno');
  });
  const bad = [
    ['latitude above 90', (d) => Object.assign(d.brief, { geo: geo(90.1, 0) }), 'brief.geo.latitude'],
    ['latitude below -90', (d) => Object.assign(d.brief, { geo: geo(-91, 0) }), 'brief.geo.latitude'],
    ['longitude above 180', (d) => Object.assign(d.brief, { geo: geo(0, 181) }), 'brief.geo.longitude'],
    ['longitude as text', (d) => Object.assign(d.brief, { geo: geo(0, '-58.3') }), 'brief.geo.longitude'],
    [
      'a non-https Maps link',
      (d) => Object.assign(d.brief, { mapsUrl: { url: 'http://maps.example/x', source: 's' } }),
      'brief.mapsUrl.url',
    ],
    [
      'a javascript: Maps link',
      (d) => Object.assign(d.brief, { mapsUrl: { url: 'javascript:alert(1)', source: 's', confirmedBy: CONFIRMED } }),
      'brief.mapsUrl.url',
    ],
  ];
  for (const [label, mutate, name] of bad) it(`${label} -> ${name}`, () => throwsNaming(mutate, name));
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
  it('"Cómo llegar" uses the confirmed Maps link first, then the address (FR-009)', () => {
    const address = { street: 'Calle 1', locality: 'Ciudad', country: 'AR' };
    assert.equal(directionsUrl({ address, mapsUrl: 'https://maps.example/x' }), 'https://maps.example/x');
    assert.equal(directionsUrl({ address }), mapsUrl(address));
    assert.equal(directionsUrl({}), undefined);
  });
});
