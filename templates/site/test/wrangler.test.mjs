// Rule (FR-007, ADR-0035 "Hosting y headers"): Workers static assets serve dist/ and answer an unknown path with
// a real 404 carrying dist/404.html ("404-page"); "none" returns Workers' generic 404 body (research R1).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Strips // and /* *\/ comments outside strings, then parses (JSONC as wrangler reads it). */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      out += char;
      if (char === '\\') out += text[++i] ?? '';
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
    } else {
      out += char;
    }
  }
  return JSON.parse(out);
}

describe('wrangler.jsonc', () => {
  it('serves dist/ with not_found_handling "404-page"', async () => {
    const config = parseJsonc(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
    assert.equal(config.assets?.directory, './dist/');
    assert.equal(config.assets?.not_found_handling, '404-page');
  });

  it('declares no Worker script (static assets only, ADR-0030)', async () => {
    const config = parseJsonc(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
    assert.equal(config.main, undefined);
  });
});
