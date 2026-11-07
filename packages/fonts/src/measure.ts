/**
 * Text measurement with font metrics (ADR 0024). Widths are in em, so they
 * scale with any font size. For each code point, the first rule that
 * applies decides its width:
 *
 * 1. no width: combining marks, default-ignorable code points (joiners,
 *    variation selectors, soft hyphens, tags), emoji skin-tone modifiers,
 *    and whatever follows a zero-width joiner (the rest of a joined emoji);
 * 2. emoji presentation: a code point followed by U+FE0F is an emoji;
 * 3. the face's table;
 * 4. `defaultAdvance`, if the face has one;
 * 5. emoji: 1.25 em, and 0.625 em for each half of a flag;
 * 6. East Asian wide and fullwidth: 1 em;
 * 7. anything else: 1 em.
 *
 * Kerning and ligatures are ignored: they rarely widen text.
 */
import type { FontMetrics } from './types.ts';

const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Default_Ignorable_Code_Point}]/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

const ZWJ = 0x200d;
const EMOJI_SELECTOR = 0xfe0f;
const EMOJI = 1.25;
const FLAG_HALF = 0.625;
const WIDE = 1;
const OTHER = 1;

/** East Asian wide and fullwidth blocks, as `[first, last]` pairs. */
const WIDE_RANGES: readonly (readonly [number, number])[] = [
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

const isWide = (cp: number): boolean =>
  WIDE_RANGES.some(([first, last]) => cp >= first && cp <= last);

const isRegionalIndicator = (cp: number): boolean =>
  cp >= 0x1f1e6 && cp <= 0x1f1ff;

const isSkinTone = (cp: number): boolean => cp >= 0x1f3fb && cp <= 0x1f3ff;

const tables = new WeakMap<FontMetrics, ReadonlyMap<number, number>>();

/** The face's advances by code point, decoded once per face. */
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

function fallbackWidth(cp: number, char: string): number {
  if (isRegionalIndicator(cp)) return FLAG_HALF;
  if (PICTOGRAPHIC.test(char)) return EMOJI;
  if (isWide(cp)) return WIDE;
  return OTHER;
}

/** Width of `text` set in `font`, in em. */
export function textWidth(text: string, font: FontMetrics): number {
  const table = tableOf(font);
  const points = [...text];
  // Font units and em are summed apart, so table widths stay exact.
  let units = 0;
  let em = 0;
  points.forEach((char, k) => {
    const cp = char.codePointAt(0)!;
    if (
      ZERO_WIDTH.test(char) ||
      isSkinTone(cp) ||
      (k > 0 && points[k - 1]!.codePointAt(0) === ZWJ)
    )
      return;
    if (points[k + 1]?.codePointAt(0) === EMOJI_SELECTOR) {
      em += EMOJI;
      return;
    }
    const advance = table.get(cp) ?? font.defaultAdvance;
    if (advance !== undefined) units += advance;
    else em += fallbackWidth(cp, char);
  });
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
