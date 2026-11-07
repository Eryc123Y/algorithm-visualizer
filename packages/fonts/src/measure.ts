/**
 * Text measurement with font metrics (ADR 0024). Widths are in em, so they
 * scale with any font size. For each code point, the first rule that
 * applies decides its width:
 *
 * 1. no width: combining marks and default-ignorable code points (joiners,
 *    variation selectors, soft hyphens, tags), except the Hangul fillers,
 *    which are drawn blank but wide; and the parts of an emoji that join
 *    the one before it (an emoji after a zero-width joiner, a skin tone);
 * 2. emoji presentation: a code point followed by U+FE0F is an emoji;
 * 3. the face's table;
 * 4. `defaultAdvance`, if the face has one;
 * 5. emoji: 1.25 em, also for a flag (two regional indicators) or a lone
 *    regional indicator or skin tone;
 * 6. a few glyphs known to be wider than 1 em, such as U+FDFD;
 * 7. East Asian wide and fullwidth: 1 em;
 * 8. anything else: 1 em.
 *
 * Emoji joined into one picture count once, as browsers and colour emoji
 * fonts draw them; a renderer without colour emoji draws the parts side by
 * side, wider than measured. Kerning and ligatures are ignored: they rarely
 * widen text.
 */
import type { FontMetrics } from './types.ts';

const IGNORABLE = /[\p{Mn}\p{Me}\p{Default_Ignorable_Code_Point}]/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

const ZWJ = 0x200d;
const EMOJI_SELECTOR = 0xfe0f;
/** Default-ignorable, but drawn as blanks of a letter's width. */
const HANGUL_FILLERS: ReadonlySet<number> = new Set([0x115f, 0x3164, 0xffa0]);
const EMOJI = 1.25;
const WIDE = 1;
const OTHER = 1;

type Range = readonly [first: number, last: number];

/** East Asian wide and fullwidth blocks. */
const WIDE_RANGES: readonly Range[] = [
  [0x1100, 0x115f], // Hangul Jamo initials
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols and punctuation
  [0x3041, 0x33ff], // kana, Bopomofo, Hangul compatibility Jamo, CJK compatibility
  [0x3400, 0x4dbf], // CJK extension A
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo extended A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms, small forms
  [0xff00, 0xff60], // fullwidth forms
  [0xffe0, 0xffe6], // fullwidth signs
  [0x16fe0, 0x18aff], // ideographic symbols, Tangut
  [0x1b000, 0x1b2ff], // kana supplement and extensions
  [0x1f200, 0x1f2ff], // enclosed ideographic supplement
  [0x20000, 0x3fffd], // CJK extensions B and later
];

/** Glyphs wider than 1 em in common fonts, with an upper bound in em. */
const EXTRA_WIDE: readonly (readonly [
  first: number,
  last: number,
  em: number,
])[] = [
  [0x0bf0, 0x0bfa, 2], // Tamil numbers and signs
  [0x2e3a, 0x2e3a, 2], // two-em dash
  [0x2e3b, 0x2e3b, 3], // three-em dash
  [0xa9c1, 0xa9cd, 2], // Javanese punctuation
  [0xfdf0, 0xfdfc, 2], // Arabic ligatures of words
  [0xfdfd, 0xfdfd, 7], // bismillah
  [0x12000, 0x1254f, 3], // cuneiform
];

const within = (ranges: readonly Range[], cp: number): boolean =>
  ranges.some(([first, last]) => cp >= first && cp <= last);

const isRegionalIndicator = (cp: number | undefined): boolean =>
  cp !== undefined && cp >= 0x1f1e6 && cp <= 0x1f1ff;

const isSkinTone = (cp: number | undefined): boolean =>
  cp !== undefined && cp >= 0x1f3fb && cp <= 0x1f3ff;

const isPictographic = (cp: number | undefined): boolean =>
  cp !== undefined && PICTOGRAPHIC.test(String.fromCodePoint(cp));

const isIgnorable = (cp: number): boolean =>
  IGNORABLE.test(String.fromCodePoint(cp)) && !HANGUL_FILLERS.has(cp);

/** Part of an emoji that a joined sequence or a skin tone can follow. */
const endsEmoji = (cp: number | undefined): boolean =>
  isPictographic(cp) || isSkinTone(cp) || cp === EMOJI_SELECTOR;

/**
 * Whether the code point at `k` joins the emoji before it: an emoji after
 * a zero-width joiner, or a skin tone after an emoji.
 */
function joinsPrevious(points: readonly number[], k: number): boolean {
  const cp = points[k];
  if (isSkinTone(cp)) return isPictographic(points[k - 1]);
  return (
    points[k - 1] === ZWJ && isPictographic(cp) && endsEmoji(points[k - 2])
  );
}

const tables = new WeakMap<FontMetrics, ReadonlyMap<number, number>>();

/**
 * The face's advances by code point, decoded once per face object; keep
 * passing the same object rather than copies.
 */
function tableOf(font: FontMetrics): ReadonlyMap<number, number> {
  const cached = tables.get(font);
  if (cached !== undefined) return cached;
  const table = new Map<number, number>();
  for (const run of font.advances) {
    if (typeof run[1] === 'number') {
      const [first, last, width] = run as readonly [number, number, number];
      for (let cp = first; cp <= last; cp++) table.set(cp, width);
    } else {
      const [first, widths] = run;
      widths.forEach((width, k) => table.set(first + k, width));
    }
  }
  tables.set(font, table);
  return table;
}

/** Width of a code point the face does not have, in em. */
function fallbackWidth(cp: number): number {
  if (isPictographic(cp) || isSkinTone(cp)) return EMOJI;
  const extra = EXTRA_WIDE.find(([first, last]) => cp >= first && cp <= last);
  if (extra !== undefined) return extra[2];
  return within(WIDE_RANGES, cp) ? WIDE : OTHER;
}

/** Width of `text` set in `font`, in em. */
export function textWidth(text: string, font: FontMetrics): number {
  const table = tableOf(font);
  const points = Array.from(text, (char) => char.codePointAt(0)!);
  // Font units and em are summed apart, so table widths stay exact.
  let units = 0;
  let em = 0;
  for (let k = 0; k < points.length; k++) {
    const cp = points[k]!;
    if (isIgnorable(cp) || joinsPrevious(points, k)) continue;
    if (points[k + 1] === EMOJI_SELECTOR) {
      em += EMOJI;
      continue;
    }
    const advance = table.get(cp) ?? font.defaultAdvance;
    if (advance !== undefined) units += advance;
    else if (isRegionalIndicator(cp)) {
      // A flag is a pair; a lone indicator is drawn as a boxed letter.
      em += EMOJI;
      if (isRegionalIndicator(points[k + 1])) k++;
    } else em += fallbackWidth(cp);
  }
  return units / font.unitsPerEm + em;
}

/**
 * A face whose every glyph is `advance` em wide, such as the 0.6 em
 * estimate layout used before it had real metrics.
 */
export function uniformFont(advance: number): FontMetrics {
  if (!Number.isFinite(advance) || advance <= 0)
    throw new RangeError(`advance must be positive, got ${advance}`);
  return {
    id: `uniform-${advance}`,
    family: 'monospace',
    weight: 400,
    unitsPerEm: 1000,
    advances: [],
    defaultAdvance: Math.round(advance * 1000),
  };
}
