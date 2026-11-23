// Rules (US-12 FR-001, FR-002, FR-003, FR-007 · AC-2, AC-3): the browser controls pass on a healthy build and each
// one fails, naming the violation, on a copy of the build with ONE mutation. The mutation table lives in
// test/lib/mutations-browser.mjs, so the isolation test (T-seam) imports it without re-registering these tests.
// Lighthouse here measures the minimum (risk R1): 1 run, home only; `check:lighthouse` takes the median of 3 per page.
import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { run as a11y } from '../scripts/controls/a11y.mjs';
import { run as behavior } from '../scripts/controls/behavior.mjs';
import { run as lighthouse } from '../scripts/controls/lighthouse.mjs';
import { run as origins } from '../scripts/controls/origins.mjs';
import { readExample, VARIANTS } from './lib/build.mjs';
import { mutant, removeBuild } from './lib/mutate.mjs';
import { appendCss, BROWSER_MUTATIONS, editHome, OUTSIDER } from './lib/mutations-browser.mjs';

const healthy = VARIANTS.address.out;
const addressData = VARIANTS.address.data;
const onlineData = VARIANTS.online.data;

const CONTROLS = { behavior, a11y, lighthouse, origins };

/** Runs `control` on a mutant of the healthy build and removes the copy afterwards. */
async function onMutant(mutation, check) {
  const dir = await mutant(healthy, mutation);
  try {
    return await check(dir);
  } finally {
    await removeBuild(dir);
  }
}

describe('browser controls: the healthy build passes', { concurrency: false }, () => {
  for (const [name, run] of Object.entries({ behavior, a11y, origins })) {
    it(`check:${name} passes on dist/`, async () => {
      const result = await run(healthy);
      assert.deepEqual(result.violations, []);
      assert.equal(result.ok, true);
    });
  }
});

describe('browser controls: one site that fails on purpose per row', { concurrency: false }, () => {
  for (const row of BROWSER_MUTATIONS) {
    it(`check:${row.control} fails on its mutant and names ${row.expected}`, async () => {
      const result = await onMutant(row.mutation, (dir) => CONTROLS[row.control](dir, { runs: 1 }));
      assert.equal(result.ok, false);
      assert.ok(
        result.violations.some((v) => row.expected.test(v)),
        result.violations.join('\n'),
      );
    });
  }

  it('check:behavior: an error only at 360 px is reported at 360 px and at no other width', async () => {
    const result = await onMutant(BROWSER_MUTATIONS[0].mutation, (dir) => behavior(dir));
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 0);
    assert.ok(
      result.violations.every((v) => / @ 360px: /.test(v)),
      result.violations.join('\n'),
    );
  });
});

describe('check:behavior: sections, anchors and contact links', { concurrency: false }, () => {
  it('fails on an anchor whose target id does not exist', async () => {
    const result = await onMutant(
      (dir) => editHome(dir, (html) => html.replace('href="/#horarios"', 'href="/#no-existe"')),
      (dir) => behavior(dir),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => /broken anchor: \/#no-existe/.test(v)),
      result.violations.join('\n'),
    );
  });

  it('fails on a malformed tel: link', async () => {
    const result = await onMutant(
      (dir) => editHome(dir, (html) => html.replace('href="tel:+541100000000"', 'href="tel:11-ABC"')),
      (dir) => behavior(dir),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => /malformed contact link: tel:11-ABC/.test(v)),
      result.violations.join('\n'),
    );
  });

  it('fails on a section that is not rendered at one width', async () => {
    const result = await onMutant(
      (dir) => appendCss(dir, '@media (max-width: 400px) { #nosotros { display: none; } }'),
      (dir) => behavior(dir),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => /@ 360px: section #nosotros is not rendered/.test(v)),
      result.violations.join('\n'),
    );
  });
});

describe('check:origins: allowlist from the brief (US-12 AC-3, US-14 FR-010, AC-10)', { concurrency: false }, () => {
  const outsiderCss = BROWSER_MUTATIONS.find((r) => r.control === 'origins').mutation;
  let listed;
  before(async () => {
    // An invented relevamiento: the address example plus the outsider origin, with its reason, in the brief.
    listed = path.join(tmpdir(), `specmate-origins-data-${process.pid}.json`);
    const data = readExample('address');
    data.brief.allowedOrigins = [{ origin: OUTSIDER, reason: 'invented test CDN' }];
    await writeFile(listed, JSON.stringify(data));
  });
  after(() => rm(listed, { force: true }));

  it('the same origin passes when the brief lists it', async () => {
    const result = await onMutant(outsiderCss, (dir) => origins(dir, { data: listed }));
    assert.deepEqual(result.violations, []);
    assert.equal(result.ok, true);
  });

  it('an external <a href> is not a request and does not count', async () => {
    const result = await onMutant(
      (dir) =>
        editHome(dir, (html) => html.replace('</main>', `<p><a href="${OUTSIDER}/page">Otro sitio</a></p></main>`)),
      (dir) => origins(dir, { data: addressData }),
    );
    assert.deepEqual(result.violations, []);
    assert.equal(result.ok, true);
  });

  it('a listed origin passes and one outside the list fails naming it (AC-10)', async () => {
    const result = await onMutant(
      (dir) =>
        appendCss(
          dir,
          `body{background-image:url("${OUTSIDER}/a.png")} html{background-image:url("https://otro.example/x.png")}`,
        ),
      (dir) => origins(dir, { data: listed }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.every((v) => !v.includes(OUTSIDER)) &&
        result.violations.some((v) => v.includes('https://otro.example')),
      result.violations.join('\n'),
    );
  });

  it('fails when the relevamiento belongs to another site than the build', async () => {
    const result = await origins(healthy, { data: onlineData });
    assert.equal(result.ok, false);
    assert.match(result.violations.join('\n'), /does not match the build/);
  });
});

describe('a control that cannot measure fails (constitution VI)', { concurrency: false }, () => {
  const noBrowser = { executablePath: path.join(tmpdir(), 'specmate-no-such-browser.exe'), runs: 1 };
  for (const [name, run] of Object.entries(CONTROLS)) {
    it(`check:${name} fails without a browser`, async () => {
      const result = await run(healthy, noBrowser);
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /could not measure/);
    });
  }
});
