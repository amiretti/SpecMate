// Rule (US-14 AC-6, SC-002): a business reachable only by WhatsApp, with no hours, no address and a Workers URL,
// builds a site that passes the 7 controls of ADR-0030, with no "Llamar" button. Lighthouse runs once here (as in
// controls-browser.test.mjs); `npm run check:lighthouse` takes the median of 3.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { run as a11y } from '../scripts/controls/a11y.mjs';
import { run as behavior } from '../scripts/controls/behavior.mjs';
import { run as html } from '../scripts/controls/html.mjs';
import { run as lighthouse } from '../scripts/controls/lighthouse.mjs';
import { run as links } from '../scripts/controls/links.mjs';
import { run as origins } from '../scripts/controls/origins.mjs';
import { run as secrets } from '../scripts/controls/secrets.mjs';
import { FIXTURES, readPages } from './lib/build.mjs';
import { visibleText } from './lib/html.mjs';

const { out, data } = FIXTURES.small;
const CONTROLS = {
  html: () => html(out),
  links: () => links(out),
  secrets: () => secrets(out),
  origins: () => origins(out, { data }),
  behavior: () => behavior(out),
  a11y: () => a11y(out),
  lighthouse: () => lighthouse(out, { runs: 1 }),
};

describe('a small WhatsApp-only site passes the 7 controls (AC-6)', { concurrency: false }, () => {
  it('has no "Llamar" button', async () => {
    const home = (await readPages(out)).find((p) => p.rel === 'index.html').html;
    assert.doesNotMatch(visibleText(home), /Llamar/);
    assert.doesNotMatch(home, /href="tel:/);
  });

  for (const [name, check] of Object.entries(CONTROLS)) {
    it(`check:${name} passes`, async () => {
      const result = await check();
      assert.deepEqual(result.violations, []);
      assert.equal(result.ok, true);
    });
  }
});
