// Rules that fail the real build (FR-005 site URL required, FR-010 sameAs only https). The validators are unit
// tested in site.test.mjs; these builds prove the pages render through them. Outputs go to a temp dir.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildSite, fixtureData } from './lib/build.mjs';

async function failingBuild(name) {
  const out = await mkdtemp(path.join(tmpdir(), `site-fail-${name}-`));
  return buildSite({ data: fixtureData(name), out });
}

describe('the build fails on invalid site data', { concurrency: false }, () => {
  it('without the public site URL, naming site.url (AC-5)', async () => {
    const { status, output } = await failingBuild('no-url');
    assert.notEqual(status, 0, 'the build must fail');
    assert.match(output, /site\.url/);
  });

  it('with a non-https profile URL, naming it (AC-10)', async () => {
    const { status, output } = await failingBuild('http-profile');
    assert.notEqual(status, 0, 'the build must fail');
    assert.match(output, /profiles\[0\]\.url/);
  });
});
