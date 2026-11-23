// Rule (US-14 FR-008; security review of US-14, developer 2026-11-22): an SVG logo comes from the client's material
// and is never published as SVG. Like PNG, JPEG and WebP, it is rasterized with sharp to AVIF and WebP at the header
// height for high-density screens (LOGO_HEIGHT), so no script, handler, stylesheet or link inside it reaches dist/.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { LOGO_HEIGHT, logoVariants } from '../src/lib/logo.ts';

const LOGO = 'src/assets/brand/logo.svg';
const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64">';
const SHAPE = '<circle cx="32" cy="32" r="28" fill="#7a3e0c"/>';
const svg = (inner) => `${SVG_OPEN}${SHAPE}${inner}</svg>`;

/** The published variant of `content` as the light logo of a scratch repo. */
async function publish(content) {
  const dir = await mkdtemp(path.join(tmpdir(), 'site-logo-svg-'));
  try {
    await mkdir(path.join(dir, 'src', 'assets', 'brand'), { recursive: true });
    await writeFile(path.join(dir, ...LOGO.split('/')), content);
    const [light] = await logoVariants({ light: LOGO, alt: 'Logo' }, dir);
    return light;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function assertRaster(variant) {
  assert.deepEqual(
    variant.files.map((f) => f.type),
    ['image/avif', 'image/webp'],
  );
  for (const file of variant.files) {
    assert.match(file.name, /^logo-light\.[0-9a-f]{8}\.(avif|webp)$/);
    assert.doesNotMatch(Buffer.from(file.bytes).toString('latin1'), /<svg|<script|xml-stylesheet/i, file.name);
  }
}

describe('an SVG logo is published only as AVIF and WebP', () => {
  it(`a plain SVG -> AVIF and WebP rendered at ${LOGO_HEIGHT} px high, not upscaled from its 64 px`, async () => {
    const light = await publish(svg(''));
    assertRaster(light);
    assert.equal(light.height, LOGO_HEIGHT);
    assert.equal(light.width, LOGO_HEIGHT);
  });

  it('an old Illustrator export with the public SVG 1.1 DOCTYPE is accepted', async () => {
    const doctype =
      '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    assertRaster(await publish(`${doctype}${svg('')}`));
  });

  // The bypasses found by the security review of a substring filter: rasterized, none of them can run.
  const active = [
    ['a script element', svg('<script>alert(1)</script>')],
    ['an event handler', svg('<circle cx="10" cy="10" r="5" onload="alert(1)"/>')],
    ['a foreignObject', svg('<foreignObject width="10" height="10"><p>x</p></foreignObject>')],
    ['a javascript: link', svg('<a href="javascript:alert(1)"><circle cx="10" cy="10" r="5"/></a>')],
    ['a namespaced svg:script', svg('<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>')],
    ['an XHTML script', svg('<h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script>')],
    ['an animation that sets href', svg('<a><animate attributeName="href" values="&#106;avascript:alert(1)"/></a>')],
    ['a CSS @import', svg('<style>@import url(https://evil.example/x.css);</style>')],
    [
      'an embedded XSLT stylesheet',
      '<?xml-stylesheet type="text/xsl" href="#s"?>' +
        svg(
          '<xsl:stylesheet id="s" version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/">' +
            '<xsl:element name="script" namespace="http://www.w3.org/2000/svg">alert(1)</xsl:element></xsl:template></xsl:stylesheet>',
        ),
    ],
  ];
  for (const [name, content] of active) {
    it(`an SVG with ${name} -> only AVIF and WebP, no SVG published`, async () => {
      assertRaster(await publish(content));
    });
  }
});
