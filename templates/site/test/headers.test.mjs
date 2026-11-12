// Rule (S2/S5, ADR-0030 "Headers"): _headers carries a strict CSP and security headers.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { distDir } from './lib/paths.mjs';
import { checkHeaders } from './lib/scan.mjs';

const GOOD = `/*
  Content-Security-Policy: default-src 'self'; script-src 'none'; style-src 'self'; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;

describe('header checker', () => {
  it('accepts a complete policy', () => {
    assert.deepEqual(checkHeaders(GOOD), []);
  });

  const broken = {
    'unsafe-inline': GOOD.replace("default-src 'self'", "default-src 'self' 'unsafe-inline'"),
    'unsafe-eval': GOOD.replace("object-src 'none'", "object-src 'none'; script-src 'self' 'unsafe-eval'"),
    'missing default-src': GOOD.replace("default-src 'self'; ", ''),
    'wrong default-src': GOOD.replace("default-src 'self'", 'default-src *'),
    'missing object-src': GOOD.replace("object-src 'none'; ", ''),
    'missing base-uri': GOOD.replace("base-uri 'self'; ", ''),
    'missing frame-ancestors': GOOD.replace("; frame-ancestors 'none'", ''),
    'missing HSTS': GOOD.replace(/ {2}Strict-Transport-Security.*\n/, ''),
    'HSTS without max-age': GOOD.replace('max-age=31536000; ', ''),
    'missing nosniff': GOOD.replace('nosniff', 'off'),
    'missing Referrer-Policy': GOOD.replace(/ {2}Referrer-Policy.*\n/, ''),
    'missing Permissions-Policy': GOOD.replace(/ {2}Permissions-Policy.*\n/, ''),
    'headers not under /*': GOOD.replace('/*', '/only-this-page'),
    // Item 1: wildcards and weak sources in default-src, script-src and style-src.
    ...Object.fromEntries(
      ['default-src', 'script-src', 'style-src'].flatMap((d) =>
        ['*', 'data:', 'blob:', 'https:', 'http:', "'unsafe-hashes'", "'wasm-unsafe-eval'"].map((src) => [
          `${d} with ${src}`,
          GOOD.replace(new RegExp(`${d} '(self|none)'`), (m) => `${m} ${src}`),
        ]),
      ),
    ),
    'Referrer-Policy unsafe-url': GOOD.replace('strict-origin-when-cross-origin', 'unsafe-url'),
    'Referrer-Policy no-referrer-when-downgrade': GOOD.replace(
      'strict-origin-when-cross-origin',
      'no-referrer-when-downgrade',
    ),
    'script-src relaxed': GOOD.replace("script-src 'none'", "script-src 'self'"),
    'script-src missing': GOOD.replace("script-src 'none'; ", ''),
    'connect-src relaxed': GOOD.replace("connect-src 'none'", "connect-src 'self'"),
    'form-action relaxed': GOOD.replace("form-action 'none'", "form-action 'self'"),
    'object-src relaxed': GOOD.replace("object-src 'none'", "object-src 'self'"),
    'frame-ancestors relaxed': GOOD.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
    // Item 2: detach lines and other rule blocks.
    'detach CSP in /*': `${GOOD}  ! Content-Security-Policy
`,
    'detach CSP in another rule': `${GOOD}/admin/*
  ! Content-Security-Policy
`,
    'detach HSTS in another rule': `${GOOD}/blog/*
  !Strict-Transport-Security
`,
    'weak CSP in another rule': `${GOOD}/promo/*
  Content-Security-Policy: default-src *
`,
    'unsafe-inline in another rule': `${GOOD}/promo/*
  Content-Security-Policy: script-src 'unsafe-inline'
`,
    'weak Referrer-Policy in another rule': `${GOOD}/promo/*
  Referrer-Policy: unsafe-url
`,
    'CSP only in a comment': `# Content-Security-Policy: default-src 'self'\n${GOOD.replace(/ {2}Content-Security-Policy.*\n/, '')}`,
  };
  it('accepts an extra rule that only adds a harmless header', () => {
    assert.deepEqual(
      checkHeaders(`${GOOD}/assets/*
  Cache-Control: public, max-age=31536000, immutable
`),
      [],
    );
  });

  for (const [name, text] of Object.entries(broken)) {
    it(`rejects ${name}`, () => {
      assert.ok(checkHeaders(text).length > 0, name);
    });
  }
});

describe('dist/_headers', () => {
  it('is published with every required directive and header', async () => {
    const text = await readFile(path.join(distDir, '_headers'), 'utf8');
    assert.deepEqual(checkHeaders(text), []);
  });
});
