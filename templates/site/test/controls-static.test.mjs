// Rules (FR-004, FR-005, FR-006, ADR-0030 "Barandas"): html-validate with "0 errores"; linkinator with "0 enlaces
// internos rotos (los externos avisan)"; secretlint "sobre el repo y `dist/`" with "0 hallazgos". Each control has a
// site that fails on purpose (FR-011, AC-2): a copy of a healthy build in os.tmpdir() with ONE mutation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VARIANTS } from './lib/build.mjs';
import { mutant, mutateFile, removeBuild } from './lib/mutate.mjs';
import { INVENTED_NOTE, INVENTED_TOKEN, STATIC_MUTATIONS } from './lib/mutations-static.mjs';

const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const controlPath = (control) => path.join(siteRoot, 'scripts', 'controls', `${control}.mjs`);
const runControl = async (control, dir, opts) =>
  (await import(pathToFileURL(controlPath(control)).href)).run(dir, opts);

describe('static controls: each mutation fails its control and names the violation (AC-2)', () => {
  for (const { control, mutation, expected } of STATIC_MUTATIONS) {
    it(`check:${control} fails on its mutant`, async () => {
      const dir = await mutant(VARIANTS.address.out, mutation);
      try {
        const result = await runControl(control, dir);
        assert.equal(result.ok, false);
        assert.match(result.violations.join('\n'), expected);
        const cli = spawnSync(process.execPath, [controlPath(control), dir], { encoding: 'utf8', timeout: 120_000 });
        assert.notEqual(cli.status, 0, cli.stdout + cli.stderr);
        assert.match(cli.stderr, new RegExp(`check:${control} FAIL`));
        assert.match(cli.stderr, expected);
      } finally {
        await removeBuild(dir);
      }
    });
  }
});

describe('static controls: edge cases', () => {
  it('check:links only warns on a broken external link and never requests it', async () => {
    const external = 'https://unreachable.invalid/broken';
    const dir = await mutant(VARIANTS.address.out, (d) =>
      mutateFile(d, 'index.html', (t) => t.replace('</main>', `<p><a href="${external}">External</a></p></main>`)),
    );
    try {
      const result = await runControl('links', dir);
      assert.deepEqual(result.violations, []);
      assert.equal(result.ok, true);
      assert.ok(
        result.warnings.some((w) => w.includes(external) && /not requested/.test(w)),
        result.warnings.join('\n'),
      );
    } finally {
      await removeBuild(dir);
    }
  });

  // #47 (security review V1, BAJO-1): a link written with the site's own canonical URL is internal, so it is checked
  // against the build like a relative one, never treated as external. The address variant's canonical origin is
  // https://horno-azul.example.
  it('check:links fails on a broken internal link written with the canonical URL', async () => {
    const dir = await mutant(VARIANTS.address.out, (d) =>
      mutateFile(d, 'index.html', (t) =>
        t.replace('</main>', '<p><a href="https://horno-azul.example/missing-absolute/">Missing</a></p></main>'),
      ),
    );
    try {
      const result = await runControl('links', dir);
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /\/missing-absolute\/ -> 404 \(from \/index\.html\)/);
      assert.ok(!result.warnings.some((w) => w.includes('horno-azul.example')), result.warnings.join('\n'));
    } finally {
      await removeBuild(dir);
    }
  });

  it('check:links passes a working internal link written with the canonical URL, and does not warn it', async () => {
    const dir = await mutant(VARIANTS.address.out, (d) =>
      mutateFile(d, 'index.html', (t) =>
        t.replace(
          '</main>',
          '<p><a href="https://horno-azul.example/404.html">Absolute</a>' +
            '<a href="https://horno-azul.example.invalid/x">Look-alike host</a></p></main>',
        ),
      ),
    );
    try {
      const result = await runControl('links', dir);
      assert.deepEqual(result.violations, []);
      assert.equal(result.ok, true);
      assert.ok(!result.warnings.some((w) => w.includes('horno-azul.example/')), result.warnings.join('\n'));
      // A longer host that starts with the canonical one is another site: external, warned, never requested.
      assert.ok(
        result.warnings.some((w) => w.includes('https://horno-azul.example.invalid/x') && /not requested/.test(w)),
        result.warnings.join('\n'),
      );
    } finally {
      await removeBuild(dir);
    }
  });

  // Security review V1 (BAJO-2): only the template's own root config is skipped, not any file with that name.
  it('check:secrets scans a nested .secretlintrc.json', async () => {
    const repo = await mkdtemp(path.join(tmpdir(), 'specmate-repo-'));
    try {
      await mkdir(path.join(repo, 'src'));
      await writeFile(
        path.join(repo, 'src', '.secretlintrc.json'),
        `{ "note": "${INVENTED_NOTE}", "t": "${INVENTED_TOKEN}" }\n`,
      );
      const result = await runControl('secrets', VARIANTS.address.out, { repo });
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /secretlintrc\.json.*github/i);
    } finally {
      await removeBuild(repo);
    }
  });

  it('check:secrets also scans the repo, not only dist/', async () => {
    const repo = await mkdtemp(path.join(tmpdir(), 'specmate-repo-'));
    try {
      await mkdir(path.join(repo, 'src'));
      await writeFile(
        path.join(repo, 'src', 'config.ts'),
        `// ${INVENTED_NOTE}\nexport const t = '${INVENTED_TOKEN}';\n`,
      );
      const result = await runControl('secrets', VARIANTS.address.out, { repo });
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /config\.ts.*github/i);
    } finally {
      await removeBuild(repo);
    }
  });

  for (const control of ['html', 'links', 'secrets']) {
    it(`check:${control} fails, does not pass, when the build is missing (VI)`, async () => {
      const result = await runControl(control, path.join(tmpdir(), 'specmate-no-such-build'));
      assert.equal(result.ok, false);
      assert.match(result.violations.join('\n'), /could not (validate|check|scan)/);
    });
  }
});

describe('static controls pass on the 3 example variants (AC-1)', () => {
  for (const [variant, { out }] of Object.entries(VARIANTS)) {
    for (const control of ['html', 'links', 'secrets']) {
      it(`check:${control} passes on ${variant}`, async () => {
        const result = await runControl(control, out);
        assert.deepEqual(result.violations, []);
        assert.equal(result.ok, true);
      });
    }
  }
});
