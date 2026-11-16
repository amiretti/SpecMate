// Rules (FR-003, AC-2, ADR-0035 "Negocios sin dirección"): the schema.org type follows the confirmed data; no
// address without a confirmed one; never aggregateRating, review or geo.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import address from '../src/data/examples/address.ts';
import area from '../src/data/examples/area.ts';
import online from '../src/data/examples/online.ts';
import { buildSchema } from '../src/lib/schema.ts';
import { parseSite } from '../src/lib/site.ts';
import { readPages, VARIANTS } from './lib/build.mjs';
import { splitJsonLd } from './lib/jsonld.mjs';

const IMAGE = 'https://example.test/_astro/og.jpg';
const FORBIDDEN = ['aggregateRating', 'review', 'geo'];

/** Every key used anywhere in a JSON value. */
function keys(value, out = new Set()) {
  if (Array.isArray(value)) for (const item of value) keys(item, out);
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      out.add(key);
      keys(item, out);
    }
  }
  return out;
}

const business = (graph) => graph['@graph'].find((n) => ['LocalBusiness', 'Organization'].includes(n['@type']));

// One row per case (data-model.md "Variantes de ejemplo y tipo de schema").
const TABLE = {
  address: {
    data: address,
    type: 'LocalBusiness',
    present: ['address', 'openingHoursSpecification', 'telephone', 'email', 'url'],
    absent: ['areaServed'],
  },
  area: {
    data: area,
    type: 'LocalBusiness',
    present: ['areaServed', 'openingHoursSpecification', 'telephone', 'email', 'url'],
    absent: ['address'],
  },
  online: {
    data: online,
    type: 'Organization',
    present: ['url', 'contactPoint'],
    absent: ['address', 'areaServed', 'openingHoursSpecification'],
  },
};

describe('schema type per case', () => {
  for (const [name, row] of Object.entries(TABLE)) {
    it(`${name}: ${row.type} with ${row.present.join(', ')}; without ${[...row.absent, ...FORBIDDEN].join(', ')}`, () => {
      const graph = buildSchema(parseSite(row.data), IMAGE);
      assert.equal(graph['@context'], 'https://schema.org');
      const node = business(graph);
      assert.equal(node['@type'], row.type);
      for (const key of row.present) assert.ok(key in node, `${name} lacks ${key}`);
      for (const key of row.absent) assert.equal(key in node, false, `${name} must not have ${key}`);
      const used = keys(graph);
      for (const key of FORBIDDEN) assert.equal(used.has(key), false, `${name} must never carry ${key}`);
    });
  }

  it('address: the PostalAddress carries the confirmed fields', () => {
    const node = business(buildSchema(parseSite(address), IMAGE));
    assert.deepEqual(node.address, {
      '@type': 'PostalAddress',
      streetAddress: 'Calle Ficticia 123',
      addressLocality: 'Ciudad de Ejemplo',
      addressRegion: 'Provincia Inventada',
      postalCode: 'X0000',
      addressCountry: 'AR',
    });
  });

  it('an unconfirmed address yields no address (constitution XI)', () => {
    const data = structuredClone(address);
    data.address.confirmed = false;
    assert.equal('address' in business(buildSchema(parseSite(data), IMAGE)), false);
  });

  it('online: the contact point carries phone, email and hours', () => {
    const node = business(buildSchema(parseSite(online), IMAGE));
    assert.equal(node.contactPoint['@type'], 'ContactPoint');
    assert.equal(node.contactPoint.telephone, '+541100002222');
    assert.equal(node.contactPoint.email, 'pedidos@hoja-suelta.example');
    assert.equal(node.contactPoint.hoursAvailable.length, 1);
  });

  it('mixed case: a confirmed address and service area emit both (spec §6 assumption)', () => {
    const data = { ...structuredClone(address), areaServed: [{ name: 'Zona X', source: 'fixture', confirmed: true }] };
    const node = business(buildSchema(parseSite(data), IMAGE));
    assert.equal(node['@type'], 'LocalBusiness');
    assert.ok(node.address);
    assert.deepEqual(node.areaServed, ['Zona X']);
  });

  it('closed days produce no opening hours entry; open ones keep HH:MM', () => {
    const node = business(buildSchema(parseSite(address), IMAGE));
    assert.deepEqual(node.openingHoursSpecification, [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '20:00',
      },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '08:00', closes: '14:00' },
    ]);
  });
});

describe('built variants carry the schema of their data', () => {
  for (const [name, row] of Object.entries(TABLE)) {
    it(`${name}: the block equals buildSchema of its data`, async () => {
      const index = (await readPages(VARIANTS[name].out)).find((p) => p.rel === 'index.html');
      assert.ok(index);
      const [graph] = splitJsonLd(index.html).blocks;
      const site = parseSite(row.data);
      const image = business(graph).image;
      assert.ok(image.startsWith(`${site.url}/`), `image ${image} must be absolute on the site`);
      assert.deepEqual(graph, buildSchema(site, image));
    });
  }
});
