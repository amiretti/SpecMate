// Control "Secretos" (ADR-0030, FR-006): secretlint "sobre el repo y `dist/`" with the recommend preset
// (.secretlintrc.json). The repo of a site is the template (plan decision 5): its sources without node_modules,
// dist or .astro, plus the given build. Threshold: 0 findings. Secret values are masked in the output.
// A scan that cannot run, or that finds no file, FAILS: a control that cannot measure never passes (constitution VI).
// Usage: node scripts/controls/secrets.mjs [buildDir]
// run(dir, { repo }) is async: resolves to { ok, violations }; `repo` defaults to the template root.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSecretLint } from 'secretlint';

const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
const configFilePath = path.join(siteRoot, '.secretlintrc.json');
const NOT_SOURCES = new Set(['node_modules', 'dist', '.astro', '.git']);

async function listFiles(dir, skipDirs) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) files.push(...(await listFiles(full, skipDirs)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir, { repo = siteRoot } = {}) {
  let results;
  try {
    const build = await listFiles(dir, new Set());
    if (build.length === 0) throw new Error('the build has no files');
    // secretlint never scans its own config (built-in ignore); it only lists rule ids.
    const sources = (await listFiles(repo, NOT_SOURCES)).filter((f) => path.resolve(f) !== configFilePath);
    const { stdout, stderr } = await runSecretLint({
      cliOptions: { cwd: siteRoot, filePathOrGlobList: [...sources, ...build], noGlob: true, respectGitignore: false },
      engineOptions: { cwd: siteRoot, configFilePath, formatter: 'json', color: false, maskSecrets: true },
    });
    if (stderr) throw new Error(String(stderr).trim().split('\n')[0]);
    results = JSON.parse(stdout ?? '');
    if (!Array.isArray(results)) throw new Error('secretlint returned no report');
    // The JSON report lists every scanned file: a requested file missing from it was skipped, not cleared.
    const scanned = new Set(results.map((r) => path.resolve(r.filePath)));
    const skipped = [...sources, ...build].filter((f) => !scanned.has(path.resolve(f)));
    if (skipped.length > 0) throw new Error(`${skipped.length} file(s) not scanned, first: ${skipped[0]}`);
  } catch (error) {
    return { ok: false, violations: [`could not scan ${dir}: ${error.message}`] };
  }
  const violations = results.flatMap((r) =>
    r.messages.map((m) => `${r.filePath}:${m.loc?.start?.line ?? 0} [${m.ruleId}] ${m.message}`),
  );
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations } = await run(dir);
  for (const v of violations) console.error(`check:secrets FAIL ${v}`);
  console.log(ok ? 'check:secrets OK: 0 findings (repo and build)' : `check:secrets: ${violations.length} finding(s)`);
  process.exitCode = ok ? 0 : 1;
}
