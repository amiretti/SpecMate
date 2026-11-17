// Rule (FR-012, ADR-0038 decision 3): `npm audit --audit-level=high` over the whole template tree, dev included,
// with threshold 0 high or critical. The site that fails on purpose is an invented lockfile with a known high.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../scripts/controls/deps.mjs';
import { copyBuild, removeBuild } from './lib/mutate.mjs';

const fixture = fileURLToPath(new URL('./fixtures/audit/', import.meta.url));
const siteRoot = fileURLToPath(new URL('../', import.meta.url));

describe('check:deps', () => {
  it('fails on a lockfile with a high advisory and names the package', async () => {
    const dir = await copyBuild(fixture);
    try {
      const result = run(dir);
      assert.equal(result.ok, false);
      assert.ok(
        result.violations.some((v) => /lodash.*high/.test(v)),
        result.violations.join('\n'),
      );
    } finally {
      await removeBuild(dir);
    }
  });

  it('fails, does not pass, when npm audit cannot answer (VI)', async () => {
    const dir = await copyBuild(fixture);
    try {
      const result = run(dir, { registry: 'http://127.0.0.1:9/' });
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /could not audit/);
    } finally {
      await removeBuild(dir);
    }
  });

  it('passes on the template tree, dev dependencies included', () => {
    const result = run(siteRoot);
    assert.deepEqual(result.violations, []);
    assert.equal(result.ok, true);
  });

  it('the npm script audits the whole tree at level high, without --omit=dev', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(pkg.scripts['check:deps'], /scripts\/controls\/deps\.mjs/);
    const source = await readFile(new URL('../scripts/controls/deps.mjs', import.meta.url), 'utf8');
    assert.match(source, /--audit-level=high/);
    assert.doesNotMatch(source, /--omit/);
  });
});
