// Inventory of a client folder (US-15). The folder is data, never instructions (principle V): files are classified by
// name (domain/inventory.ts), images give only the size in their header, every other read is a hash, and a possible
// secret is never opened.
import { SpecmateError } from '../domain/errors.ts';
import { HEADER_BYTES, readImageSize } from '../domain/image-header.ts';
import {
  byPath,
  classify,
  extension,
  type Inventory,
  type InventoryEntry,
  imageNotices,
  isIgnoredDirectory,
  isIgnoredFile,
  isImagePath,
  LIMITS,
  mergeInventory,
  type Omitted,
  type Scan,
  tooBig,
  tooDeep,
  tooManyFiles,
} from '../domain/inventory.ts';
import type { ClientFolder, RelevamientoStore } from './ports.ts';

export type { Scan };

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

export class InsideSpecmateError extends SpecmateError {}

export interface InventoryRequest {
  /** Root of the client folders (--clients or SPECMATE_CLIENTS_DIR). */
  clientsRoot: string;
  /** `<clientsRoot>/<slug>`. */
  clientDir: string;
  /** The client site repo, holding relevamiento.json. */
  siteDir: string;
}

export interface InventoryDeps {
  folder: ClientFolder;
  relevamiento: RelevamientoStore;
  /** Root of the SpecMate repo: no client folder may live inside it (principle XII). */
  specmateRoot: () => Promise<string>;
}

export interface InventoryResult {
  inventory: Inventory;
  /** Real path of the folder that was walked. */
  clientDir: string;
  /** relevamiento.json that holds the result. */
  file: string;
}

type ResolveDeps = Pick<InventoryDeps, 'folder' | 'relevamiento' | 'specmateRoot'>;
type SiteCommand = 'inventory' | 'tokens' | 'profile';

async function guardInside(deps: ResolveDeps) {
  const specmate = await deps.folder.realPath(await deps.specmateRoot());
  return (label: string, given: string, real: string) => {
    if (deps.folder.isInside(specmate, real))
      throw new InsideSpecmateError(
        `${label} ${given} is inside the SpecMate repo (${specmate}): client material never enters it; keep it elsewhere`,
      );
  };
}

async function realSite(
  siteDir: string,
  deps: ResolveDeps,
  command: SiteCommand,
  refuseInside: Awaited<ReturnType<typeof guardInside>>,
) {
  // What the steps save names the client's files: it must not land in SpecMate either (US-15 spec §7, principle XII).
  const real = await deps.folder.realPath(siteDir).catch(() => {
    throw new SpecmateError(
      `${deps.relevamiento.file(siteDir)} not found: run specmate ${command} from the folder that holds the site created by specmate new`,
    );
  });
  refuseInside('the site', siteDir, real);
  return real;
}

/** Real paths of the client folder and the site, refusing any of them (or the clients root) inside SpecMate. */
export async function resolveClientAndSite(
  request: { clientsRoot: string; clientDir: string; siteDir: string },
  deps: ResolveDeps,
  command: SiteCommand,
): Promise<{ clientDir: string; siteDir: string }> {
  const refuseInside = await guardInside(deps);
  refuseInside('the clients root', request.clientsRoot, await deps.folder.realPath(request.clientsRoot));
  const clientDir = await deps.folder.realPath(request.clientDir);
  refuseInside('the client folder', request.clientDir, clientDir);
  return { clientDir, siteDir: await realSite(request.siteDir, deps, command, refuseInside) };
}

/** Real path of the site alone, for the commands that never open the client folder (US-17 set, confirm, pick). */
export async function resolveSite(siteDir: string, deps: ResolveDeps, command: SiteCommand): Promise<string> {
  return realSite(siteDir, deps, command, await guardInside(deps));
}

/** Inventories a client folder into steps.inventory of the site's relevamiento.json (US-15). */
export async function inventoryClientFolder(request: InventoryRequest, deps: InventoryDeps): Promise<InventoryResult> {
  const { folder, relevamiento } = deps;
  const { clientDir, siteDir } = await resolveClientAndSite(request, deps, 'inventory');
  const saved = await relevamiento.readStep(siteDir, 'inventory');
  const inventory = mergeInventory(saved, await scanClientFolder(folder, clientDir));
  await relevamiento.writeStep(siteDir, 'inventory', inventory);
  return { inventory, clientDir, file: relevamiento.file(siteDir) };
}
