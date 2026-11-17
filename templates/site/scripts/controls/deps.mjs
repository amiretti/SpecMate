// Control "Dependencias" (ADR-0030, scope by ADR-0038 decision 3): `npm audit --audit-level=high` over the whole
// tree of a site, devDependencies included. Threshold: 0 high or critical. If npm cannot answer (no network, no
// registry), the control FAILS: a control that cannot measure never passes (constitution VI).
// Usage: node scripts/controls/deps.mjs [siteDir]   (siteDir holds package.json and package-lock.json)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING = ['high', 'critical'];

// Runs npm through node itself: no shell, so no quoting or injection surface on Windows.
function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const found = candidates.find((c) => c?.endsWith('.js') && existsSync(c));
  if (!found) throw new Error('could not audit: npm-cli.js not found next to node');
  return found;
}

/** @returns {{ ok: boolean, violations: string[] }} */
export function run(siteDir, { registry } = {}) {
  const args = [npmCli(), 'audit', '--audit-level=high', '--package-lock-only', '--json'];
  if (registry) args.push(`--registry=${registry}`, '--fetch-retries=0');
  const res = spawnSync(process.execPath, args, { cwd: siteDir, encoding: 'utf8', timeout: 120_000 });
  let report;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    report = null;
  }
  const counts = report?.metadata?.vulnerabilities;
  if (res.error || !counts || report.error) {
    const why = res.error?.message ?? report?.error?.summary ?? (res.stderr || 'no JSON report').trim().split('\n')[0];
    return { ok: false, violations: [`could not audit ${siteDir}: ${why}`] };
  }
  const violations = Object.entries(report.vulnerabilities ?? {})
    .filter(([, v]) => BLOCKING.includes(v.severity))
    .map(([name, v]) => `${name}: ${v.severity} (${v.range})`);
  const blocking = BLOCKING.reduce((n, s) => n + (counts[s] ?? 0), 0);
  if (blocking > 0 && violations.length === 0) violations.push(`${blocking} high or critical advisories`);
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? '.');
  const { ok, violations } = run(dir);
  for (const v of violations) console.error(`check:deps FAIL ${v}`);
  console.log(
    ok
      ? 'check:deps OK: 0 high or critical (npm audit, dev included)'
      : `check:deps: ${violations.length} violation(s)`,
  );
  process.exitCode = ok ? 0 : 1;
}
