// Inventory of a client folder (US-15; plan decision 2). Every rule here works on the file NAME and its extension:
// the content of a client file never takes part, so a file cannot instruct the inventory (principle V). The table is
// heuristic on purpose; Harvi corrects a wrong kind by hand (FR-004).
import { SpecmateError } from './errors.ts';
import { exceedsPixelCap, type ImageType } from './image-header.ts';

export type Kind = 'brand-manual' | 'logo' | 'photo' | 'text' | 'prices' | 'tokens' | 'secret' | 'unclassified';
export type Notice =
  | 'low-resolution-cover'
  | 'low-resolution'
  | 'unreadable'
  | 'too-many-pixels'
  | 'possible-secret-not-read';

/** The kinds "missing" talks about: a secret or an unclassified file is never something the site needs. */
export const EXPECTED_KINDS: readonly Kind[] = ['brand-manual', 'logo', 'photo', 'text', 'prices', 'tokens'];

/** Minimum width of a photo (FR-002, developer 2026-11-23): below COVER it cannot be the cover, below MIN at all. */
export const COVER_MIN_WIDTH = 1600;
export const PHOTO_MIN_WIDTH = 800;

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'heic', 'heif', 'tif', 'tiff', 'bmp']);
const TEXT = new Set(['txt', 'md', 'doc', 'docx', 'odt', 'rtf', 'pdf']);
const SHEET = new Set(['xls', 'xlsx', 'ods', 'csv']);
const VECTOR = new Set(['ai', 'eps', 'pdf']);

const SECRET_FILE = [
  /^\.env(\..*)?$/,
  /\.(pem|key|p12|pfx|kdbx|keystore|jks)$/,
  /^id_(rsa|dsa|ecdsa|ed25519)/,
  /^\.(npmrc|netrc|pypirc|git-credentials)$/,
];
const SECRET_WORDS = /\b(secrets?|credenciales?|credentials?|passwords?|contrasenas?|service account)\b/;
const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const IGNORED_DIRECTORIES = new Set(['__macosx']);

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Extension in lowercase, without the dot; a dotfile such as ".env" has none. */
export function extension(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Lowercase, no accents, and every run of spaces, dots, dashes and underscores as one space. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
    .trim();
}

export function isImagePath(path: string): boolean {
  return IMAGE.has(extension(path));
}

function isSecret(path: string): boolean {
  const name = baseName(path).toLowerCase();
  return SECRET_FILE.some((rule) => rule.test(name)) || SECRET_WORDS.test(normalizeName(name));
}

/** Hidden and system files are skipped and counted (FR-010); a dotfile that looks like a secret is listed instead. */
export function isIgnoredFile(path: string): boolean {
  if (isSecret(path)) return false;
  const name = baseName(path).toLowerCase();
  return SYSTEM_FILES.has(name) || name.startsWith('.') || name.startsWith('~$');
}

/** A hidden folder (".git", ".vscode") or a macOS archive leftover is not walked. */
export function isIgnoredDirectory(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRECTORIES.has(name.toLowerCase());
}

export function classify(path: string): Kind {
  if (isSecret(path)) return 'secret';
  const ext = extension(path);
  const name = baseName(path);
  const words = normalizeName(ext ? name.slice(0, -(ext.length + 1)) : name);
  if (ext === 'json' && /\btokens\b/.test(words)) return 'tokens';
  if (ext === 'pdf' && /manual|brand|identidad|guia de marca/.test(words)) return 'brand-manual';
  if ((IMAGE.has(ext) || VECTOR.has(ext)) && /logo|isotipo/.test(words)) return 'logo';
  if ((TEXT.has(ext) || SHEET.has(ext)) && /precio|tarifa/.test(words)) return 'prices';
  if (IMAGE.has(ext)) return 'photo';
  if (TEXT.has(ext)) return 'text';
  return 'unclassified';
}

/** Notices of an image from its size; `undefined` means its header could not be read (FR-011). */
export function imageNotices(kind: Kind, size: { width: number; height: number } | undefined): Notice[] {
  if (!size) return ['unreadable'];
  if (exceedsPixelCap(size.width, size.height)) return ['too-many-pixels'];
  if (kind !== 'photo') return [];
  if (size.width < PHOTO_MIN_WIDTH) return ['low-resolution'];
  if (size.width < COVER_MIN_WIDTH) return ['low-resolution-cover'];
  return [];
}

/** Limits of a walk (FR-012; plan decision 4). Going past any of them fails the inventory, naming it. */
export const LIMITS = { files: 5000, depth: 10, fileBytes: 50 * 1024 * 1024 } as const;

export class InventoryLimitError extends SpecmateError {}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const tooManyFiles = (count: number) =>
  new InventoryLimitError(`the client folder has more than ${LIMITS.files} files (stopped counting at ${count})`);
export const tooDeep = (path: string) =>
  new InventoryLimitError(`the client folder nests deeper than ${LIMITS.depth} levels, at ${path}`);
export const tooBig = (path: string, size: number) =>
  new InventoryLimitError(
    `${path} weighs ${megabytes(size)}, over the limit of ${LIMITS.fileBytes / (1024 * 1024)} MB per file`,
  );

/** One file of the inventory (data-model.md). Nothing from the content of a file is ever kept (FR-006). */
export interface InventoryEntry {
  path: string;
  kind: Kind;
  detectedKind: Kind;
  correctedBy?: 'manual';
  size?: number;
  type?: ImageType | string;
  width?: number;
  height?: number;
  sha256?: string;
  notices: Notice[];
  status?: 'gone';
}

export type OmittedReason = 'link' | 'not-a-file' | 'unreadable';

export interface Omitted {
  path: string;
  reason: OmittedReason;
}

export const byPath = <T extends { path: string }>(a: T, b: T) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
