// Image size from the first bytes of a file (US-15 FR-002, FR-011; plan decision 1). Nothing is decoded: only the
// fixed header fields that state width and height are read, so a decompression bomb or a malformed body costs nothing.
// The type comes from the magic bytes, never from the extension. Anything this cannot read is `undefined`.

export type ImageType = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'avif';

export interface ImageSize {
  type: ImageType;
  width: number;
  height: number;
}

/** How many leading bytes the caller should pass: enough for a JPEG whose frame follows EXIF, XMP and ICC segments. */
export const HEADER_BYTES = 256 * 1024;

/** Above this, an image gets the "too many pixels" notice. */
export const MAX_PIXELS = 100_000_000;

export function exceedsPixelCap(width: number, height: number): boolean {
  return width * height > MAX_PIXELS;
}

export function readImageSize(head: Uint8Array): ImageSize | undefined {
  const size = png(head) ?? gif(head) ?? jpeg(head) ?? webp(head) ?? avif(head) ?? svg(head);
  return size &&
    Number.isSafeInteger(size.width) &&
    Number.isSafeInteger(size.height) &&
    size.width > 0 &&
    size.height > 0
    ? size
    : undefined;
}

// A byte past the end reads as 0, which every caller treats as "not this format" or as an invalid size.
const byte = (b: Uint8Array, at: number) => b[at] ?? 0;
const ascii = (b: Uint8Array, at: number, text: string) =>
  b.length >= at + text.length && [...text].every((ch, i) => byte(b, at + i) === ch.charCodeAt(0));
const u16be = (b: Uint8Array, at: number) => (byte(b, at) << 8) | byte(b, at + 1);
const u16le = (b: Uint8Array, at: number) => byte(b, at) | (byte(b, at + 1) << 8);
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | (byte(b, at + 2) << 16);
const u32be = (b: Uint8Array, at: number) => ((u16be(b, at) << 16) | u16be(b, at + 2)) >>> 0;
const u32le = (b: Uint8Array, at: number) => ((u16le(b, at + 2) << 16) | u16le(b, at)) >>> 0;

function png(b: Uint8Array): ImageSize | undefined {
  if (b[0] !== 0x89 || !ascii(b, 1, 'PNG\r\n') || !ascii(b, 12, 'IHDR') || b.length < 24) return undefined;
  return { type: 'png', width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b: Uint8Array): ImageSize | undefined {
  if (!(ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) || b.length < 10) return undefined;
  return { type: 'gif', width: u16le(b, 6), height: u16le(b, 8) };
}

// Start-of-frame markers that carry the size: C0-CF except DHT (C4), JPG (C8) and DAC (CC).
const isFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

function jpeg(b: Uint8Array): ImageSize | undefined {
  if (b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return undefined;
    const marker = byte(b, at + 1);
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return undefined; // end of image or start of scan, and no frame yet
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // markers without a length
      continue;
    }
    const length = u16be(b, at + 2);
    if (length < 2) return undefined;
    if (isFrame(marker)) {
      if (at + 9 > b.length) return undefined;
      return { type: 'jpeg', width: u16be(b, at + 7), height: u16be(b, at + 5) };
    }
    at += 2 + length;
  }
  return undefined;
}

function webp(b: Uint8Array): ImageSize | undefined {
  if (!ascii(b, 0, 'RIFF') || !ascii(b, 8, 'WEBP')) return undefined;
  if (ascii(b, 12, 'VP8X') && b.length >= 30)
    return { type: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (ascii(b, 12, 'VP8 ') && b.length >= 30) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return undefined;
    return { type: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (ascii(b, 12, 'VP8L') && b.length >= 25) {
    if (b[20] !== 0x2f) return undefined;
    const bits = u32le(b, 21);
    return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

// ISO-BMFF boxes: [size u32][type 4 chars][payload]. Only the path meta > iprp > ipco > ispe is walked.
interface Box {
  type: string;
  start: number;
  end: number;
}

function boxes(b: Uint8Array, start: number, end: number): Box[] | undefined {
  const found: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const size = u32be(b, at);
    if (size < 8 || at + size > end) return found.length ? found : undefined;
    found.push({
      type: String.fromCharCode(byte(b, at + 4), byte(b, at + 5), byte(b, at + 6), byte(b, at + 7)),
      start: at + 8,
      end: at + size,
    });
    at += size;
  }
  return found;
}

function avif(b: Uint8Array): ImageSize | undefined {
  if (!ascii(b, 4, 'ftyp') || !(ascii(b, 8, 'avif') || ascii(b, 8, 'avis'))) return undefined;
  const meta = boxes(b, 0, b.length)?.find((x) => x.type === 'meta');
  if (!meta) return undefined;
  const iprp = boxes(b, meta.start + 4, meta.end)?.find((x) => x.type === 'iprp'); // meta is a full box
  const ipco = iprp && boxes(b, iprp.start, iprp.end)?.find((x) => x.type === 'ipco');
  const specs =
    (ipco && boxes(b, ipco.start, ipco.end)?.filter((x) => x.type === 'ispe' && x.end - x.start >= 12)) ?? [];
  let best: ImageSize | undefined;
  for (const spec of specs) {
    const size: ImageSize = { type: 'avif', width: u32be(b, spec.start + 4), height: u32be(b, spec.start + 8) };
    if (!best || size.width * size.height > best.width * best.height) best = size;
  }
  return best;
}

// SVG: only the attributes of the root <svg> tag are read; nothing is parsed, resolved or run.
const SVG_TAG = /<svg(?=[\s>/])[^>]*>/i;
const PIXELS = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/;

const ATTRIBUTES = {
  width: /\swidth\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  height: /\sheight\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  viewBox: /\sviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
};

function attribute(tag: string, name: keyof typeof ATTRIBUTES): string | undefined {
  const match = ATTRIBUTES[name].exec(tag);
  return match?.[1] ?? match?.[2];
}

function svg(b: Uint8Array): ImageSize | undefined {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(b);
  const tag = SVG_TAG.exec(text)?.[0];
  if (!tag) return undefined;
  const width = PIXELS.exec(attribute(tag, 'width') ?? '')?.[1];
  const height = PIXELS.exec(attribute(tag, 'height') ?? '')?.[1];
  if (width && height) return { type: 'svg', width: Math.round(Number(width)), height: Math.round(Number(height)) };
  const box = attribute(tag, 'viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length !== 4 || !box.every(Number.isFinite)) return undefined;
  return { type: 'svg', width: Math.round(box[2] ?? 0), height: Math.round(box[3] ?? 0) };
}
