// The site's single data source (FR-004): HTML, JSON-LD and metadata all render from the `Site` that parseSite
// returns. It throws naming the offending field, so bad data fails the build. Publishable data carries `source`
// and `confirmed` (constitution XI): required data must be confirmed; unconfirmed optional data is dropped.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Day = (typeof DAYS)[number];
export type AiCrawlerPolicy = 'allow' | 'block';

export interface Sourced {
  source: string;
  confirmed: boolean;
}

export interface SiteInput {
  $comment?: string;
  site: { url: string; aiCrawlers?: AiCrawlerPolicy };
  exampleNotice?: string;
  name: string;
  tagline: string;
  about: string;
  phone: { display: string; e164: string; whatsapp: boolean } & Sourced;
  email: { address: string } & Sourced;
  hours: Array<{ label: string; days: Day[]; opens?: string; closes?: string } & Sourced>;
  address?: { street: string; locality: string; region?: string; postalCode?: string; country: string } & Sourced;
  areaServed?: Array<{ name: string } & Sourced>;
  profiles?: Array<{ url: string } & Sourced>;
  faq?: Array<{ question: string; answer: string } & Sourced>;
  image: { alt: string };
  /** Third-party origins a page may request (ADR-0030), each with its reason; checked by `check:origins`. */
  allowedOrigins?: AllowedOrigin[];
}

export interface AllowedOrigin {
  origin: string;
  reason: string;
}

export interface Hours {
  label: string;
  days: Day[];
  opens?: string;
  closes?: string;
}

export interface Address {
  street: string;
  locality: string;
  region?: string;
  postalCode?: string;
  country: string;
}

export interface Site {
  url: string;
  aiCrawlers: AiCrawlerPolicy;
  exampleNotice?: string;
  name: string;
  tagline: string;
  about: string;
  phone: { display: string; e164: string; whatsapp: boolean };
  email: string;
  hours: Hours[];
  address?: Address;
  areaServed: string[];
  profiles: string[];
  faq: Array<{ question: string; answer: string }>;
  image: { alt: string };
  allowedOrigins: AllowedOrigin[];
}

type Rec = Record<string, unknown>;
/** Reads one key of an untyped record (TS index-signature access without a literal-key lint clash). */
const field = (record: Rec, key: string): unknown => record[key];
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, problem: string): never {
  throw new Error(`site data: "${path}" ${problem}`);
}

function record(value: unknown, path: string): Rec {
  if (!isRecord(value)) fail(path, 'must be an object');
  return value;
}

function text(parent: Rec, key: string, path: string): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'must be a non-empty string');
  // A lone surrogate would later fail URL encoding without naming the field.
  if (!value.isWellFormed()) fail(path, 'must be well-formed text (it holds a lone surrogate)');
  return value.trim();
}

function optionalText(parent: Rec, key: string, path: string): string | undefined {
  return parent[key] === undefined ? undefined : text(parent, key, path);
}

function list(parent: Rec, key: string, path: string): unknown[] {
  const value = parent[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

/** Checks `source` and `confirmed`; returns whether the item is confirmed. */
function sourced(item: Rec, path: string): boolean {
  text(item, 'source', `${path}.source`);
  const confirmed = field(item, 'confirmed');
  if (typeof confirmed !== 'boolean') fail(`${path}.confirmed`, 'must be true or false');
  return confirmed;
}

function required(item: Rec, path: string): void {
  if (!sourced(item, path)) fail(path, 'is required and must be confirmed by the client');
}

const digits = (value: string) => value.replace(/\D/g, '');
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Strict on purpose (security review): no ?, #, %, &, quotes, whitespace or control chars, which would add
// headers to a mailto: URL or break out of an attribute. Plain ASCII local part and a dotted host name.
const EMAIL =
  /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

function siteUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') fail('site.url', 'is required (absolute https URL)');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail('site.url', `must be an absolute https URL, got ${JSON.stringify(value)}`);
  }
  if (url.protocol !== 'https:') fail('site.url', `must use https, got ${JSON.stringify(value)}`);
  if (url.search || url.hash || url.username || url.password)
    fail('site.url', 'must not carry a query, fragment or credentials');
  // pageUrl resolves every page from the origin: a path here would be silently dropped.
  if (url.pathname !== '/') fail('site.url', `must be the site origin, without a path (got ${url.pathname})`);
  return url.href.replace(/\/+$/, '');
}

function httpsUrl(value: unknown, path: string): string {
  let url: URL | undefined;
  try {
    url = typeof value === 'string' ? new URL(value) : undefined;
  } catch {
    url = undefined;
  }
  if (url?.protocol !== 'https:') fail(path, `must be an https URL, got ${JSON.stringify(value)}`);
  if (url.username || url.password) fail(path, 'must not carry credentials');
  return url.href;
}

/** An allow-listed origin: `https://host[:port]` exactly (no path, query or credentials) plus its reason. */
function parseAllowedOrigin(raw: unknown, i: number): AllowedOrigin {
  const path = `allowedOrigins[${i}]`;
  const item = record(raw, path);
  const value = field(item, 'origin');
  const url = new URL(httpsUrl(value, `${path}.origin`));
  if (value !== url.origin) fail(`${path}.origin`, `must be an origin like https://host, got ${JSON.stringify(value)}`);
  return { origin: url.origin, reason: text(item, 'reason', `${path}.reason`) };
}

function parseHours(raw: unknown, i: number): Hours {
  const path = `hours[${i}]`;
  const item = record(raw, path);
  required(item, path);
  const label = text(item, 'label', `${path}.label`);
  const days = field(item, 'days');
  if (!Array.isArray(days) || days.length === 0 || !days.every((d) => (DAYS as readonly unknown[]).includes(d))) {
    fail(`${path}.days`, `must list days among ${DAYS.join(', ')}`);
  }
  const hours: Hours = { label, days: days as Day[] };
  const { opens, closes } = item;
  if (opens === undefined && closes === undefined) return hours;
  if (opens === undefined || closes === undefined) fail(path, 'needs both opens and closes, or neither (closed)');
  if (typeof opens !== 'string' || !TIME.test(opens)) fail(`${path}.opens`, 'must be HH:MM');
  if (typeof closes !== 'string' || !TIME.test(closes)) fail(`${path}.closes`, 'must be HH:MM');
  return { ...hours, opens, closes };
}

function parseAddress(raw: unknown): Address | undefined {
  if (raw === undefined) return undefined;
  const item = record(raw, 'address');
  const confirmed = sourced(item, 'address');
  const address: Address = {
    street: text(item, 'street', 'address.street'),
    locality: text(item, 'locality', 'address.locality'),
    country: text(item, 'country', 'address.country'),
  };
  const region = optionalText(item, 'region', 'address.region');
  const postalCode = optionalText(item, 'postalCode', 'address.postalCode');
  if (region !== undefined) address.region = region;
  if (postalCode !== undefined) address.postalCode = postalCode;
  return confirmed ? address : undefined;
}

export function parseSite(input: unknown): Site {
  if (!isRecord(input)) throw new Error('site data: must be an object');
  const settings = record(field(input, 'site'), 'site');
  const policy = field(settings, 'aiCrawlers') ?? 'allow';
  if (policy !== 'allow' && policy !== 'block') fail('site.aiCrawlers', 'must be "allow" or "block"');

  const phone = record(field(input, 'phone'), 'phone');
  required(phone, 'phone');
  const e164 = text(phone, 'e164', 'phone.e164');
  if (!/^\+\d{8,15}$/.test(e164)) fail('phone.e164', 'must be +<country><number>, 8 to 15 digits');
  const display = text(phone, 'display', 'phone.display');
  if (digits(display) !== digits(e164)) fail('phone.display', 'must have the same digits as phone.e164');
  const whatsapp = field(phone, 'whatsapp');
  if (typeof whatsapp !== 'boolean') fail('phone.whatsapp', 'must be true or false');

  const email = record(field(input, 'email'), 'email');
  required(email, 'email');
  const emailAddress = text(email, 'address', 'email.address');
  if (!EMAIL.test(emailAddress)) fail('email.address', 'must be an email address');

  const hours = list(input, 'hours', 'hours').map(parseHours);
  if (hours.length === 0) fail('hours', 'must list at least one entry');

  const areaServed = list(input, 'areaServed', 'areaServed').flatMap((raw, i) => {
    const item = record(raw, `areaServed[${i}]`);
    const name = text(item, 'name', `areaServed[${i}].name`);
    return sourced(item, `areaServed[${i}]`) ? [name] : [];
  });

  // Every profile URL must be https, confirmed or not (FR-010): a bad URL fails instead of hiding.
  const profiles = list(input, 'profiles', 'profiles').flatMap((raw, i) => {
    const item = record(raw, `profiles[${i}]`);
    const url = httpsUrl(field(item, 'url'), `profiles[${i}].url`);
    return sourced(item, `profiles[${i}]`) ? [url] : [];
  });

  const faq = list(input, 'faq', 'faq').flatMap((raw, i) => {
    const item = record(raw, `faq[${i}]`);
    const question = text(item, 'question', `faq[${i}].question`);
    const answer = text(item, 'answer', `faq[${i}].answer`);
    return sourced(item, `faq[${i}]`) ? [{ question, answer }] : [];
  });

  const site: Site = {
    url: siteUrl(field(settings, 'url')),
    aiCrawlers: policy,
    name: text(input, 'name', 'name'),
    tagline: text(input, 'tagline', 'tagline'),
    about: text(input, 'about', 'about'),
    phone: { display, e164, whatsapp },
    email: emailAddress,
    hours,
    areaServed,
    profiles,
    faq,
    image: { alt: text(record(field(input, 'image'), 'image'), 'alt', 'image.alt') },
    allowedOrigins: list(input, 'allowedOrigins', 'allowedOrigins').map(parseAllowedOrigin),
  };
  const address = parseAddress(field(input, 'address'));
  if (address) site.address = address;
  const notice = optionalText(input, 'exampleNotice', 'exampleNotice');
  if (notice !== undefined) site.exampleNotice = notice;
  return site;
}

/** "07:00" -> "7:00". */
const clock = (time: string) => time.replace(/^0(\d)/, '$1');

/** Visible hours text; the schema uses the same opens/closes pair (FR-004). */
export function hoursText(hours: Hours): string {
  return hours.opens && hours.closes ? `${clock(hours.opens)} a ${clock(hours.closes)}` : 'Cerrado';
}

/** One-line postal address, as shown and as searched. */
export function addressText(address: Address): string {
  return [address.street, address.locality, address.region, address.postalCode, address.country]
    .filter((part) => part !== undefined)
    .join(', ');
}

/** "Cómo llegar": a Google Maps search built only from the confirmed address (ADR-0035), never Places data. */
export function mapsUrl(address: Address): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', addressText(address));
  return url.href;
}

/** Absolute URL of a path of the site. */
export function pageUrl(site: Pick<Site, 'url'>, path: string): string {
  return new URL(path, `${site.url}/`).href;
}
