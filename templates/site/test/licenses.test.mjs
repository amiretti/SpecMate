// Rule (FR-012, AC-12, ADR-0035 "Como se impone"): every package in the lockfile complies with the licence
// list of its group (shipped in dist/ vs build-only), and an out-of-list, missing or unclassified licence fails.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkLockfile } from './lib/licenses.mjs';

const read = async (rel) => JSON.parse(await readFile(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const fixture = (name) => read(`./fixtures/licenses/${name}.json`);

describe('licence checker, fixtures', () => {
  it('accepts a lockfile that complies in both groups', async () => {
    assert.deepEqual(checkLockfile(await fixture('ok')), []);
  });

  for (const [name, expected] of [
    ['prod-gpl', /node_modules\/bad.*GPL-3\.0-only/],
    ['dev-gpl', /node_modules\/bad.*AGPL-3\.0-or-later/],
    ['prod-lgpl', /node_modules\/bad.*LGPL-3\.0/],
    ['prod-missing', /node_modules\/bad.*no licence/],
    ['dev-missing', /node_modules\/bad.*no licence/],
    ['unclassified', /node_modules\/bad.*unclassified/],
    ['unclassified-link', /node_modules\/bad.*unclassified/],
    ['prod-ofl-not-font', /node_modules\/bad.*OFL-1\.1/],
  ]) {
    it(`fails on ${name}, naming the package`, async () => {
      const problems = checkLockfile(await fixture(name));
      assert.equal(problems.length, 1, problems.join('\n'));
      assert.match(problems[0], expected);
    });
  }

  it('names the group in the message', async () => {
    assert.match(checkLockfile(await fixture('prod-lgpl'))[0], /shipped/);
    assert.match(checkLockfile(await fixture('dev-gpl'))[0], /build-only/);
  });
});

describe('licence expressions', () => {
  const lock = (license, dev) => ({
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/x': { version: '1.0.0', license, ...(dev ? { dev: true } : {}) } },
  });
  it('OR passes when any alternative is allowed', () => {
    assert.deepEqual(checkLockfile(lock('GPL-3.0-only OR MIT', false)), []);
  });
  it('AND needs every term allowed', () => {
    assert.equal(checkLockfile(lock('MIT AND GPL-3.0-only', false)).length, 1);
    assert.equal(checkLockfile(lock('Apache-2.0 AND LGPL-3.0-or-later', false)).length, 1);
    assert.deepEqual(checkLockfile(lock('Apache-2.0 AND LGPL-3.0-or-later', true)), []);
  });
  it('rejects an unparsable expression', () => {
    assert.equal(checkLockfile(lock('MIT OR', false)).length, 1);
    assert.equal(checkLockfile(lock('', false)).length, 1);
  });
});

describe('real lockfile', () => {
  it('complies with the constitution lists, group by group', async () => {
    assert.deepEqual(checkLockfile(await read('../package-lock.json')), []);
  });

  it('ships only the font: nothing else is published in dist/ (build tools are devDependencies)', async () => {
    const lock = await read('../package-lock.json');
    const shipped = Object.entries(lock.packages).filter(([k, v]) => k && !v.dev && !v.devOptional);
    assert.ok(shipped.length > 0, 'no shipped packages found');
    for (const [name, pkg] of shipped) {
      assert.match(name, /^node_modules\/@fontsource/, `${name} is shipped but is not a font`);
      assert.equal(pkg.license, 'OFL-1.1');
    }
  });
});
