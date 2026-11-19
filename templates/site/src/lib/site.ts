// The validator of relevamiento.json (US-14, plan decision 1): the only definition of the brief schema. HTML,
// JSON-LD and metadata all render from the `Site` it returns. It throws naming the offending field by its full path
// (`brief.contact.email.confirmedBy`), so bad data fails the build. Every publishable datum carries `source` and
// `confirmedBy` (constitution XI): a required one must be confirmed; an unconfirmed optional one is dropped. An
// unknown key fails at every level (FR-011), so a typo never makes a datum vanish. No dependencies.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const SCHEMA_VERSION = 1;
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Day = (typeof DAYS)[number];
export type AiCrawlerPolicy = 'allow' | 'block';

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

export interface PhoneNumber {
  display: string;
  e164: string;
}

export interface Contact {
  phone?: PhoneNumber;
  whatsapp?: PhoneNumber;
  email?: string;
}

export type Section = { id: string; title: string; body: string } | { id: string; title: string; items: string[] };

export interface Logo {
  /** Repo-relative path of the logo for light backgrounds. */
  light: string;
  /** Repo-relative path of the logo for dark backgrounds. */
  dark?: string;
  alt: string;
}

export interface Site {
  url: string;
  aiCrawlers: AiCrawlerPolicy;
  exampleNotice?: string;
  name: string;
  tagline: string;
  about: string;
  /** At least one confirmed channel. */
  contact: Contact;
  hours: Hours[];
  address?: Address;
  areaServed: string[];
  geo?: { latitude: number; longitude: number };
  mapsUrl?: string;
  profiles: string[];
  faq: Array<{ question: string; answer: string }>;
  sections: Section[];
  logo?: Logo;
  image: { alt: string };
  /** Third-party origins a page may request (ADR-0030), each with its reason; checked by `check:origins`. */
  allowedOrigins: AllowedOrigin[];
}

export interface ParseOptions {
  /** Root of the site repo: logo paths resolve against it and must stay inside it. */
  root: string;
}

type Rec = Record<string, unknown>;
/** Reads one key of an untyped record (TS index-signature access without a literal-key lint clash). */
const field = (record: Rec, key: string): unknown => record[key];
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const SOURCED = ['source', 'confirmedBy'] as const;
// Anchors and heading ids the page already uses: a free section must not take them.
const RESERVED_IDS = new Set(['contenido', 'titulo', 'nosotros', 'horarios', 'ubicacion', 'contacto', 'preguntas']);
const SECTION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOGO_DIR = 'src/assets/';
const LOGO_FILE = /\.(svg|png|jpe?g|webp|avif)$/i;

function fail(at: string, problem: string): never {
  throw new Error(`relevamiento: "${at}" ${problem}`);
}

const join = (parent: string, key: string) => (parent ? `${parent}.${key}` : key);

function record(value: unknown, at: string): Rec {
  if (!isRecord(value)) fail(at, 'must be an object');
  return value;
}

/** A record whose keys are all in `allowed` (plus `$comment`); an unknown key fails naming it (FR-011). */
function strict(value: unknown, at: string, allowed: readonly string[]): Rec {
  const item = record(value, at);
  for (const key of Object.keys(item)) {
    if (key !== '$comment' && !allowed.includes(key)) fail(join(at, key), 'is not a known field (typo?)');
  }
  return item;
}

function text(parent: Rec, key: string, at: string): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim() === '') fail(at, 'must be a non-empty string');
  // A lone surrogate would later fail URL encoding without naming the field.
  if (!value.isWellFormed()) fail(at, 'must be well-formed text (it holds a lone surrogate)');
  return value.trim();
}

function optionalText(parent: Rec, key: string, at: string): string | undefined {
  return parent[key] === undefined ? undefined : text(parent, key, at);
}

function list(parent: Rec, key: string, at: string): unknown[] {
  const value = parent[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(at, 'must be an array');
  return value;
}

/** Checks `source` (always required) and `confirmedBy`; returns whether the datum is confirmed (FR-002). */
function confirmed(item: Rec, at: string): boolean {
  text(item, 'source', `${at}.source`);
  const by = field(item, 'confirmedBy');
  if (by === undefined) return false;
  if (typeof by !== 'string') fail(`${at}.confirmedBy`, 'must be text: who confirmed it, how and when');
  if (!by.isWellFormed()) fail(`${at}.confirmedBy`, 'must be well-formed text (it holds a lone surrogate)');
  return by.trim() !== '';
}

function required(item: Rec, at: string): void {
  if (!confirmed(item, at)) {
    fail(`${at}.confirmedBy`, 'is required: the client must confirm this datum (who confirmed it, how and when)');
  }
}

const digits = (value: string) => value.replace(/\D/g, '');
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Strict on purpose (security review): no ?, #, %, &, quotes, whitespace or control chars, which would add
// headers to a mailto: URL or break out of an attribute. Plain ASCII local part and a dotted host name.
const EMAIL =
  /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

function siteUrl(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(at, 'is required (absolute https URL)');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(at, `must be an absolute https URL, got ${JSON.stringify(value)}`);
  }
  if (url.protocol !== 'https:') fail(at, `must use https, got ${JSON.stringify(value)}`);
  if (url.search || url.hash || url.username || url.password)
    fail(at, 'must not carry a query, fragment or credentials');
  // pageUrl resolves every page from the origin: a path here would be silently dropped.
  if (url.pathname !== '/') fail(at, `must be the site origin, without a path (got ${url.pathname})`);
  return url.href.replace(/\/+$/, '');
}

function httpsUrl(value: unknown, at: string): string {
  let url: URL | undefined;
  try {
    url = typeof value === 'string' ? new URL(value) : undefined;
  } catch {
    url = undefined;
  }
  if (url?.protocol !== 'https:') fail(at, `must be an https URL, got ${JSON.stringify(value)}`);
  if (url.username || url.password) fail(at, 'must not carry credentials');
  return url.href;
}

/** An allow-listed origin: `https://host[:port]` exactly (no path, query or credentials) plus its reason. */
function parseAllowedOrigin(raw: unknown, i: number): AllowedOrigin {
  const at = `brief.allowedOrigins[${i}]`;
  const item = strict(raw, at, ['origin', 'reason']);
  const value = field(item, 'origin');
  const url = new URL(httpsUrl(value, `${at}.origin`));
  if (value !== url.origin) fail(`${at}.origin`, `must be an origin like https://host, got ${JSON.stringify(value)}`);
  return { origin: url.origin, reason: text(item, 'reason', `${at}.reason`) };
}

/** A required text datum: `{ text, source, confirmedBy }`. */
function requiredText(brief: Rec, key: string): string {
  const at = `brief.${key}`;
  const item = strict(field(brief, key), at, ['text', ...SOURCED]);
  required(item, at);
  return text(item, 'text', `${at}.text`);
}

/** A phone or WhatsApp number; its format is checked even when unconfirmed. */
function parseNumber(raw: unknown, at: string): PhoneNumber | undefined {
  const item = strict(raw, at, ['display', 'e164', ...SOURCED]);
  const ok = confirmed(item, at);
  const e164 = text(item, 'e164', `${at}.e164`);
  if (!/^\+\d{8,15}$/.test(e164)) fail(`${at}.e164`, 'must be +<country><number>, 8 to 15 digits');
  const display = text(item, 'display', `${at}.display`);
  if (digits(display) !== digits(e164)) fail(`${at}.display`, `must have the same digits as ${at}.e164`);
  return ok ? { display, e164 } : undefined;
}

/** Phone, WhatsApp and email are separate channels (FR-005); at least one must be confirmed (FR-004). */
function parseContact(raw: unknown): Contact {
  const at = 'brief.contact';
  const item = strict(raw ?? {}, at, ['phone', 'whatsapp', 'email']);
  const contact: Contact = {};
  const unconfirmed: string[] = [];
  for (const channel of ['phone', 'whatsapp'] as const) {
    const value = field(item, channel);
    if (value === undefined) continue;
    const number = parseNumber(value, `${at}.${channel}`);
    if (number) contact[channel] = number;
    else unconfirmed.push(`"${at}.${channel}.confirmedBy"`);
  }
  const rawEmail = field(item, 'email');
  if (rawEmail !== undefined) {
    const email = strict(rawEmail, `${at}.email`, ['address', ...SOURCED]);
    const ok = confirmed(email, `${at}.email`);
    const address = text(email, 'address', `${at}.email.address`);
    if (!EMAIL.test(address)) fail(`${at}.email.address`, 'must be an email address');
    if (ok) contact.email = address;
    else unconfirmed.push(`"${at}.email.confirmedBy"`);
  }
  if (Object.keys(contact).length === 0) {
    const missing = unconfirmed.length > 0 ? `; unconfirmed: ${unconfirmed.join(', ')}` : '';
    fail(at, `needs at least one confirmed contact channel (phone, whatsapp or email)${missing}`);
  }
  return contact;
}

function parseHours(raw: unknown, i: number): Hours | undefined {
  const at = `brief.hours[${i}]`;
  const item = strict(raw, at, ['label', 'days', 'opens', 'closes', ...SOURCED]);
  const ok = confirmed(item, at);
  const label = text(item, 'label', `${at}.label`);
  const days = field(item, 'days');
  if (!Array.isArray(days) || days.length === 0 || !days.every((d) => (DAYS as readonly unknown[]).includes(d))) {
    fail(`${at}.days`, `must list days among ${DAYS.join(', ')}`);
  }
  let hours: Hours = { label, days: days as Day[] };
  const { opens, closes } = item;
  if (opens !== undefined || closes !== undefined) {
    if (opens === undefined || closes === undefined) fail(at, 'needs both opens and closes, or neither (closed)');
    if (typeof opens !== 'string' || !TIME.test(opens)) fail(`${at}.opens`, 'must be HH:MM');
    if (typeof closes !== 'string' || !TIME.test(closes)) fail(`${at}.closes`, 'must be HH:MM');
    hours = { ...hours, opens, closes };
  }
  return ok ? hours : undefined;
}

function parseAddress(raw: unknown): Address | undefined {
  if (raw === undefined) return undefined;
  const at = 'brief.address';
  const item = strict(raw, at, ['street', 'locality', 'region', 'postalCode', 'country', ...SOURCED]);
  const ok = confirmed(item, at);
  const address: Address = {
    street: text(item, 'street', `${at}.street`),
    locality: text(item, 'locality', `${at}.locality`),
    country: text(item, 'country', `${at}.country`),
  };
  const region = optionalText(item, 'region', `${at}.region`);
  const postalCode = optionalText(item, 'postalCode', `${at}.postalCode`);
  if (region !== undefined) address.region = region;
  if (postalCode !== undefined) address.postalCode = postalCode;
  return ok ? address : undefined;
}

function coordinate(item: Rec, key: string, at: string, limit: number): number {
  const value = field(item, key);
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    fail(at, `must be a number between -${limit} and ${limit}`);
  }
  return value;
}

function parseGeo(raw: unknown): Site['geo'] {
  if (raw === undefined) return undefined;
  const at = 'brief.geo';
  const item = strict(raw, at, ['latitude', 'longitude', ...SOURCED]);
  const ok = confirmed(item, at);
  const latitude = coordinate(item, 'latitude', `${at}.latitude`, 90);
  const longitude = coordinate(item, 'longitude', `${at}.longitude`, 180);
  return ok ? { latitude, longitude } : undefined;
}

function parseMapsUrl(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  const at = 'brief.mapsUrl';
  const item = strict(raw, at, ['url', ...SOURCED]);
  const ok = confirmed(item, at);
  const url = httpsUrl(field(item, 'url'), `${at}.url`);
  return ok ? url : undefined;
}

function parseSections(brief: Rec): Section[] {
  const seen = new Set<string>();
  return list(brief, 'sections', 'brief.sections').flatMap((raw, i) => {
    const at = `brief.sections[${i}]`;
    const item = strict(raw, at, ['id', 'title', 'body', 'items', ...SOURCED]);
    const ok = confirmed(item, at);
    const id = text(item, 'id', `${at}.id`);
    if (!SECTION_ID.test(id)) fail(`${at}.id`, 'must be lowercase letters, digits and hyphens (it is the anchor)');
    if (RESERVED_IDS.has(id) || seen.has(id)) fail(`${at}.id`, `"${id}" is already used on the page`);
    seen.add(id);
    const title = text(item, 'title', `${at}.title`);
    const hasBody = field(item, 'body') !== undefined;
    const hasItems = field(item, 'items') !== undefined;
    if (hasBody === hasItems) fail(at, 'needs either body (a text) or items (a list), not both');
    let section: Section;
    if (hasBody) section = { id, title, body: text(item, 'body', `${at}.body`) };
    else {
      const entries = list(item, 'items', `${at}.items`);
      if (entries.length === 0) fail(`${at}.items`, 'must list at least one item');
      const items = entries.map((_, j) => text(entries as unknown as Rec, String(j), `${at}.items[${j}]`));
      section = { id, title, items };
    }
    return ok ? [section] : [];
  });
}

/** A repo-relative logo file under src/assets/ (served through astro:assets); never outside the repo (FR-008). */
function logoPath(item: Rec, key: string, at: string, root: string): string {
  const value = text(item, key, at);
  if (path.isAbsolute(value) || /^[\\/]/.test(value) || /^[A-Za-z]:/.test(value) || value.includes('\\')) {
    fail(at, 'must be a path relative to the repo, with forward slashes');
  }
  if (value.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    fail(at, 'must not leave the repo (no "..", "." or empty segments)');
  }
  if (!value.startsWith(LOGO_DIR) || !LOGO_FILE.test(value)) {
    fail(at, `must be an image (svg, png, jpg, webp or avif) under ${LOGO_DIR}`);
  }
  const file = path.resolve(root, ...value.split('/'));
  let real: string;
  try {
    if (!statSync(file).isFile()) fail(at, `is not a file: ${value}`);
    real = realpathSync(file);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('relevamiento:')) throw error;
    fail(at, `does not exist in the repo: ${value}`);
  }
  const base = realpathSync(root);
  // A symlink inside the repo must not point outside it.
  if (path.relative(base, real).startsWith('..') || path.isAbsolute(path.relative(base, real))) {
    fail(at, 'must not leave the repo (it resolves outside it)');
  }
  return value;
}

function parseLogo(raw: unknown, root: string): Logo | undefined {
  if (raw === undefined) return undefined;
  const at = 'brief.logo';
  const item = strict(raw, at, ['light', 'dark', 'alt', ...SOURCED]);
  const ok = confirmed(item, at);
  const logo: Logo = { light: logoPath(item, 'light', `${at}.light`, root), alt: text(item, 'alt', `${at}.alt`) };
  if (field(item, 'dark') !== undefined) logo.dark = logoPath(item, 'dark', `${at}.dark`, root);
  return ok ? { light: logo.light, ...(logo.dark ? { dark: logo.dark } : {}), alt: logo.alt } : undefined;
}

const BRIEF_KEYS = [
  'exampleNotice',
  'site',
  'name',
  'tagline',
  'about',
  'contact',
  'hours',
  'address',
  'areaServed',
  'geo',
  'mapsUrl',
  'profiles',
  'faq',
  'sections',
  'logo',
  'image',
  'allowedOrigins',
] as const;

/** Validates a parsed relevamiento.json and returns the Site every page renders from. */
export function parseRelevamiento(input: unknown, { root }: ParseOptions): Site {
  if (!isRecord(input)) throw new Error('relevamiento: the file must hold a JSON object');
  const file = strict(input, '', ['$schemaVersion', 'brief', 'steps']);
  if (field(file, '$schemaVersion') !== SCHEMA_VERSION) fail('$schemaVersion', `must be ${SCHEMA_VERSION}`);
  // The state of the relevamiento steps (ADR-0031) is defined by US-15..US-19; the build ignores it.
  if (field(file, 'steps') !== undefined) record(field(file, 'steps'), 'steps');
  const brief = strict(field(file, 'brief'), 'brief', BRIEF_KEYS);

  const settings = strict(field(brief, 'site'), 'brief.site', ['url', 'aiCrawlers', ...SOURCED]);
  required(settings, 'brief.site');
  const policy = field(settings, 'aiCrawlers') ?? 'allow';
  if (policy !== 'allow' && policy !== 'block') fail('brief.site.aiCrawlers', 'must be "allow" or "block"');

  const name = requiredText(brief, 'name');
  const tagline = requiredText(brief, 'tagline');
  const about = requiredText(brief, 'about');
  const contact = parseContact(field(brief, 'contact'));

  const hours = list(brief, 'hours', 'brief.hours').flatMap((raw, i) => parseHours(raw, i) ?? []);

  const areaServed = list(brief, 'areaServed', 'brief.areaServed').flatMap((raw, i) => {
    const at = `brief.areaServed[${i}]`;
    const item = strict(raw, at, ['name', ...SOURCED]);
    const zone = text(item, 'name', `${at}.name`);
    return confirmed(item, at) ? [zone] : [];
  });

  // Every profile URL must be https, confirmed or not: a bad URL fails instead of hiding.
  const profiles = list(brief, 'profiles', 'brief.profiles').flatMap((raw, i) => {
    const at = `brief.profiles[${i}]`;
    const item = strict(raw, at, ['url', ...SOURCED]);
    const url = httpsUrl(field(item, 'url'), `${at}.url`);
    return confirmed(item, at) ? [url] : [];
  });

  const faq = list(brief, 'faq', 'brief.faq').flatMap((raw, i) => {
    const at = `brief.faq[${i}]`;
    const item = strict(raw, at, ['question', 'answer', ...SOURCED]);
    const question = text(item, 'question', `${at}.question`);
    const answer = text(item, 'answer', `${at}.answer`);
    return confirmed(item, at) ? [{ question, answer }] : [];
  });

  const image = strict(field(brief, 'image'), 'brief.image', ['alt']);

  const site: Site = {
    url: siteUrl(field(settings, 'url'), 'brief.site.url'),
    aiCrawlers: policy,
    name,
    tagline,
    about,
    contact,
    hours,
    areaServed,
    profiles,
    faq,
    sections: parseSections(brief),
    image: { alt: text(image, 'alt', 'brief.image.alt') },
    allowedOrigins: list(brief, 'allowedOrigins', 'brief.allowedOrigins').map(parseAllowedOrigin),
  };
  const address = parseAddress(field(brief, 'address'));
  if (address) site.address = address;
  const geo = parseGeo(field(brief, 'geo'));
  if (geo) site.geo = geo;
  const maps = parseMapsUrl(field(brief, 'mapsUrl'));
  if (maps) site.mapsUrl = maps;
  const logo = parseLogo(field(brief, 'logo'), root);
  if (logo) site.logo = logo;
  const notice = optionalText(brief, 'exampleNotice', 'brief.exampleNotice');
  if (notice !== undefined) site.exampleNotice = notice;
  return site;
}

/** Reads and validates a relevamiento.json file; a missing or malformed file fails naming it (FR-001). */
export function loadRelevamiento(file: string, root: string): Site {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`relevamiento: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `relevamiento: ${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseRelevamiento(json, { root });
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

/** A Google Maps search built only from the confirmed address (ADR-0035), never Places data. */
export function mapsUrl(address: Address): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', addressText(address));
  return url.href;
}

/** "Cómo llegar" (FR-009): the confirmed Maps link if there is one, else the address search; only with an address. */
export function directionsUrl(site: Pick<Site, 'address' | 'mapsUrl'>): string | undefined {
  if (!site.address) return undefined;
  return site.mapsUrl ?? mapsUrl(site.address);
}

/** The hours and location section: "Horarios" with hours, "Ubicación" with only a location, none without both. */
export function locationSection(
  site: Pick<Site, 'hours' | 'address' | 'areaServed'>,
): { id: 'horarios' | 'ubicacion'; title: string } | undefined {
  if (site.hours.length > 0) return { id: 'horarios', title: 'Horarios' };
  if (site.address || site.areaServed.length > 0) return { id: 'ubicacion', title: 'Ubicación' };
  return undefined;
}

/** Absolute URL of a path of the site. */
export function pageUrl(site: Pick<Site, 'url'>, path: string): string {
  return new URL(path, `${site.url}/`).href;
}
