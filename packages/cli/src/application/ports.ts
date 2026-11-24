// Ports of the use cases (ADR-0034): everything external enters through these. Paths are opaque strings here;
// only infrastructure builds them with node:path.

/** The folder where a client repo is assembled and then published. */
export interface RepoWorkspace {
  exists(dir: string): Promise<boolean>;
  /** Creates an empty staging dir next to `target` (same parent, so publishing is a rename) and returns its path. */
  createStaging(target: string): Promise<string>;
  /** Copies exactly `files` (paths relative to `from`, separated by "/") from `from` into `to`; refuses any entry that
   * is not a regular file (a symlink, a submodule). */
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
   * Files under `dir` committed in HEAD that exist on disk, relative to `dir`, separated by "/", sorted. Ignored,
   * untracked and staged-but-uncommitted files are never listed. Fails if `dir` is not inside a git repo with a commit.
   */
  trackedFiles(dir: string): Promise<string[]>;
  /** `git init` in `dir` and one commit with every file, authored by the user's git identity. */
  initAndCommit(dir: string, message: string): Promise<void>;
}

export interface TemplateSource {
  /** Path of `templates/site`; fails if it cannot be found. */
  locate(): Promise<string>;
}

/** One entry met while walking a client folder; `path` is relative to the folder, separated by "/". */
export type FolderEntry =
  | { type: 'file'; path: string; depth: number; size: number }
  | { type: 'directory'; path: string; depth: number }
  /** A folder `skipDirectory` refused: neither walked nor listed. */
  | { type: 'skipped'; path: string; depth: number }
  /** A symlink or a Windows junction, wherever it points: never followed (US-15 FR-009). */
  | { type: 'link'; path: string; depth: number }
  /** A socket, a device or anything that is not a file, a folder or a link. */
  | { type: 'other'; path: string; depth: number }
  /** A folder below the root that could not be listed. */
  | { type: 'unreadable'; path: string; depth: number };

/** The client folder, read only (US-15 FR-008): nothing here writes, moves or deletes. */
export interface ClientFolder {
  /** Real path of `dir` with every link resolved; fails with a SpecmateError if it does not exist or is not a folder. */
  realPath(dir: string): Promise<string>;
  /** Whether `child` is `parent` or lies below it; both are real paths. */
  isInside(parent: string, child: string): boolean;
  /**
   * Walks `root` depth first, children sorted by name, without following any link. Stopping the iteration stops the
   * walk. Fails with a SpecmateError if `root` itself cannot be read.
   */
  walk(root: string, skipDirectory: (name: string) => boolean): AsyncIterable<FolderEntry>;
  /** Up to `bytes` leading bytes of a file. */
  readHead(root: string, file: string, bytes: number): Promise<Uint8Array>;
  /** SHA-256 in hex of a file, reading at most `maxBytes`. */
  sha256(root: string, file: string, maxBytes: number): Promise<string>;
  /**
   * A whole small file and its SHA-256 (US-16). Fails with a SpecmateError if it is larger than `maxBytes`, if any
   * part of its path is a link, or if it lies outside `root` (a real path).
   */
  readFile(root: string, file: string, maxBytes: number): Promise<{ bytes: Uint8Array; sha256: string }>;
}

/** `relevamiento.json` at the root of a client site (US-14), seen only through its steps (`steps.<name>`, ADR-0031). */
export interface RelevamientoStore {
  /** Path of the file in `siteDir`, for messages. */
  file(siteDir: string): string;
  /** `steps.<name>` as saved (unvalidated), or undefined; fails naming the file if it is missing or not JSON. */
  readStep(siteDir: string, name: StepName): Promise<unknown>;
  /** Replaces `steps.<name>` and keeps every other byte of meaning; the file is replaced atomically. */
  writeStep(siteDir: string, name: StepName, value: unknown): Promise<void>;
}

export type StepName = 'inventory' | 'tokens' | 'profile';

/** The token contract of a client site, taken from the site's own `src/lib/tokens.ts` (US-16 plan decision 1). */
export interface SiteContract {
  /** Every token the contract requires, by dotted path, in contract order. */
  paths: readonly string[];
  /** The site's own check of a whole tokens.json; throws naming the offending token. */
  check(tokens: unknown): void;
}

export interface SiteTokens {
  /** Loads the contract from `siteDir`; fails with a SpecmateError if the site does not have it. */
  contract(siteDir: string): Promise<SiteContract>;
  /** Path of the site's `src/data/tokens.json`, for messages. */
  file(siteDir: string): string;
  /** Replaces the site's `src/data/tokens.json` atomically. */
  write(siteDir: string, tokens: unknown): Promise<void>;
}
