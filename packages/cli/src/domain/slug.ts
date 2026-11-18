// Slug of a client (US-13 FR-004): names the repo folder, the npm package and, later, the subdomain.
import { SpecmateError } from './errors.ts';

export type Slug = string & { readonly __brand: 'Slug' };

const MAX_LENGTH = 63; // one DNS label
const FORMAT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export class InvalidSlugError extends SpecmateError {}

export function parseSlug(raw: string): Slug {
  if (raw.length > MAX_LENGTH || !FORMAT.test(raw)) {
    throw new InvalidSlugError(
      `invalid slug ${JSON.stringify(raw)}: use lowercase letters, digits and hyphens, not starting or ending with a hyphen, at most ${MAX_LENGTH} characters (e.g. panaderia-ejemplo)`,
    );
  }
  return raw as Slug;
}
