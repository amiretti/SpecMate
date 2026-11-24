// A quote is the phrase an agent copied from a client file (US-17 FR-004, plan decision 4). Copying changes the spacing
// and the line breaks, so both sides are compared with every run of whitespace collapsed and without case.

/** A saved quote is at most this long. */
export const MAX_QUOTE = 300;

export function normalizeQuote(text: string): string {
  const bare = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // a BOM is not part of the text
  return bare.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Whether `quote` is in `text`; an empty quote is never found. */
export function quoteIn(text: string, quote: string): boolean {
  const wanted = normalizeQuote(quote);
  return wanted !== '' && normalizeQuote(text).includes(wanted);
}
