// Detector of literal design values in hand-written CSS (FR-001): colour, font family, font size, spacing and
// radius must come from var(--token). @media preludes are exempt (breakpoints cannot use variables).

const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
  cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
  darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
  firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
  hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
  mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
  midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
  rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
  whitesmoke yellow yellowgreen`.split(/\s+/),
);

const COLOR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
const LENGTH_LITERAL = /(?<![\w.-])-?\d*\.?\d+(px|rem|em|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in|%)(?![\w-])/i;
const SPACING_PROPERTY =
  /^(margin|padding|gap|row-gap|column-gap|top|right|bottom|left|inset)(-(top|right|bottom|left|block|inline)(-(start|end))?|-block|-inline)?$/;

const withoutVars = (value) => {
  let out = value;
  // Drop var(...) with nested parentheses (fallbacks) by repeatedly removing the innermost ones.
  for (let i = 0; i < 20 && /var\(/.test(out); i += 1) out = out.replace(/var\([^()]*\)/g, ' ');
  return out;
};

function classify(property, rawValue) {
  const value = withoutVars(rawValue);
  const found = [];
  if (HEX.test(value) || COLOR_FUNCTION.test(value)) found.push('color');
  else if (value.split(/[\s,/()]+/).some((word) => NAMED_COLORS.has(word.toLowerCase()))) found.push('color');
  if (property === 'font-family' && value.trim() !== '' && !/^(inherit|initial|unset|revert)$/.test(value.trim())) {
    found.push('font-family');
  }
  if (property === 'font-size' && LENGTH_LITERAL.test(value)) found.push('font-size');
  if (property === 'font' && value.trim() !== '' && !/^(inherit|initial|unset|revert)$/.test(value.trim())) {
    found.push('font');
  }
  if (SPACING_PROPERTY.test(property) && LENGTH_LITERAL.test(value)) found.push('spacing');
  if (/^border(-\w+)*-radius$/.test(property) && LENGTH_LITERAL.test(value)) found.push('radius');
  return found;
}

/** Returns `{line, kind, property, value}` for each declaration holding a literal design value. */
export function findLiterals(css) {
  // Blank out comments but keep newlines so line numbers stay right.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const findings = [];
  for (const match of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)(?=;|})/gi)) {
    const property = match[1].toLowerCase();
    if (property.startsWith('--')) continue;
    const value = match[2].trim();
    const line = text.slice(0, match.index).split('\n').length;
    for (const kind of classify(property, value)) findings.push({ line, kind, property, value });
  }
  return findings;
}
