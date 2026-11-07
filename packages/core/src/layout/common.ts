/**
 * Geometry helpers shared by the layouts of all kinds, so that titles,
 * cells and pointer badges look the same everywhere.
 */
import { textWidth, type FontMetrics } from '@algoviz/fonts';
import type { Scalar } from '@algoviz/spec';

import type { LayoutOptions } from './options.ts';
import type { SceneItem } from './scene.ts';

/**
 * The value at `key` if `record` has it as an own property. Ids are
 * untrusted and may be names such as "constructor" or "__proto__", so
 * id-keyed records are never read with plain indexing.
 */
export const own = <V>(
  record: Readonly<Record<string, V>>,
  key: string,
): V | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

/** Text shown for a value: ECMAScript `String()` conversion. */
export const formatScalar = (value: Scalar): string => String(value);

/**
 * Rounds a width up to whole units, ignoring the floating-point noise of
 * em widths times font sizes.
 */
export const ceilWidth = (width: number): number => Math.ceil(width - 1e-9);

/** Widest of `texts` set in `font`, in em (ADR 0024). */
export const maxWidth = (
  texts: Iterable<string>,
  font: FontMetrics,
): number => {
  let max = 0;
  for (const text of texts) max = Math.max(max, textWidth(text, font));
  return max;
};

/** Width of a cell that fits a value `em` wide in the value font. */
export const cellWidthFor = (em: number, o: LayoutOptions): number =>
  Math.max(o.minCellWidth, ceilWidth(em * o.valueFontSize + 2 * o.cellPadding));

export const titleRowHeight = (o: LayoutOptions): number =>
  o.showTitles ? o.titleFontSize + 11 : 0;

export const indexRowHeight = (o: LayoutOptions): number =>
  o.showIndices ? o.indexFontSize + 8 : 0;

/** Letter spacing of titles, in em; painters draw titles with it. */
export const TITLE_TRACKING = 0.02;

export const titleWidth = (title: string, o: LayoutOptions): number =>
  o.showTitles
    ? ceilWidth(
        (textWidth(title, o.fonts.label) + TITLE_TRACKING * [...title].length) *
          o.titleFontSize,
      )
    : 0;

export function titleItems(
  name: string,
  title: string,
  origin: { readonly x: number; readonly y: number },
  o: LayoutOptions,
): SceneItem[] {
  if (!o.showTitles) return [];
  return [
    {
      type: 'text',
      key: `${name}/title`,
      x: origin.x,
      y: origin.y + titleRowHeight(o) / 2,
      anchor: 'start',
      role: 'title',
      text: title,
      fontSize: o.titleFontSize,
    },
  ];
}

export const badgeHeight = (o: LayoutOptions): number => o.pointerFontSize + 8;

/** Width of a pointer badge whose name is `em` wide in the value font. */
export const badgeWidthFor = (em: number, o: LayoutOptions): number =>
  Math.max(badgeHeight(o), ceilWidth(em * o.pointerFontSize + 12));

/**
 * How far the widest pointer badge, for a name `pointerEm` wide, centred
 * under a slot of width `slotWidth`, sticks out on each side.
 */
export const badgeOverhang = (
  pointerEm: number,
  slotWidth: number,
  o: LayoutOptions,
): number =>
  pointerEm === 0
    ? 0
    : Math.max(0, Math.ceil(badgeWidthFor(pointerEm, o) / 2 - slotWidth / 2));

/** Height of the area below a row that holds `rows` stacked pointer badges. */
export const pointerAreaHeight = (rows: number, o: LayoutOptions): number =>
  rows === 0 ? 0 : 20 + rows * (badgeHeight(o) + 4);

/** Groups pointers by slot, sorted by name so stacking is deterministic. */
export function groupPointers<S>(
  entries: Iterable<readonly [string, S]>,
): Map<S, string[]> {
  const bySlot = new Map<S, string[]>();
  const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [pointer, slot] of sorted)
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), pointer]);
  return bySlot;
}

/** Most pointers that share one slot. */
export const pointerRows = <S>(
  entries: Iterable<readonly [string, S]>,
): number =>
  Math.max(
    0,
    ...[...groupPointers(entries).values()].map((names) => names.length),
  );

/**
 * Pointer badges below a row: an arrow up to the slot, then the names
 * stacked below it; only the first name at a slot has the arrow.
 */
export function pointerItems<S>(
  name: string,
  bySlot: ReadonlyMap<S, readonly string[]>,
  centerX: (slot: S) => number,
  rowBottom: number,
  o: LayoutOptions,
): SceneItem[] {
  const items: SceneItem[] = [];
  const height = badgeHeight(o);
  for (const [slot, names] of bySlot) {
    const x = centerX(slot);
    names.forEach((pointer, depth) => {
      if (depth === 0)
        items.push({
          type: 'arrow',
          key: `${name}/pointer-arrow/${pointer}`,
          x1: x,
          y1: rowBottom + 18,
          x2: x,
          y2: rowBottom + 4,
          role: 'pointer',
        });
      items.push({
        type: 'badge',
        key: `${name}/pointer/${pointer}`,
        x,
        y: rowBottom + 20 + depth * (height + 4) + height / 2,
        width: badgeWidthFor(textWidth(pointer, o.fonts.value), o),
        height,
        role: 'pointer',
        text: pointer,
        fontSize: o.pointerFontSize,
      });
    });
  }
  return items;
}
