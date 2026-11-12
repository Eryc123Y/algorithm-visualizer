/**
 * Text as glyph outlines, for standalone SVG (ADR 0024). Each text becomes
 * one path in the face that layout measured it with, so the figure looks
 * the same in any renderer, with or without the font installed. A text
 * with a code point the face has no outline for stays text.
 */
import {
  dotGothic16RegularOutlines,
  interSemiBoldOutlines,
  jetbrainsMonoSemiBoldOutlines,
  lexendSemiBoldOutlines,
  notoSansMonoSemiBoldOutlines,
  notoSansSemiBoldOutlines,
  stixTwoTextSemiBoldOutlines,
  textWidth,
  type FontMetrics,
  type FontOutlines,
} from '@algomotion/fonts';

import { num } from './format.ts';
import type { SvgNode } from './paint.ts';
import type { SvgTheme } from './theme.ts';

/** The outlines of the bundled faces, those of every built-in theme. */
export const bundledOutlines: readonly FontOutlines[] = [
  jetbrainsMonoSemiBoldOutlines,
  interSemiBoldOutlines,
  stixTwoTextSemiBoldOutlines,
  lexendSemiBoldOutlines,
  notoSansSemiBoldOutlines,
  notoSansMonoSemiBoldOutlines,
  dotGothic16RegularOutlines,
];

/** The glyphs of a face by code point, or undefined if it has none. */
export type GlyphLookup = (
  face: FontMetrics,
) => ReadonlyMap<number, string> | undefined;

const tables = new WeakMap<FontOutlines, ReadonlyMap<number, string>>();

const glyphsOf = (outlines: FontOutlines): ReadonlyMap<number, string> => {
  const cached = tables.get(outlines);
  if (cached !== undefined) return cached;
  const table = new Map(outlines.glyphs);
  tables.set(outlines, table);
  return table;
};

/** Looks glyphs up by face id among `sets`. */
export function glyphLookup(sets: readonly FontOutlines[]): GlyphLookup {
  const byId = new Map(sets.map((set) => [set.id, set]));
  return (face) => {
    const set = byId.get(face.id);
    return set !== undefined && set.unitsPerEm === face.unitsPerEm
      ? glyphsOf(set)
      : undefined;
  };
}

export interface OutlinedText {
  /** Path data in font units, from the pen's start on the baseline. */
  readonly d: string;
  /** Font units to scene units. */
  readonly scale: number;
  /** Advance of the whole text, in scene units. */
  readonly width: number;
}

const FIRST_MOVE = /^M(-?\d+)/;

/**
 * `text` set in `face` at `fontSize`, with `tracking` em after each
 * character, or undefined if a character has no outline.
 */
export function outlineText(
  text: string,
  face: FontMetrics,
  glyphs: ReadonlyMap<number, string>,
  fontSize: number,
  tracking = 0,
): OutlinedText | undefined {
  const em = face.unitsPerEm;
  let pen = 0;
  let d = '';
  for (const char of text) {
    const path = glyphs.get(char.codePointAt(0)!);
    if (path === undefined) return undefined;
    if (path !== '') {
      const x = Math.round(pen);
      d += path.replace(
        FIRST_MOVE,
        (_, first: string) => `M${Number(first) + x}`,
      );
    }
    pen += (textWidth(char, face) + tracking) * em;
  }
  return { d, scale: fontSize / em, width: (pen / em) * fontSize };
}

/** Attributes only a text element takes; a path drops them. */
const TEXT_ONLY: ReadonlySet<string> = new Set([
  'x',
  'y',
  'text-anchor',
  'font-size',
  'font-weight',
  'font-family',
  'letter-spacing',
]);

/** A scale factor with enough digits for font units (e.g. 13 / 2048). */
const factor = (n: number): string => String(Number(n.toPrecision(6)));

/**
 * Letter spacing in em, from a `letter-spacing` attribute such as "0.02em";
 * painters write only em, so anything else counts as none.
 */
function trackingOf(value: string | undefined): number {
  const em = value?.endsWith('em') ? Number(value.slice(0, -2)) : 0;
  return Number.isFinite(em) ? em : 0;
}

/**
 * `node` with each text in it drawn as one path in the theme's face, where
 * every character has an outline; other texts stay text.
 */
export function outlineNode(
  node: SvgNode,
  t: SvgTheme,
  glyphs: GlyphLookup,
): SvgNode {
  if (node.tag !== 'text')
    return node.children === undefined
      ? node
      : {
          ...node,
          children: node.children.map((c) => outlineNode(c, t, glyphs)),
        };
  const text = node.text ?? '';
  const face = t.fontMetrics[node.font ?? 'value'];
  const table = glyphs(face);
  const attrs = node.attrs;
  const outlined =
    text === '' || table === undefined
      ? undefined
      : outlineText(
          text,
          face,
          table,
          Number(attrs['font-size']),
          trackingOf(attrs['letter-spacing']),
        );
  if (outlined === undefined) return node;
  const anchor = attrs['text-anchor'] ?? 'start';
  const shift =
    anchor === 'middle'
      ? outlined.width / 2
      : anchor === 'end'
        ? outlined.width
        : 0;
  const x = Number(attrs['x'] ?? 0) - shift;
  const y = Number(attrs['y'] ?? 0);
  // Strokes (label halos) scale with the path: undo that.
  const paint = Object.entries(attrs).flatMap(([name, value]) =>
    TEXT_ONLY.has(name)
      ? []
      : [
          [
            name,
            name === 'stroke-width'
              ? factor(Number(value) / outlined.scale)
              : value,
          ] as const,
        ],
  );
  return {
    tag: 'path',
    attrs: {
      transform: `translate(${num(x)} ${num(y)}) scale(${factor(outlined.scale)})`,
      d: outlined.d,
      ...Object.fromEntries(paint),
      role: 'img',
      'aria-label': text,
    },
  };
}
