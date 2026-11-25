// What text that came from a client file or from an agent must not carry before it is saved or shown (principle V,
// security review of US-17): control, bidi and invisible characters, and anything shaped like a credential.

/** Control, bidi and invisible characters: never sent to a terminal as they are, never saved in a field. */
export const isUnsafe = (code: number) =>
  code < 0x20 ||
  code === 0x061c ||
  (code >= 0x200b && code <= 0x200d) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x2060 ||
  code === 0xfeff ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x200e ||
  code === 0x200f ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069);

export const hasUnsafeCharacters = (text: string): boolean => [...text].some((ch) => isUnsafe(ch.codePointAt(0) ?? 0));

// A PEM header, an AWS key id, the prefixes of common API tokens at the start of a word, or 24 or more characters of
// base64 or hex without a space. A client's own sentence has none of these.
const SECRET_SHAPES: readonly RegExp[] = [
  /-----BEGIN/,
  /AKIA[0-9A-Za-z]{16}/,
  /(?:^|[^A-Za-z0-9])(?:sk-|ghp_|github_pat_|xox)/,
  /[A-Za-z0-9+/]{24,}={0,2}/,
];

export const looksLikeSecret = (text: string): boolean => SECRET_SHAPES.some((shape) => shape.test(text));
