// Rule (US-12 AC-2 edge case, plan decision 2): every site that fails on purpose breaks EXACTLY ONE control. A
// mutant that also breaks another control is useless as evidence, so each one runs against all 7 site controls:
// its own must fail, naming the violation, and the other 6 must pass. check:deps audits a lockfile, not a build, so
// its fixture is isolated by construction (test/deps.test.mjs).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { run as a11y } from '../scripts/controls/a11y.mjs';
import { run as behavior } from '../scripts/controls/behavior.mjs';
import { run as html } from '../scripts/controls/html.mjs';
import { run as lighthouse } from '../scripts/controls/lighthouse.mjs';
import { run as links } from '../scripts/controls/links.mjs';
import { run as origins } from '../scripts/controls/origins.mjs';
import { run as secrets } from '../scripts/controls/secrets.mjs';
import { VARIANTS } from './lib/build.mjs';
import { mutant, removeBuild } from './lib/mutate.mjs';
import { BROWSER_MUTATIONS } from './lib/mutations-browser.mjs';
import { STATIC_MUTATIONS } from './lib/mutations-static.mjs';
import { distDir } from './lib/paths.mjs';

// One Lighthouse run per mutant (risk R1): the median of 3 is pinned by the control's own tests and by `npm run controls`.
const CONTROLS = {
  behavior: (dir) => behavior(dir),
  a11y: (dir) => a11y(dir),
  lighthouse: (dir) => lighthouse(dir, { runs: 1 }),
  html: (dir) => html(dir),
  links: (dir) => links(dir),
  secrets: (dir) => secrets(dir),
  origins: (dir) => origins(dir, { data: VARIANTS.address.data }),
};

const ROWS = [...STATIC_MUTATIONS, ...BROWSER_MUTATIONS];

describe('sites that fail on purpose: one control each', { concurrency: false }, () => {
  it('there is at least one mutant per site control (SC-002)', () => {
    assert.deepEqual([...new Set(ROWS.map((r) => r.control))].sort(), Object.keys(CONTROLS).sort());
  });

  for (const row of ROWS) {
    it(`the ${row.control} mutant fails check:${row.control} and only that control`, async () => {
      const dir = await mutant(distDir, row.mutation);
      try {
        const outcome = {};
        for (const [name, control] of Object.entries(CONTROLS)) {
          const { ok, violations } = await control(dir);
          outcome[name] = { ok, violations };
        }
        const own = outcome[row.control];
        assert.equal(own.ok, false, `check:${row.control} passed on its own mutant`);
        assert.ok(
          own.violations.some((v) => row.expected.test(v)),
          own.violations.join('\n'),
        );
        const others = Object.entries(outcome)
          .filter(([name, { ok }]) => name !== row.control && !ok)
          .map(([name, { violations }]) => `check:${name}: ${violations.join(' | ')}`);
        assert.deepEqual(others, [], `the ${row.control} mutant also breaks other controls`);
      } finally {
        await removeBuild(dir);
      }
    });
  }
});
