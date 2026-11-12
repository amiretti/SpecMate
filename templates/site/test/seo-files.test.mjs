// Rules (FR-006, FR-007, AC-6, AC-7): sitemap.xml lists every content page with an absolute URL and never the
// 404; robots.txt points to it and gives each AI crawler of the template's single list its own group, all with
// the action of the per-site setting (default allow); 404.html has the site frame and no JSON-LD.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AI_CRAWLERS } from '../src/lib/ai-crawlers.ts';
import { buildRobots } from '../src/lib/robots.ts';
import { parseSite } from '../src/lib/site.ts';
import { buildSitemap, contentRoutes } from '../src/lib/sitemap.ts';
import { FIXTURES, readPages, VARIANTS } from './lib/build.mjs';
import { checkJsonLd } from './lib/jsonld.mjs';
import { element, metas, tags, titles } from './lib/html.mjs';

const SITE = 'https://horno-azul.example';
const groups = (robots) =>
  robots
    .trim()
    .split(/\r?\n\r?\n/)
    .map((g) => g.split(/\r?\n/));

describe('AI crawler list', () => {
  it('has at least 5 agents, none empty or repeated (case-insensitive)', () => {
    assert.ok(AI_CRAWLERS.length >= 5);
    assert.ok(AI_CRAWLERS.every((a) => /^[A-Za-z][A-Za-z0-9-]*$/.test(a)));
    assert.equal(new Set(AI_CRAWLERS.map((a) => a.toLowerCase())).size, AI_CRAWLERS.length);
  });
});

describe('buildRobots', () => {
  const allow = buildRobots(SITE, 'allow', AI_CRAWLERS);
  const block = buildRobots(SITE, 'block', AI_CRAWLERS);

  for (const [policy, robots, action] of [
    ['allow', allow, 'Allow: /'],
    ['block', block, 'Disallow: /'],
  ]) {
    it(`${policy}: one explicit group per AI crawler, all with "${action}"`, () => {
      for (const agent of AI_CRAWLERS) {
        const group = groups(robots).filter((g) => g[0] === `User-agent: ${agent}`);
        assert.equal(group.length, 1, agent);
        assert.deepEqual(group[0], [`User-agent: ${agent}`, action]);
      }
    });
  }

  it('changing the setting changes only the AI crawler groups', () => {
    const a = allow.split('\n');
    const b = block.split('\n');
    assert.equal(a.length, b.length);
    const changed = a.flatMap((line, i) => (line === b[i] ? [] : [a[i - 1]]));
    assert.deepEqual(changed, AI_CRAWLERS.map((agent) => `User-agent: ${agent}`));
  });

  it('every other crawler may read the whole site, and the sitemap is absolute', () => {
    assert.deepEqual(groups(allow)[0], ['User-agent: *', 'Allow: /']);
    assert.match(allow, /^Sitemap: https:\/\/horno-azul\.example\/sitemap\.xml$/m);
  });

  it('lists no path other than "/" (no sensitive routes)', () => {
    for (const robots of [allow, block]) {
      const paths = [...robots.matchAll(/^(?:Allow|Disallow):\s*(.*)$/gm)].map((m) => m[1]);
      assert.deepEqual([...new Set(paths)], ['/']);
    }
  });

  const broken = {
    'a repeated agent': [...AI_CRAWLERS, AI_CRAWLERS[0]],
    'a repeated agent in another case': [...AI_CRAWLERS, AI_CRAWLERS[0].toUpperCase()],
    'an empty agent': [...AI_CRAWLERS, ' '],
    'an agent with a line break': [...AI_CRAWLERS, 'Bot\nDisallow: /'],
    'the wildcard agent': [...AI_CRAWLERS, '*'],
  };
  for (const [name, list] of Object.entries(broken)) {
    it(`fails the build with ${name}`, () => {
      assert.throws(() => buildRobots(SITE, 'allow', list), /AI crawler/);
    });
  }
  it('fails with an unknown policy', () => {
    assert.throws(() => buildRobots(SITE, 'maybe', AI_CRAWLERS), /policy/);
  });
});

describe('sitemap helpers', () => {
  it('maps page files to routes, without the 404', () => {
    assert.deepEqual(contentRoutes(['./index.astro', './404.astro', './servicios.astro', './blog/index.astro']), [
      '/',
      '/blog/',
      '/servicios/',
    ]);
  });
  it('refuses dynamic routes it cannot list', () => {
    assert.throws(() => contentRoutes(['./[slug].astro']), /dynamic/);
  });
  it('escapes XML in URLs', () => {
    assert.match(buildSitemap(SITE, ['/a&b/']), /<loc>https:\/\/horno-azul\.example\/a&amp;b\/<\/loc>/);
  });
});

for (const [name, target] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
  describe(`${name}: built sitemap, robots and 404`, () => {
    const read = (file) => readFile(path.join(target.out, file), 'utf8');
    const data = async () => parseSite((await import(`file:///${target.data.replaceAll('\\', '/')}`)).default);

    it('sitemap.xml lists 100 % of the content pages, absolute, and 0 times the 404', async () => {
      const site = await data();
      const sitemap = await read('sitemap.xml');
      const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
      const expected = (await readPages(target.out))
        .filter((p) => p.content)
        .map((p) => `${site.url}/${p.rel.replace(/index\.html$/, '')}`);
      assert.deepEqual(locs.sort(), expected.sort());
      assert.equal(sitemap.includes('404'), false);
      assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    });

    it('robots.txt is the one the setting builds and points to the absolute sitemap', async () => {
      const site = await data();
      const robots = await read('robots.txt');
      assert.equal(robots, buildRobots(site.url, site.aiCrawlers, AI_CRAWLERS));
      assert.ok(robots.includes(`Sitemap: ${site.url}/sitemap.xml`));
    });

    it('404.html has the site frame, a link home, noindex and no JSON-LD nor contact data', async () => {
      const html = await read('404.html');
      for (const landmark of ['header', 'nav', 'main', 'footer']) assert.ok(element(html, landmark) !== undefined, landmark);
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      assert.ok(tags(html, 'a').some((a) => a.href === '/'), 'link to the home page');
      assert.ok(titles(html)[0]);
      assert.deepEqual(metas(html, 'robots'), ['noindex']);
      assert.deepEqual(checkJsonLd(html, 0).problems, []);
      assert.doesNotMatch(html, /tel:|mailto:|<address/);
    });
  });
}

describe('per-site setting reaches the build', () => {
  it('the online example blocks and the address example allows', async () => {
    const online = await readFile(path.join(VARIANTS.online.out, 'robots.txt'), 'utf8');
    const address = await readFile(path.join(VARIANTS.address.out, 'robots.txt'), 'utf8');
    assert.ok(online.includes(`User-agent: ${AI_CRAWLERS[0]}\nDisallow: /`));
    assert.ok(address.includes(`User-agent: ${AI_CRAWLERS[0]}\nAllow: /`));
  });
});
