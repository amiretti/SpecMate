// Inventory of a client folder (US-15). The folder is data, never instructions (principle V): files are classified by
// name (domain/inventory.ts), images give only the size in their header, every other read is a hash, and a possible
// secret is never opened.
import { HEADER_BYTES, readImageSize } from '../domain/image-header.ts';
import {
  byPath,
  classify,
  extension,
  type InventoryEntry,
  imageNotices,
  isIgnoredDirectory,
  isIgnoredFile,
  isImagePath,
  LIMITS,
  type Omitted,
  tooBig,
  tooDeep,
  tooManyFiles,
} from '../domain/inventory.ts';
import type { ClientFolder } from './ports.ts';

export interface Scan {
  entries: InventoryEntry[];
  omitted: Omitted[];
  /** Hidden and system files, plus hidden folders, skipped and counted (FR-010). */
  ignored: number;
}

async function describeFile(folder: ClientFolder, root: string, path: string, size: number): Promise<InventoryEntry> {
  const kind = classify(path);
  if (kind === 'secret') return { path, kind, detectedKind: kind, notices: ['possible-secret-not-read'] };
  if (size > LIMITS.fileBytes) throw tooBig(path, size);
  const ext = extension(path);
  const entry: InventoryEntry = { path, kind, detectedKind: kind, size, ...(ext ? { type: ext } : {}), notices: [] };
  try {
    entry.sha256 = await folder.sha256(root, path, LIMITS.fileBytes);
  } catch {
    entry.notices.push('unreadable');
    return entry;
  }
  if (isImagePath(path)) {
    let image: ReturnType<typeof readImageSize>;
    try {
      image = readImageSize(await folder.readHead(root, path, HEADER_BYTES));
    } catch {
      image = undefined;
    }
    if (image) Object.assign(entry, { type: image.type, width: image.width, height: image.height });
    entry.notices.push(...imageNotices(kind, image));
  }
  return entry;
}

/** Walks the folder at `root` (already a real path) and describes every file; fails past any of LIMITS (FR-012). */
export async function scanClientFolder(folder: ClientFolder, root: string): Promise<Scan> {
  const entries: InventoryEntry[] = [];
  const omitted: Omitted[] = [];
  let ignored = 0;
  let files = 0;
  for await (const item of folder.walk(root, isIgnoredDirectory)) {
    switch (item.type) {
      case 'directory':
        if (item.depth > LIMITS.depth) throw tooDeep(item.path);
        break;
      case 'skipped':
        ignored += 1;
        break;
      case 'link':
        omitted.push({ path: item.path, reason: 'link' });
        break;
      case 'other':
        omitted.push({ path: item.path, reason: 'not-a-file' });
        break;
      case 'unreadable':
        omitted.push({ path: item.path, reason: 'unreadable' });
        break;
      case 'file':
        files += 1;
        if (files > LIMITS.files) throw tooManyFiles(files);
        if (isIgnoredFile(item.path)) ignored += 1;
        else entries.push(await describeFile(folder, root, item.path, item.size));
        break;
    }
  }
  return { entries: entries.sort(byPath), omitted: omitted.sort(byPath), ignored };
}
