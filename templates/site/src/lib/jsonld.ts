// The only JSON-LD serializer of the template (ADR-0035, ADR-0036). Its output is the only value
// components/JsonLd.astro may inject raw (ADR-0036): "<", ">" and "&" become backslash-u escapes (u003c, u003e, u0026), so no data
// can close the <script> element, open an HTML comment or form an entity; JSON.parse restores the exact text.
export function serializeJsonLd(value: object): string {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
