// Use cases of `specmate profile` (US-17, ADR-0041): show steps 2 to 4, take the proposal an agent made, and record what
// Harvi confirms, corrects or delegates. No model is called here: the proposal arrives as text and is validated whole
// before anything is saved, and the quote of each found value is checked against the client's file (principle V).
import {
  type Candidate,
  confirmField,
  type FieldName,
  mergeProposal,
  type Profile,
  type ProposedField,
  parseProfileStep,
  parseProposal,
  pickField,
  setField,
} from '../domain/business-profile.ts';
import { SpecmateError } from '../domain/errors.ts';
import { extension, filesOfKind } from '../domain/inventory.ts';
import { quoteIn } from '../domain/quote.ts';
import { type InventoryDeps, resolveClientAndSite, resolveSite } from './inventory-client-folder.ts';

export interface ProfileDeps extends Pick<InventoryDeps, 'folder' | 'relevamiento' | 'specmateRoot'> {
  now: () => Date;
}

export interface ProfileResult {
  profile: Profile;
  /** What Harvi should know: a quote that was not found, a field that did not change, a suggestion that is now another. */
  notices: string[];
  /** relevamiento.json that holds steps.profile. */
  file: string;
  /** Whether this run wrote steps.profile. */
  saved: boolean;
}

/** The text of a client file is read whole only up to this size, and only for these extensions (plan decision 4). */
const QUOTE_FILE_BYTES = 1_000_000;
const READABLE_AS_TEXT = new Set(['txt', 'md']);
/** The kinds of file a datum may come from (FR-003). */
const SOURCE_KINDS = ['text', 'brand-manual', 'prices'] as const;

export interface ShowRequest {
  siteDir: string;
  /** When given, the clients root and folder are checked as the other commands check them. */
  client?: { clientsRoot: string; clientDir: string };
}

export async function showProfile(request: ShowRequest, deps: ProfileDeps): Promise<ProfileResult> {
  const siteDir = request.client
    ? (await resolveClientAndSite({ ...request.client, siteDir: request.siteDir }, deps, 'profile')).siteDir
    : await resolveSite(request.siteDir, deps, 'profile');
  const profile = parseProfileStep(await deps.relevamiento.readStep(siteDir, 'profile'));
  return { profile, notices: [], file: deps.relevamiento.file(siteDir), saved: false };
}

const decoder = new TextDecoder('utf-8', { fatal: false });

/** The datum as it will be saved: found only when the quote is in a text file of the client, inferred otherwise. */
async function verified(
  name: FieldName,
  field: ProposedField,
  folder: InventoryDeps['folder'],
  clientDir: string,
): Promise<{ candidate: Candidate; notice?: string }> {
  const { value, source, quote } = field;
  if (field.kind === 'inferred' || quote === undefined) return { candidate: { value, state: 'inferred', source } };
  let reason: string;
  if (!READABLE_AS_TEXT.has(extension(source))) reason = `${source} cannot be read as text`;
  else {
    try {
      const { bytes } = await folder.readFile(clientDir, source, QUOTE_FILE_BYTES);
      if (quoteIn(decoder.decode(bytes), quote)) return { candidate: { value, state: 'found', source, quote } };
      reason = `the quote is not in ${source}`;
    } catch (error) {
      reason = error instanceof SpecmateError ? error.message : `${source} could not be read`;
    }
  }
  return { candidate: { value, state: 'inferred', source }, notice: `${name}: ${reason}; saved as inferred` };
}

export interface ProposeRequest {
  clientsRoot: string;
  clientDir: string;
  siteDir: string;
  /** What the agent printed, as it came. */
  proposalText: string;
}

export async function proposeProfile(request: ProposeRequest, deps: ProfileDeps): Promise<ProfileResult> {
  const { folder, relevamiento } = deps;
  const { clientDir, siteDir } = await resolveClientAndSite(request, deps, 'profile');
  const file = relevamiento.file(siteDir);
  const inventory = await relevamiento.readStep(siteDir, 'inventory');
  if (inventory === undefined) throw new SpecmateError(`no inventory in ${file}: run specmate inventory first`);
  const sources = new Set(SOURCE_KINDS.flatMap((kind) => filesOfKind(inventory, kind)));
  let given: unknown;
  try {
    given = JSON.parse(request.proposalText);
  } catch (error) {
    throw new SpecmateError(`the proposal is not valid JSON: ${(error as Error).message}`);
  }
  const proposal = parseProposal(given, sources);
  const saved = parseProfileStep(await relevamiento.readStep(siteDir, 'profile'));
  const candidates: Partial<Record<FieldName, Candidate>> = {};
  const notices: string[] = [];
  for (const [name, field] of Object.entries(proposal.fields) as [FieldName, ProposedField][]) {
    const checked = await verified(name, field, folder, clientDir);
    candidates[name] = checked.candidate;
    if (checked.notice) notices.push(checked.notice);
  }
  const merged = mergeProposal(saved, candidates, proposal.samples);
  await relevamiento.writeStep(siteDir, 'profile', merged.profile);
  return { profile: merged.profile, notices: [...notices, ...merged.notices], file, saved: true };
}

export interface ChangeRequest {
  siteDir: string;
  action: 'set' | 'confirm' | 'pick';
  field: FieldName;
  /** Only for `set`. */
  value?: string;
}

/** Harvi confirms, corrects or delegates one field; the date comes from `deps.now` so a test fixes it. */
export async function changeProfile(request: ChangeRequest, deps: ProfileDeps): Promise<ProfileResult> {
  const siteDir = await resolveSite(request.siteDir, deps, 'profile');
  const profile = parseProfileStep(await deps.relevamiento.readStep(siteDir, 'profile'));
  const by = `Harvi, specmate profile ${request.action}, ${deps.now().toISOString().slice(0, 10)}`;
  const change =
    request.action === 'set'
      ? setField(profile, request.field, request.value ?? '', by)
      : request.action === 'confirm'
        ? confirmField(profile, request.field, by)
        : pickField(profile, request.field, by);
  await deps.relevamiento.writeStep(siteDir, 'profile', change.profile);
  return { profile: change.profile, notices: change.notices, file: deps.relevamiento.file(siteDir), saved: true };
}
