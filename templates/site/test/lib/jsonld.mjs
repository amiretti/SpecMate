// The only inline code ADR-0035 admits: one <script type="application/ld+json"> data block per page, with that
// exact opening tag, content that parses as JSON and no "<" inside. splitJsonLd takes those blocks out so the
// unchanged findInlineCode still flags every other <script>, <style> or on*= (ADR-0035, plan decision 2).

import { findSetHtml } from './scan.mjs';

const SCRIPT_OPEN = /<script\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const JSON_LD_OPEN = '<script type="application/ld+json">';

/**
 * Returns { blocks, rest, problems }: `blocks` are the parsed JSON values of the admitted blocks, `rest` is the
 * HTML without them (any other script stays in it), `problems` lists blocks that are malformed.
 */
export function splitJsonLd(html) {
  const blocks = [];
  const problems = [];
  let rest = '';
  let cursor = 0;
  for (const match of html.matchAll(SCRIPT_OPEN)) {
    if (match.index < cursor || match[0] !== JSON_LD_OPEN) continue;
    const start = match.index;
    const bodyStart = start + match[0].length;
    // A browser ends the script element at the first "</script", whatever follows: so does this.
    const close = html.toLowerCase().indexOf('</script', bodyStart);
    if (close === -1) {
      problems.push('JSON-LD block is not closed');
      continue;
    }
    const end = html.indexOf('>', close);
    const body = html.slice(bodyStart, close);
    if (body.includes('<')) problems.push('JSON-LD block contains "<"');
    try {
      blocks.push(JSON.parse(body));
    } catch {
      problems.push('JSON-LD block is not valid JSON');
    }
    rest += html.slice(cursor, start);
    cursor = end === -1 ? html.length : end + 1;
  }
  rest += html.slice(cursor);
  return { blocks, rest, problems };
}

/** Problems of a page against ADR-0035: exactly `expected` blocks (1 for a content page, 0 otherwise). */
export function checkJsonLd(html, expected) {
  const { blocks, rest, problems } = splitJsonLd(html);
  const count = blocks.length + problems.filter((p) => p !== 'JSON-LD block contains "<"').length;
  if (count !== expected) problems.push(`expected ${expected} JSON-LD block(s), found ${count}`);
  return { blocks, rest, problems };
}

export const JSON_LD_COMPONENT = 'components/JsonLd.astro';
export const JSON_LD_EXPRESSION = 'set:html={serializeJsonLd(data)}';
const SERIALIZER_IMPORT = "import { serializeJsonLd } from '../lib/jsonld.ts';";

/**
 * ADR-0036 allow-list: set:html (or unescapeHTML) may appear only once, in components/JsonLd.astro, and only as
 * `set:html={serializeJsonLd(data)}`. `files` is [{ rel, text }] with `rel` relative to src/ using "/".
 */
export function checkSetHtml(files) {
  const problems = [];
  for (const { rel, text } of files) {
    const uses = findSetHtml(text);
    if (uses.length === 0) continue;
    if (rel !== JSON_LD_COMPONENT) {
      problems.push(`${rel}: set:html is only allowed in ${JSON_LD_COMPONENT}`);
      continue;
    }
    const exact = text.split(JSON_LD_EXPRESSION).length - 1;
    if (uses.length !== 1 || uses[0] !== 'set:html' || exact !== 1) {
      problems.push(`${rel}: set:html must appear once, exactly as ${JSON_LD_EXPRESSION}`);
    }
    // The serializer must be the template's, not a local stand-in with the same name.
    if (!text.includes(SERIALIZER_IMPORT) || /(function|const|let|var)\s+serializeJsonLd\b/.test(text)) {
      problems.push(`${rel}: serializeJsonLd must come from ${SERIALIZER_IMPORT}`);
    }
  }
  return problems;
}
