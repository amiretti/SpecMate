// Ports of the use cases (ADR-0034): everything external enters through these. Paths are opaque strings here;
// only infrastructure builds them with node:path.

/** The folder where a client repo is assembled and then published. */
export interface RepoWorkspace {
  exists(dir: string): Promise<boolean>;
  /** Creates an empty staging dir next to `target` (same parent, so publishing is a rename) and returns its path. */
  createStaging(target: string): Promise<string>;
  /** Copies the template tree into `to`, skipping the top-level entries named in `excluded`. */
  copyTemplate(from: string, to: string, excluded: readonly string[]): Promise<void>;
  /** Sets the root `name` of `package.json` and `package-lock.json` in `dir`. */
  renamePackage(dir: string, name: string): Promise<void>;
  /** Moves `staging` to `target`; fails with TargetExistsError if `target` appeared meanwhile. */
  publish(staging: string, target: string): Promise<void>;
  /** Removes `dir` and everything in it. */
  discard(dir: string): Promise<void>;
}

export interface Git {
  /** `git init` in `dir` and one commit with every file, authored by the user's git identity. */
  initAndCommit(dir: string, message: string): Promise<void>;
}

export interface TemplateSource {
  /** Path of `templates/site`; fails if it cannot be found. */
  locate(): Promise<string>;
}
