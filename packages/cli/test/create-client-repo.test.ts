// Rule (US-13 FR-001, FR-005, FR-006, FR-007, FR-010; AC-5, AC-6; #53), at the use-case level with test doubles of
// the ports: an existing target is never touched; only the files git tracks in the template are copied, never a build
// or install artifact; everything is built in a staging dir and published at the end; any failure discards the
// staging dir and leaves no target behind.
import { describe, expect, it } from 'vitest';
import { createClientRepo, EXCLUDED_FROM_TEMPLATE, TargetExistsError } from '../src/application/create-client-repo.ts';
import type { Git, RepoWorkspace, TemplateSource } from '../src/application/ports.ts';
import { parseSlug } from '../src/domain/slug.ts';

type Step = 'list' | 'copy' | 'rename' | 'git' | 'publish';

const TRACKED = ['.gitignore', 'package.json', 'src/pages/index.astro', 'dist/index.html', 'node_modules/x/y.js'];

function doubles({
  exists = false,
  failAt,
  tracked = TRACKED,
}: {
  exists?: boolean;
  failAt?: Step;
  tracked?: string[];
} = {}) {
  const calls: string[] = [];
  const fail = (step: Step) => {
    if (failAt === step) throw new Error(`injected failure at ${step}`);
  };
  const workspace: RepoWorkspace = {
    exists: async (dir) => {
      calls.push(`exists ${dir}`);
      return exists;
    },
    createStaging: async (target) => {
      calls.push(`staging for ${target}`);
      return `${target}.staging`;
    },
    copyTemplate: async (from, to, files) => {
      calls.push(`copy ${from} -> ${to}: ${files.join(',')}`);
      fail('copy');
    },
    renamePackage: async (dir, name) => {
      calls.push(`rename package in ${dir} to ${name}`);
      fail('rename');
    },
    publish: async (staging, target) => {
      calls.push(`publish ${staging} -> ${target}`);
      fail('publish');
    },
    discard: async (dir) => {
      calls.push(`discard ${dir}`);
    },
  };
  const git: Git = {
    trackedFiles: async (dir) => {
      calls.push(`list tracked in ${dir}`);
      fail('list');
      return tracked;
    },
    initAndCommit: async (dir, message) => {
      calls.push(`git ${dir}: ${message}`);
      fail('git');
    },
  };
  const template: TemplateSource = { locate: async () => 'TEMPLATE' };
  return { calls, deps: { workspace, git, template } };
}

const slug = parseSlug('panaderia-ejemplo');
const targetDir = 'TARGET';

describe('createClientRepo', () => {
  it('builds the repo in a staging dir and publishes it last', async () => {
    const { calls, deps } = doubles();
    expect(await createClientRepo({ slug, targetDir }, deps)).toEqual({ dir: targetDir });
    expect(calls).toEqual([
      'exists TARGET',
      'list tracked in TEMPLATE',
      'staging for TARGET',
      'copy TEMPLATE -> TARGET.staging: .gitignore,package.json,src/pages/index.astro',
      'rename package in TARGET.staging to panaderia-ejemplo',
      'git TARGET.staging: chore: create panaderia-ejemplo from the SpecMate site template',
      'publish TARGET.staging -> TARGET',
    ]);
  });

  it('excludes exactly the build and install artifacts', () => {
    expect(EXCLUDED_FROM_TEMPLATE).toEqual(['node_modules', 'dist', '.astro', '.wrangler']);
  });

  it('fails before creating anything when the template has no tracked files', async () => {
    const { calls, deps } = doubles({ tracked: [] });
    await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow(/no files tracked by git/);
    expect(calls.some((c) => c.startsWith('staging'))).toBe(false);
  });

  it('fails before creating anything when the tracked files cannot be listed', async () => {
    const { calls, deps } = doubles({ failAt: 'list' });
    await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow('injected failure at list');
    expect(calls.some((c) => c.startsWith('staging'))).toBe(false);
  });

  it('fails on an existing target without creating or touching anything', async () => {
    const { calls, deps } = doubles({ exists: true });
    await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow(TargetExistsError);
    await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow(/TARGET already exists/);
    expect(calls.every((c) => c === 'exists TARGET')).toBe(true);
  });

  it.each(['copy', 'rename', 'git', 'publish'] as const)(
    'a failure at %s discards the staging dir and publishes nothing',
    async (step) => {
      const { calls, deps } = doubles({ failAt: step });
      await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow(`injected failure at ${step}`);
      expect(calls.at(-1)).toBe('discard TARGET.staging');
      expect(calls.filter((c) => c.startsWith('publish')).length).toBe(step === 'publish' ? 1 : 0);
    },
  );

  it('keeps the original error when discarding also fails', async () => {
    const { deps } = doubles({ failAt: 'git' });
    deps.workspace.discard = async () => {
      throw new Error('discard failed too');
    };
    await expect(createClientRepo({ slug, targetDir }, deps)).rejects.toThrow('injected failure at git');
  });
});
