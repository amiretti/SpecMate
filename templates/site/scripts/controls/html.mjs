// Control "HTML" (ADR-0030, FR-004): html-validate over every page of a build, with the rules of
// .htmlvalidate.json (html-validate:recommended, nothing turned off). Threshold: 0 errors.
// A build without HTML, or a validator that cannot run, FAILS: a control that cannot measure never passes
// (constitution VI).
// Usage: node scripts/controls/html.mjs [buildDir]
// run(dir) is async: resolves to { ok, violations } with one violation per error, `file:line:col [rule] message`.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate';

const configFile = fileURLToPath(new URL('../../.htmlvalidate.json', import.meta.url));

async function listHtml(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

/** @returns {Promise<{ ok: boolean, violations: string[] }>} */
export async function run(dir) {
  let files;
  let validator;
  try {
    files = await listHtml(dir);
    if (files.length === 0) throw new Error('no HTML pages');
    // The config is passed explicitly: a build copied to a temp dir must not depend on a config search.
    validator = new HtmlValidate(new FileSystemConfigLoader(JSON.parse(await readFile(configFile, 'utf8'))));
  } catch (error) {
    return { ok: false, violations: [`could not validate ${dir}: ${error.message}`] };
  }
  const violations = [];
  for (const file of files) {
    const report = await validator.validateFile(file);
    for (const result of report.results) {
      for (const m of result.messages.filter((msg) => msg.severity === 2)) {
        violations.push(`${path.relative(dir, file)}:${m.line}:${m.column} [${m.ruleId}] ${m.message}`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const { ok, violations } = await run(dir);
  for (const v of violations) console.error(`check:html FAIL ${v}`);
  console.log(ok ? 'check:html OK: 0 errors (html-validate:recommended)' : `check:html: ${violations.length} error(s)`);
  process.exitCode = ok ? 0 : 1;
}
