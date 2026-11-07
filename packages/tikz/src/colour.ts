/**
 * CSS colours as TikZ needs them: a hexadecimal RGB value for `xcolor`'s
 * HTML model and an opacity (ADR 0027). Themes are written in CSS colours,
 * which the player and SVG take as they are, so every theme that works
 * there must work here: hexadecimal of 3, 4, 6 or 8 digits, `rgb()` and
 * `hsl()` in their comma and space forms with numbers or percentages, the
 * CSS colour names and `transparent`.
 */

export interface Colour {
  /** `RRGGBB`, upper case. */
  readonly hex: string;
  /** From 0, transparent, to 1, opaque. */
  readonly opacity: number;
}

/** The CSS named colours (CSS Color 4), as `name:rrggbb` pairs. */
const NAMED = new Map(
  (
    'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff ' +
    'beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff ' +
    'blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 ' +
    'chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c ' +
    'cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 ' +
    'darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b ' +
    'darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 ' +
    'darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f ' +
    'darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 ' +
    'deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 ' +
    'floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ' +
    'ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 ' +
    'greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c ' +
    'indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 ' +
    'lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 ' +
    'lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 ' +
    'lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa ' +
    'lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 ' +
    'lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 ' +
    'magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd ' +
    'mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 ' +
    'mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc ' +
    'mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 ' +
    'moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 ' +
    'olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 ' +
    'palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 ' +
    'papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd ' +
    'powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f ' +
    'royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 ' +
    'seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb ' +
    'slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f ' +
    'steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 ' +
    'turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 ' +
    'yellow:ffff00 yellowgreen:9acd32'
  )
    .split(' ')
    .map((pair) => pair.split(':') as [string, string]),
);

const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));

const byte = (n: number) =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** A number, or a percentage of `whole`; NaN for anything else. */
function amount(text: string, whole: number): number {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i.exec(text);
  if (m === null) return NaN;
  return m[2] === '%' ? (Number(m[1]) / 100) * whole : Number(m[1]);
}

/** A hue in degrees: a number, or an angle in deg, rad, grad or turn. */
function hue(text: string): number {
  const m =
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(
      text,
    );
  if (m === null) return NaN;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'deg').toLowerCase();
  return unit === 'rad'
    ? (n * 180) / Math.PI
    : unit === 'grad'
      ? n * 0.9
      : unit === 'turn'
        ? n * 360
        : n;
}

/** The arguments of `rgb()` or `hsl()`: three values and an alpha. */
function argumentsOf(body: string): string[] | undefined {
  const parts = body.includes(',')
    ? body.split(',').map((p) => p.trim())
    : body.trim().split(/\s*\/\s*|\s+/);
  return parts.length === 3 || parts.length === 4 ? parts : undefined;
}

function fromRgb(parts: readonly string[]): Colour | undefined {
  const [r, g, b] = parts.slice(0, 3).map((p) => amount(p, 255)) as [
    number,
    number,
    number,
  ];
  const a = parts[3] === undefined ? 1 : amount(parts[3], 1);
  if (![r, g, b, a].every(Number.isFinite)) return undefined;
  return { hex: `${byte(r)}${byte(g)}${byte(b)}`, opacity: clamp(a, 0, 1) };
}

function fromHsl(parts: readonly string[]): Colour | undefined {
  const h = hue(parts[0]!);
  const s = amount(parts[1]!, 1);
  const l = amount(parts[2]!, 1);
  const a = parts[3] === undefined ? 1 : amount(parts[3], 1);
  if (![h, s, l, a].every(Number.isFinite)) return undefined;
  // CSS Color 4, `hslToRgb`.
  const sat = clamp(s, 0, 1);
  const light = clamp(l, 0, 1);
  const f = (n: number) => {
    const k = (n + (((h % 360) + 360) % 360) / 30) % 12;
    const chroma = sat * Math.min(light, 1 - light);
    return 255 * (light - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return {
    hex: `${byte(f(0))}${byte(f(8))}${byte(f(4))}`,
    opacity: clamp(a, 0, 1),
  };
}

/**
 * Reads a CSS colour.
 * @throws Error for text that is not one, which is a mistake in a theme.
 */
export function parseColour(text: string): Colour {
  const value = text.trim().toLowerCase();
  if (value === 'transparent') return { hex: '000000', opacity: 0 };
  const named = NAMED.get(value);
  if (named !== undefined) return { hex: named.toUpperCase(), opacity: 1 };
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];
  if (hex !== undefined) {
    const full = hex.length <= 4 ? [...hex].map((d) => d + d).join('') : hex;
    return {
      hex: full.slice(0, 6).toUpperCase(),
      opacity: full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1,
    };
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(value);
  const parts = fn === null ? undefined : argumentsOf(fn[2]!);
  const colour =
    parts === undefined
      ? undefined
      : fn![1]!.startsWith('rgb')
        ? fromRgb(parts)
        : fromHsl(parts);
  if (colour !== undefined) return colour;
  throw new Error(`Cannot read the colour "${text}"`);
}
