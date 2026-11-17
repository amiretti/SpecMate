// Rule (FR-012, AC-12, ADR-0035 "Como se impone"): every package in the lockfile complies with the licence
// list of its group (shipped in dist/ vs build-only), and an out-of-list, missing or unclassified licence fails.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkLockfile, forbiddenPackages, LICENSE_EXCEPTIONS } from './lib/licenses.mjs';

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

// ADR-0038 decision 4: an out-of-list licence in a build-only package passes only as a per-package exception.
describe('per-package licence exceptions (ADR-0038)', () => {
  const pkgs = (entries) => ({
    lockfileVersion: 3,
    packages: {
      '': {},
      ...Object.fromEntries(
        entries.map(([k, license, dev = true]) => [k, { version: '1.0.0', license, ...(dev ? { dev: true } : {}) }]),
      ),
    },
  });
  const exceptions = [{ name: 'odd', license: 'WTFPL', reason: 'fixture' }];

  it('accepts a build-only package listed with its exact licence', () => {
    assert.deepEqual(checkLockfile(pkgs([['node_modules/odd', 'WTFPL']]), { exceptions }), []);
  });
  it('accepts it when nested under another package', () => {
    assert.deepEqual(checkLockfile(pkgs([['node_modules/a/node_modules/odd', 'WTFPL']]), { exceptions }), []);
  });
  it('fails a new package with the same licence that is not in the table', () => {
    const problems = checkLockfile(
      pkgs([
        ['node_modules/odd', 'WTFPL'],
        ['node_modules/other', 'WTFPL'],
      ]),
      { exceptions },
    );
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], /node_modules\/other.*WTFPL/);
  });
  it('fails a listed package whose licence changed', () => {
    const problems = checkLockfile(pkgs([['node_modules/odd', 'Artistic-2.0']]), { exceptions });
    assert.ok(
      problems.some((p) => /node_modules\/odd.*Artistic-2\.0/.test(p)),
      problems.join('\n'),
    );
  });
  it('fails a table entry that no longer matches any package in the lockfile', () => {
    const problems = checkLockfile(pkgs([]), { exceptions });
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], /exception odd \(WTFPL\).*not in the lockfile/);
  });
  it('never excuses a shipped package', () => {
    const problems = checkLockfile(pkgs([['node_modules/odd', 'WTFPL', false]]), { exceptions });
    assert.ok(
      problems.some((p) => /node_modules\/odd \(shipped\)/.test(p)),
      problems.join('\n'),
    );
  });
  it('every exception in the table names a package, a licence and a reason', () => {
    assert.ok(LICENSE_EXCEPTIONS.length > 0);
    for (const e of LICENSE_EXCEPTIONS) {
      for (const field of ['name', 'license', 'reason'])
        assert.ok(typeof e[field] === 'string' && e[field].trim(), `${JSON.stringify(e)}: ${field}`);
    }
  });
});

describe('local links', () => {
  it('a link whose target is in the lockfile is checked through the target', () => {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/@sentry/node': { resolved: 'vendor/sentry-stub', link: true },
        'vendor/sentry-stub': { name: '@sentry/node', version: '0.0.0', dev: true, license: 'MIT' },
      },
    };
    assert.deepEqual(checkLockfile(lock), []);
  });
  it('a link target with an out-of-list licence fails', () => {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/x': { resolved: 'vendor/x', link: true },
        'vendor/x': { name: 'x', version: '0.0.0', dev: true, license: 'GPL-3.0-only' },
      },
    };
    assert.equal(checkLockfile(lock).length, 1);
  });
});

// ADR-0038 "Como se impone": sentry (FSL) and oxc-parser (native) must never come back with lighthouse.
describe('forbidden packages (ADR-0038)', () => {
  const lock = (packages) => ({ lockfileVersion: 3, packages: { '': {}, ...packages } });
  for (const key of [
    'node_modules/sentry',
    'node_modules/oxc-parser',
    'node_modules/@oxc-parser/binding-win32-x64-msvc',
    'node_modules/@sentry/core',
    'node_modules/lighthouse/node_modules/sentry',
  ]) {
    it(`flags ${key}`, () => {
      assert.deepEqual(forbiddenPackages(lock({ [key]: { version: '1.0.0' } })), [key]);
    });
  }
  it('flags @sentry/node when it is the real package, not the local stub', () => {
    assert.deepEqual(forbiddenPackages(lock({ 'node_modules/@sentry/node': { version: '10.0.0' } })), [
      'node_modules/@sentry/node',
    ]);
  });
  it('accepts @sentry/node linked to vendor/sentry-stub', () => {
    assert.deepEqual(
      forbiddenPackages(lock({ 'node_modules/@sentry/node': { resolved: 'vendor/sentry-stub', link: true } })),
      [],
    );
  });
});

describe('real lockfile', () => {
  it('complies with the constitution lists, group by group, with the ADR-0038 exceptions', async () => {
    assert.deepEqual(checkLockfile(await read('../package-lock.json'), { exceptions: LICENSE_EXCEPTIONS }), []);
  });

  it('has neither sentry nor oxc-parser (ADR-0038)', async () => {
    assert.deepEqual(forbiddenPackages(await read('../package-lock.json')), []);
  });

  it('ships only the font: nothing else is published in dist/ (build tools are devDependencies)', async () => {
    const lock = await read('../package-lock.json');
    const shipped = Object.entries(lock.packages).filter(([k, v]) => k && !v.link && !v.dev && !v.devOptional);
    assert.ok(shipped.length > 0, 'no shipped packages found');
    for (const [name, pkg] of shipped) {
      assert.match(name, /^node_modules\/@fontsource/, `${name} is shipped but is not a font`);
      assert.equal(pkg.license, 'OFL-1.1');
    }
  });
});
