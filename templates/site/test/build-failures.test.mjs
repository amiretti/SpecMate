// Rules that fail the real build (US-14 FR-001 the file, FR-003/FR-004 site URL required, profiles only https,
// FR-008 logo inside the repo). The validator is unit tested in site.test.mjs; these builds prove the pages render
// through it. Outputs go to a temp dir.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildSite, fixtureData } from './lib/build.mjs';

async function failingBuild(name) {
  const target = await fixtureData(name);
  try {
    return buildSite(target);
  } finally {
    await rm(path.dirname(target.data), { recursive: true, force: true });
  }
}

describe('the build fails on an invalid relevamiento', { concurrency: false }, () => {
  it('without the public site URL, naming brief.site.url', async () => {
    const { status, output } = await failingBuild('no-url');
    assert.notEqual(status, 0, 'the build must fail');
    assert.match(output, /"brief\.site\.url"/);
  });

  it('with a non-https profile URL, naming it', async () => {
    const { status, output } = await failingBuild('http-profile');
    assert.notEqual(status, 0, 'the build must fail');
    assert.match(output, /"brief\.profiles\[0\]\.url"/);
  });

  it('with a logo path that leaves the repo, naming brief.logo.light (AC-8)', async () => {
    const { status, output } = await failingBuild('logo-outside');
    assert.notEqual(status, 0, 'the build must fail');
    assert.match(output, /"brief\.logo\.light"/);
  });

  it('without the relevamiento.json file, naming it (FR-001)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'site-fail-missing-'));
    try {
      const data = path.join(dir, 'relevamiento.json');
      const { status, output } = buildSite({ data, out: path.join(dir, 'dist') });
      assert.notEqual(status, 0, 'the build must fail');
      assert.ok(output.includes(data), `the error must name ${data}:\n${output.slice(-800)}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
