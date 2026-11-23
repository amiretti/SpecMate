// Builds dist/ (address example relevamiento) plus the other example variants and the test fixtures, one at a time, before
// `npm test` (pretest). Non-dist outputs go to a temp dir outside the worktree, recreated on every run.
import { rm } from 'node:fs/promises';
import { buildSite, FIXTURES, VARIANTS, variantsDir, writeFixture } from '../test/lib/build.mjs';

await rm(variantsDir, { recursive: true, force: true });
// Each fixture is a module that exports a relevamiento: write it as the JSON its build reads.
for (const [name, target] of Object.entries(FIXTURES)) await writeFixture(name, target.data);

for (const [name, target] of Object.entries({ ...VARIANTS, ...FIXTURES })) {
  const started = Date.now();
  const { status, output } = buildSite(target);
  if (status !== 0) {
    process.stderr.write(output);
    throw new Error(`build of "${name}" failed with status ${status}`);
  }
  process.stdout.write(`built ${name} -> ${target.out} (${Date.now() - started} ms)\n`);
}
