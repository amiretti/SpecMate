// Use case of `specmate tokens` (US-16): reads the client's tokens file that the inventory found, translates it to the
// site's token contract through a mapping saved in steps.tokens, checks the color contrast and, only when the mapping
// is confirmed for this exact file, complete and readable, writes the site's src/data/tokens.json.
import { type ColorName, type ContrastResult, checkContrast, type Mode, type Palette } from '../domain/contrast.ts';
import {
  buildContractTokens,
  type ConvertedValue,
  mergeMapping,
  proposeMapping,
  readTokensFile,
  TOKEN_LIMITS,
  type TokenMapping,
  type TokenProblem,
  type TokensFormat,
  type TokensSource,
  translate,
} from '../domain/design-tokens.ts';
import { SpecmateError } from '../domain/errors.ts';
import { filesOfKind } from '../domain/inventory.ts';
import { type InventoryDeps, resolveClientAndSite } from './inventory-client-folder.ts';
import type { SiteTokens } from './ports.ts';

export interface TokensRequest {
  clientsRoot: string;
  clientDir: string;
  siteDir: string;
  /** Path of the tokens file inside the client folder, as the inventory lists it; required when there are several. */
  file?: string;
  /** The operator confirms the mapping as it is now (FR-004). */
  confirm: boolean;
}

export interface TokensDeps extends Pick<InventoryDeps, 'folder' | 'relevamiento' | 'specmateRoot'> {
  siteTokens: SiteTokens;
}

/** What `steps.tokens` holds (plan "steps.tokens"). Everything but `mapping` and `confirmed` is recomputed each run. */
export interface TokensStep {
  source: TokensSource;
  format: TokensFormat;
  mapping: TokenMapping;
  confirmed: boolean;
  missing: string[];
  problems: TokenProblem[];
  contrast: ContrastResult[];
  written: boolean;
}

export interface TokensResult {
  step: TokensStep;
  /** Number of contract tokens. */
  total: number;
  notices: string[];
  clientDir: string;
  /** relevamiento.json that holds steps.tokens. */
  file: string;
  /** The site's tokens.json, written or not. */
  tokensFile: string;
  /** Something keeps the tokens from being written even with a confirmation. */
  blocked: boolean;
}

const COLOR_NAMES: readonly ColorName[] = ['bg', 'surface', 'text', 'text-muted', 'accent', 'on-accent', 'focus'];

/** Both palettes, if every color of the pairs has a value; otherwise contrast waits until they do. */
function palettes(values: ReadonlyMap<string, ConvertedValue>): Record<Mode, Palette> | undefined {
  const palette = (mode: Mode) => {
    const entries = COLOR_NAMES.map((name) => [name, values.get(`color.${mode}.${name}`)] as const);
    return entries.every(([, value]) => typeof value === 'string')
      ? (Object.fromEntries(entries) as Palette)
      : undefined;
  };
  const light = palette('light');
  const dark = palette('dark');
  return light && dark ? { light, dark } : undefined;
}

function chooseFile(available: readonly string[], requested: string | undefined, relevamiento: string): string {
  if (requested !== undefined) {
    if (!available.includes(requested))
      throw new SpecmateError(
        `${JSON.stringify(requested)} is not a tokens file of the inventory (${available.join(', ') || 'there is none'})`,
      );
    return requested;
  }
  const [only, ...others] = available;
  if (only === undefined)
    throw new SpecmateError(
      `no tokens file in the inventory of ${relevamiento}: if the client sent one, set its kind to "tokens" in steps.inventory and run again`,
    );
  if (others.length > 0)
    throw new SpecmateError(`more than one tokens file: ${available.join(', ')}; choose one with --file <path>`);
  return only;
}

export async function applyClientTokens(request: TokensRequest, deps: TokensDeps): Promise<TokensResult> {
  const { folder, relevamiento, siteTokens } = deps;
  const { clientDir, siteDir } = await resolveClientAndSite(request, deps, 'tokens');
  const file = relevamiento.file(siteDir);
  const inventory = await relevamiento.readStep(siteDir, 'inventory');
  if (inventory === undefined) throw new SpecmateError(`no inventory in ${file}: run specmate inventory first`);
  const path = chooseFile(filesOfKind(inventory, 'tokens'), request.file, file);

  const { bytes, sha256 } = await folder.readFile(clientDir, path, TOKEN_LIMITS.bytes);
  const contract = await siteTokens.contract(siteDir);
  const tokensFile = readTokensFile(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  const source = { path, sha256 };
  const merged = mergeMapping(await relevamiento.readStep(siteDir, 'tokens'), {
    contract: contract.paths,
    proposed: proposeMapping(contract.paths, tokensFile),
    source,
    confirm: request.confirm,
  });
  const { values, missing, problems } = translate(contract.paths, merged.mapping, tokensFile);
  const colors = palettes(values);
  const contrast = colors ? checkContrast(colors) : [];

  let complete = missing.length === 0 && problems.length === 0;
  const tokens = buildContractTokens(contract.paths, values, path);
  if (complete) {
    try {
      contract.check(tokens);
    } catch (error) {
      problems.push({ reason: `the site's contract refuses the result: ${(error as Error).message}` });
      complete = false;
    }
  }
  const blocked = !complete || contrast.some((result) => !result.ok);
  const written = merged.confirmed && !blocked;
  if (written) await siteTokens.write(siteDir, tokens);

  const step: TokensStep = {
    source,
    format: tokensFile.format,
    mapping: merged.mapping,
    confirmed: merged.confirmed,
    missing,
    problems,
    contrast,
    written,
  };
  await relevamiento.writeStep(siteDir, 'tokens', step);
  return {
    step,
    total: contract.paths.length,
    notices: merged.notices,
    clientDir,
    file,
    tokensFile: siteTokens.file(siteDir),
    blocked,
  };
}
