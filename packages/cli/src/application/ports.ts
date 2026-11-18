// Ports of the use cases (ADR-0034): everything external enters through these. Paths are opaque strings here;
// only infrastructure builds them with node:path.

/** The folder where a client repo is assembled and then published. */
export interface RepoWorkspace {
  exists(dir: string): Promise<boolean>;
  /** Creates an empty staging dir next to `target` (same parent, so publishing is a rename) and returns its path. */
  createStaging(target: string): Promise<string>;
  /** Copies exactly `files` (paths relative to `from`, separated by "/") from `from` into `to`. */
  copyTemplate(from: string, to: string, files: readonly string[]): Promise<void>;
  /** Sets the root `name` of `package.json` and `package-lock.json` in `dir`. */
  renamePackage(dir: string, name: string): Promise<void>;
  /** Moves `staging` to `target`; fails with TargetExistsError if `target` appeared meanwhile. */
  publish(staging: string, target: string): Promise<void>;
  /** Removes `dir` and everything in it. */
  discard(dir: string): Promise<void>;
}

export interface Git {
  /**
   * Files under `dir` that git tracks and that exist on disk, relative to `dir`, separated by "/", sorted. Ignored and
   * untracked files are never listed. Fails if `dir` is not inside a git repo.
   */
  trackedFiles(dir: string): Promise<string[]>;
  /** `git init` in `dir` and one commit with every file, authored by the user's git identity. */
  initAndCommit(dir: string, message: string): Promise<void>;
}

export interface TemplateSource {
  /** Path of `templates/site`; fails if it cannot be found. */
  locate(): Promise<string>;
}
