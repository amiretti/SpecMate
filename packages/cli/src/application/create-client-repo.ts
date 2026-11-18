// Use case of `specmate new <slug>` (US-13 FR-001, FR-002, FR-005 to FR-007; plan decisions 1 and 2): the client repo
// is assembled in a staging dir next to the target and published with a rename at the end, so a failure at any
// step leaves nothing behind and an existing target is never touched.
import { SpecmateError } from '../domain/errors.ts';
import type { Slug } from '../domain/slug.ts';
import type { Git, RepoWorkspace, TemplateSource } from './ports.ts';

/**
 * Top-level entries of the template that are build or install artifacts, never part of a client repo. Only tracked
 * files are copied (#53), so these are already left out; the list stays as a second guard in case one gets committed.
 */
export const EXCLUDED_FROM_TEMPLATE = ['node_modules', 'dist', '.astro', '.wrangler'] as const;

export class EmptyTemplateError extends SpecmateError {
  constructor(source: string) {
    super(`${source} has no files tracked by git: the template cannot be copied (nothing was created)`);
  }
}

const isArtifact = (file: string) => (EXCLUDED_FROM_TEMPLATE as readonly string[]).includes(file.split('/')[0] ?? '');

export class TargetExistsError extends SpecmateError {
  readonly target: string;

  constructor(target: string) {
    super(`${target} already exists: choose another slug or remove it first (nothing was changed)`);
    this.target = target;
  }
}

export interface CreateClientRepoDeps {
  workspace: RepoWorkspace;
  git: Git;
  template: TemplateSource;
}

export async function createClientRepo(
  { slug, targetDir }: { slug: Slug; targetDir: string },
  { workspace, git, template }: CreateClientRepoDeps,
): Promise<{ dir: string }> {
  if (await workspace.exists(targetDir)) throw new TargetExistsError(targetDir);
  const source = await template.locate();
  // Only what git tracks: an ignored or untracked file (a local .env, a generated CLAUDE.md) never reaches a client.
  const files = (await git.trackedFiles(source)).filter((file) => !isArtifact(file));
  if (files.length === 0) throw new EmptyTemplateError(source);
  const staging = await workspace.createStaging(targetDir);
  try {
    await workspace.copyTemplate(source, staging, files);
    await workspace.renamePackage(staging, slug);
    await git.initAndCommit(staging, `chore: create ${slug} from the SpecMate site template`);
    await workspace.publish(staging, targetDir);
  } catch (error) {
    // The original failure is what the user needs; a failed cleanup must not replace it.
    await workspace.discard(staging).catch(() => undefined);
    throw error;
  }
  return { dir: targetDir };
}
