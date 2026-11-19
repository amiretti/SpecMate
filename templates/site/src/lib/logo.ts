// The logo files a site publishes (US-14 FR-008; security review of US-14): only the paths of a confirmed logo,
// already validated by parseRelevamiento (images directly under src/assets/brand/, inside the repo). They are read
// from disk and served by src/pages/brand/[file].ts under a content-hashed name; nothing else of src/assets/ is
// imported, so no other image and no unconfirmed logo reaches dist/.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Logo } from './site.ts';

export interface LogoFile {
  variant: 'light' | 'dark';
  /** Published file name, e.g. "logo-light.1a2b3c4d.svg". */
  name: string;
  /** Root-relative URL of the published file. */
  url: string;
  bytes: Uint8Array<ArrayBuffer>;
}

function logoFile(variant: LogoFile['variant'], rel: string, root: string): LogoFile {
  const bytes = new Uint8Array(readFileSync(path.resolve(root, ...rel.split('/'))));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const name = `logo-${variant}.${hash}${path.posix.extname(rel).toLowerCase()}`;
  return { variant, name, url: `/brand/${name}`, bytes };
}

/** The files of a confirmed logo: light, then dark if any; none without a logo. */
export function logoFiles(logo: Logo | undefined, root: string): LogoFile[] {
  if (!logo) return [];
  return [logoFile('light', logo.light, root), ...(logo.dark ? [logoFile('dark', logo.dark, root)] : [])];
}
