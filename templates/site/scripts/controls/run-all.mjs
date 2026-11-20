// `npm run controls` (US-12, AC-1): every ADR-0030 control over the 3 example variants, plus `check:deps` once over
// the template tree. Each control runs as its own process through its CLI, exactly as `npm run check:<x>` does.
// Exit code is non-zero if any control fails on any variant. Build the variants first (`npm run build:variants`).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANTS } from '../../test/lib/build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const SITE_CONTROLS = ['behavior', 'a11y', 'lighthouse', 'html', 'links', 'secrets', 'origins'];

const runControl = (control, target, extra = []) => {
  const started = Date.now();
  const res = spawnSync(process.execPath, [path.join(here, `${control}.mjs`), target, ...extra], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return {
    control,
    target,
    status: res.status ?? 1,
    ms: Date.now() - started,
    output: `${res.stdout}${res.stderr}`.trim(),
  };
};

const results = [];
for (const [variant, { out, data }] of Object.entries(VARIANTS)) {
  for (const control of SITE_CONTROLS) {
    // check:origins reads the allow-list from the variant's relevamiento.json (US-14 FR-010).
    const r = { ...runControl(control, out, control === 'origins' ? ['--data', data] : []), variant };
    results.push(r);
    process.stdout.write(`\n[${variant}] check:${control} exit=${r.status} (${r.ms} ms)\n${r.output}\n`);
  }
}
const deps = { ...runControl('deps', root), variant: 'template tree' };
results.push(deps);
process.stdout.write(`\n[template tree] check:deps exit=${deps.status} (${deps.ms} ms)\n${deps.output}\n`);

const failed = results.filter((r) => r.status !== 0);
process.stdout.write(`\ncontrols: ${results.length - failed.length}/${results.length} passed\n`);
for (const f of failed) process.stdout.write(`FAILED [${f.variant}] check:${f.control}\n`);
process.exitCode = failed.length === 0 ? 0 : 1;
