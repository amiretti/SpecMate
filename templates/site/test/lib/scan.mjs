// Scanners for the site guardrails (ADR-0030). Regex-based on purpose: the build output is
// Astro-generated HTML, and the checks must fail closed (false positives over misses).
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Recursively lists every file under `dir`. Missing dir -> []. */
export async function listFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

const TAG = /<[a-z][a-z0-9-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const FORBIDDEN_ELEMENT = /^<(script|style|iframe|object|embed)\b/i;
const URL_ATTRS = new Set([
  'href',
  'src',
  'srcset',
  'action',
  'formaction',
  'data',
  'poster',
  'xlink:href',
  'background',
  'cite',
  'ping',
]);
const NAMED_ENTITIES = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  sol: '/',
  lpar: '(',
  rpar: ')',
  nbsp: ' ',
};

/** Decodes numeric and the URL-relevant named HTML entities (semicolon optional). */
export function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);?/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function attributes(tag) {
  const body = tag.replace(/^<[a-z][a-z0-9-]*/i, '').replace(/\/?>$/, '');
  return [...body.matchAll(ATTR)].map(([, name, raw = '']) => ({
    name: name.toLowerCase(),
    // Browsers drop control chars and whitespace inside URL schemes: "java\tscript:" runs.
    url: decodeEntities(raw.replace(/^["']|["']$/g, ''))
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point.
      .replace(/[\u0000- ]/g, '')
      .toLowerCase(),
  }));
}

function carriesInlineCode(tag) {
  if (FORBIDDEN_ELEMENT.test(tag)) return true;
  return attributes(tag).some(
    ({ name, url }) =>
      name.startsWith('on') ||
      name === 'style' ||
      name === 'srcdoc' ||
      url.startsWith('javascript:') ||
      (URL_ATTRS.has(name) && /(^|,)data:/.test(url)),
  );
}

/**
 * Returns every opening tag that carries inline or embedded code: <script>, <style>,
 * <iframe>, <object> and <embed> elements; on*=, style= and srcdoc= attributes;
 * javascript: URLs (also entity-encoded or split by whitespace/control chars) and data: URLs.
 */
export function findInlineCode(html) {
  const hits = [];
  for (const [tag] of html.matchAll(TAG)) {
    if (carriesInlineCode(tag)) hits.push(tag.slice(0, 120));
  }
  return hits;
}

/** Returns each set:html use (attribute or spread key) and each unescapeHTML in source text. */
export function findSetHtml(source) {
  return [...source.matchAll(/set:html|\bunescapeHTML\b/g)].map((m) => m[0]);
}

// TODO/XXX are case-sensitive so the Spanish word "todo" does not match.
const PLACEHOLDERS = [/lorem/gi, /\[\s*tu\b/gi, /\bTODO\b/g, /XXX/g];

/** Returns every placeholder fragment found in text. */
export function findPlaceholders(text) {
  return PLACEHOLDERS.flatMap((re) => [...text.matchAll(re)].map((m) => m[0]));
}

/** Returns every <img> tag without an alt attribute (alt="" counts as present). */
export function findImagesWithoutAlt(html) {
  return [...html.matchAll(TAG)].map(([tag]) => tag).filter((tag) => /^<img\b/i.test(tag) && !/\salt\s*=/i.test(tag));
}

/**
 * Parses Cloudflare `_headers` into Map<pathPattern, { headers, detached }>: `headers` maps
 * lowercase name -> value; `detached` lists lowercase names removed with `! Name`.
 */
export function parseHeaders(text) {
  const rules = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { headers: new Map(), detached: [] };
      rules.set(line, current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('!')) {
      current.detached.push(line.slice(1).trim().toLowerCase());
      continue;
    }
    const sep = line.indexOf(':');
    if (sep > 0) current.headers.set(line.slice(0, sep).trim().toLowerCase(), line.slice(sep + 1).trim());
  }
  return rules;
}

const SECURITY_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];

// The template's baseline: relaxing any of these must fail.
const PINNED_CSP = {
  'default-src': "'self'",
  'script-src': "'none'",
  'connect-src': "'none'",
  'form-action': "'none'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'frame-ancestors': "'none'",
};
const SOURCE_DIRECTIVES = ['default-src', 'script-src', 'style-src'];
const FORBIDDEN_SOURCES = new Set(['*', 'data:', 'blob:', 'https:', 'http:', "'unsafe-hashes'", "'wasm-unsafe-eval'"]);
const WEAK_REFERRER = new Set(['unsafe-url', 'no-referrer-when-downgrade']);

function parseCsp(csp) {
  return new Map(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name.toLowerCase(), values]),
  );
}

/** Problems with the security headers a single rule sets; `baseline` also pins the template CSP. */
function checkRule(pattern, { headers, detached }, baseline) {
  const problems = [];
  for (const name of detached) {
    if (SECURITY_HEADERS.includes(name)) problems.push(`${pattern}: detaches ${name}`);
  }

  const csp = headers.get('content-security-policy');
  if (csp !== undefined) {
    if (/'unsafe-inline'|'unsafe-eval'/i.test(csp))
      problems.push(`${pattern}: CSP allows unsafe-inline or unsafe-eval`);
    const directives = parseCsp(csp);
    for (const name of SOURCE_DIRECTIVES) {
      for (const source of directives.get(name) ?? []) {
        if (FORBIDDEN_SOURCES.has(source.toLowerCase())) problems.push(`${pattern}: CSP ${name} allows ${source}`);
      }
    }
    if (baseline) {
      for (const [name, value] of Object.entries(PINNED_CSP)) {
        if (directives.get(name)?.join(' ') !== value) problems.push(`${pattern}: CSP needs ${name} ${value}`);
      }
    }
  } else if (baseline) {
    problems.push(`${pattern}: missing Content-Security-Policy`);
  }

  const hsts = headers.get('strict-transport-security');
  if (hsts !== undefined || baseline) {
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? '')?.[1] ?? 0);
    if (maxAge < 31536000) problems.push(`${pattern}: HSTS needs max-age >= 31536000`);
  }

  const nosniff = headers.get('x-content-type-options');
  if ((nosniff !== undefined || baseline) && nosniff?.toLowerCase() !== 'nosniff') {
    problems.push(`${pattern}: X-Content-Type-Options must be nosniff`);
  }

  const referrer = headers.get('referrer-policy');
  if (referrer === undefined) {
    if (baseline) problems.push(`${pattern}: missing Referrer-Policy`);
  } else if (
    !referrer.trim() ||
    referrer
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .some((v) => WEAK_REFERRER.has(v))
  ) {
    problems.push(`${pattern}: weak Referrer-Policy ${referrer}`);
  }

  if (baseline && !headers.get('permissions-policy')) problems.push(`${pattern}: missing Permissions-Policy`);
  return problems;
}

/**
 * Returns the problems of a `_headers` file; [] when compliant. The `/*` rule must carry the
 * full baseline; every other rule is checked so it cannot detach or weaken a security header.
 */
export function checkHeaders(text) {
  const rules = parseHeaders(text);
  if (!rules.has('/*')) return ['no rule for /*'];
  return [...rules].flatMap(([pattern, rule]) => checkRule(pattern, rule, pattern === '/*'));
}
