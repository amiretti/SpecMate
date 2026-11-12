// Small readers over built HTML for the SEO, consistency and semantics tests. Regex-based like scan.mjs: the
// input is Astro output, and a miss makes a test fail, never pass.
import { decodeEntities } from './scan.mjs';
import { splitJsonLd } from './jsonld.mjs';

const TAG_ATTR = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

/** Attributes of one opening tag, values entity-decoded. */
export function attrs(tag) {
  const body = tag.replace(/^<[a-z][a-z0-9-]*/i, '').replace(/\/?>$/, '');
  const out = {};
  for (const [, name, raw = ''] of body.matchAll(TAG_ATTR)) {
    out[name.toLowerCase()] = decodeEntities(raw.replace(/^["']|["']$/g, ''));
  }
  return out;
}

/** Every opening tag of an element, as attribute maps. */
export function tags(html, element) {
  const re = new RegExp(`<${element}\\b(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi');
  return [...html.matchAll(re)].map(([tag]) => attrs(tag));
}

/** Content of every <meta> with that name or property. */
export function metas(html, key) {
  return tags(html, 'meta')
    .filter((m) => m.name === key || m.property === key)
    .map((m) => m.content);
}

export const titles = (html) => [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => decodeEntities(m[1]));

/** Normalized text: entities decoded, NBSP and non-breaking hyphens as plain ones, whitespace collapsed. */
export function normalize(text) {
  return decodeEntities(text)
    .replaceAll(' ', ' ')
    .replaceAll('‑', '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The text a reader gets from the body, without CSS: tags dropped, in source order. */
export function visibleText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return normalize(body.replace(/<[^>]*>/g, ' '));
}

/** Inner HTML of the first element with that tag name, or undefined. */
export function element(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1];
}

/** The schema.org graph of a page, and its business node. */
export function schemaOf(html) {
  const [graph] = splitJsonLd(html).blocks;
  const nodes = graph?.['@graph'] ?? [];
  return {
    graph,
    business: nodes.find((n) => ['LocalBusiness', 'Organization'].includes(n['@type'])),
    faq: nodes.find((n) => n['@type'] === 'FAQPage'),
  };
}

export const digits = (text) => String(text).replace(/\D/g, '');
