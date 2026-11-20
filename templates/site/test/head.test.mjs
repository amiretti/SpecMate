// Rules (FR-005, AC-5): every page has a unique <title>, a meta description, an absolute canonical and Open Graph
// (og:title, og:description, og:type, og:url, absolute og:image with its alt), the image is <= 250 KB. A missing
// site URL fails the build (build-failures.test.mjs).
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildHead } from '../src/lib/head.ts';
import { FIXTURES, readPages, siteOf, VARIANTS } from './lib/build.mjs';
import { metas, tags, titles } from './lib/html.mjs';

const MAX_BYTES = 250 * 1000;

describe('buildHead', () => {
  const site = siteOf(VARIANTS.address.data);
  const head = buildHead(site, {
    path: '/',
    title: 'Título',
    description: 'Descripción',
    image: { src: '/_astro/og.jpg', alt: 'Alt' },
  });
  it('makes the canonical and og:url absolute on the site URL', () => {
    assert.equal(head.canonical, 'https://horno-azul.example/');
    assert.equal(head.og['og:url'], head.canonical);
  });
  it('makes og:image absolute and keeps its alt', () => {
    assert.equal(head.og['og:image'], 'https://horno-azul.example/_astro/og.jpg');
    assert.equal(head.og['og:image:alt'], 'Alt');
  });
  it('carries title, description and type', () => {
    assert.equal(head.title, 'Título');
    assert.equal(head.description, 'Descripción');
    assert.deepEqual(
      [head.og['og:title'], head.og['og:description'], head.og['og:type']],
      ['Título', 'Descripción', 'website'],
    );
  });
});

for (const [name, target] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
  describe(`${name}: head of every page`, () => {
    it('has one non-empty <title>, unique across the site', async () => {
      const pages = await readPages(target.out);
      const all = pages.map(({ rel, html }) => {
        const found = titles(html);
        assert.equal(found.length, 1, `${rel}: one <title>`);
        assert.ok(found[0].trim(), `${rel}: empty <title>`);
        return found[0];
      });
      assert.equal(new Set(all).size, all.length, `titles repeat: ${all.join(' | ')}`);
    });

    it('has meta description, absolute canonical and the Open Graph set', async () => {
      for (const { rel, html } of await readPages(target.out)) {
        const [description] = metas(html, 'description');
        assert.ok(description?.trim(), `${rel}: meta description`);
        const canonicals = tags(html, 'link').filter((l) => l.rel === 'canonical');
        assert.equal(canonicals.length, 1, `${rel}: one canonical`);
        const canonical = new URL(canonicals[0].href);
        assert.equal(canonical.protocol, 'https:', `${rel}: canonical must be absolute https`);
        for (const key of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:alt']) {
          const values = metas(html, key);
          assert.equal(values.length, 1, `${rel}: one ${key}`);
          assert.ok(values[0]?.trim(), `${rel}: empty ${key}`);
        }
        assert.equal(metas(html, 'og:url')[0], canonical.href, `${rel}: og:url equals canonical`);
        assert.equal(metas(html, 'og:description')[0], description, `${rel}: og:description equals description`);
        const image = new URL(metas(html, 'og:image')[0]);
        assert.equal(image.origin, canonical.origin, `${rel}: og:image absolute on the site`);
      }
    });

    it('og:image is a built file of at most 250 KB', async () => {
      for (const { rel, html } of await readPages(target.out)) {
        const image = new URL(metas(html, 'og:image')[0]);
        const file = path.join(target.out, ...decodeURIComponent(image.pathname).split('/').filter(Boolean));
        const { size } = await stat(file);
        assert.ok(size <= MAX_BYTES, `${rel}: og:image is ${size} B`);
      }
    });
  });
}
