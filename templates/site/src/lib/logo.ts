// The logo files a site publishes (US-14 FR-008; security review of US-14): only the paths of a confirmed logo,
// already validated by parseRelevamiento (images directly under src/assets/brand/, inside the repo). They are read
// from disk here, not through astro:assets, so nothing else of src/assets/ and no unconfirmed logo reaches dist/.
// Every logo, SVG included, is converted with sharp to AVIF and WebP at twice the header height and the original is
// never published (developer, 2026-11-20). An SVG comes from the client's material and may carry scripts, handlers,
// stylesheets or links, so it is rasterized instead of filtered (security review of US-14, developer 2026-11-22);
// it is rendered at the target height, not upscaled from a small raster. Names carry a content hash.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Logo } from './site.ts';

/** Height of the logo in the header (`--space-4`, 2.5rem = 40 px) times 2 for high-density screens. */
export const LOGO_HEIGHT = 80;

export interface PublishedFile {
  /** Published file name, e.g. "logo-light.1a2b3c4d.avif". */
  name: string;
  /** Root-relative URL of the published file. */
  url: string;
  /** MIME type, for `<source type>`. */
  type: string;
  bytes: Uint8Array<ArrayBuffer>;
}

export interface LogoVariant {
  variant: 'light' | 'dark';
  /** Best format first; the last one is the `<img>` fallback. */
  files: PublishedFile[];
  width: number;
  height: number;
}

const cache = new Map<string, Promise<LogoVariant>>();

function published(variant: LogoVariant['variant'], bytes: Uint8Array, ext: string, type: string): PublishedFile {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const name = `logo-${variant}.${hash}.${ext}`;
  return { name, url: `/brand/${name}`, type, bytes: new Uint8Array(bytes) };
}

async function build(variant: LogoVariant['variant'], rel: string, root: string): Promise<LogoVariant> {
  const source = readFileSync(path.resolve(root, ...rel.split('/')));
  const vector = path.posix.extname(rel).toLowerCase() === '.svg';
  let image = sharp(source);
  if (vector) {
    const { height } = await image.metadata();
    if (!height) throw new Error(`relevamiento: "brief.logo.${variant}" has no readable size: ${rel}`);
    // sharp renders an SVG at 72 dpi by default; this density renders it LOGO_HEIGHT px high.
    image = sharp(source, { density: Math.min(100_000, Math.max(1, (72 * LOGO_HEIGHT) / height)) });
  }
  const resized = image.resize({ height: LOGO_HEIGHT, withoutEnlargement: !vector });
  const avif = await resized.clone().avif({ quality: 60 }).toBuffer();
  const { data: webp, info } = await resized.clone().webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return {
    variant,
    files: [published(variant, avif, 'avif', 'image/avif'), published(variant, webp, 'webp', 'image/webp')],
    width: info.width,
    height: info.height,
  };
}

function variantOf(variant: LogoVariant['variant'], rel: string, root: string): Promise<LogoVariant> {
  const key = `${variant}:${path.resolve(root, rel)}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = build(variant, rel, root);
    cache.set(key, entry);
  }
  return entry;
}

/** The variants of a confirmed logo: light, then dark if any; none without a logo. */
export async function logoVariants(logo: Logo | undefined, root: string): Promise<LogoVariant[]> {
  if (!logo) return [];
  const light = variantOf('light', logo.light, root);
  return Promise.all(logo.dark ? [light, variantOf('dark', logo.dark, root)] : [light]);
}
