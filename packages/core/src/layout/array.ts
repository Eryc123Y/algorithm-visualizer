/**
 * Layout for the `array` kind.
 *
 * ```
 *  A                          ← title
 *    0      1      2      3   ← indices
 *  ╭────╮ ╭────╮ ╭────╮ ╭────╮
 *  │ 5  │ │ 3  │ │ 8  │ │ 1  │ ← cells, keyed by element id
 *  ╰────╯ ╰────╯ ╰────╯ ╰────╯
 *    ↑             ↑
 *   (i)           (j)          ← pointer badges; several at one index stack
 *   (lo)                         below the first, which alone has the arrow
 * ```
 */
import type { Scalar } from '@algoviz/spec';

import type { ArrayState } from '../kinds/array.ts';
import type { LayoutOptions } from './options.ts';
import type { BoxRole, SceneItem } from './scene.ts';

/** Sizes an array needs; merged over all frames so the layout stays stable. */
export interface ArrayMetrics {
  /** Positions to reserve: elements, plus pointers one past the end. */
  readonly slots: number;
  /** Longest displayed value, in characters. */
  readonly maxChars: number;
  /** Most pointers sharing one index. */
  readonly pointerRows: number;
}

/** Text shown for a value: ECMAScript `String()` conversion. */
export const formatScalar = (value: Scalar): string => String(value);

export function measureArray(state: ArrayState): ArrayMetrics {
  const perIndex = new Map<number, number>();
  for (const index of Object.values(state.marks.pointers))
    perIndex.set(index, (perIndex.get(index) ?? 0) + 1);
  return {
    slots: Math.max(
      state.data.length,
      ...[...perIndex.keys()].map((i) => i + 1),
    ),
    maxChars: Math.max(
      0,
      ...state.data.map((e) => [...formatScalar(e.value)].length),
    ),
    pointerRows: Math.max(0, ...perIndex.values()),
  };
}

export const mergeArrayMetrics = (
  a: ArrayMetrics,
  b: ArrayMetrics,
): ArrayMetrics => ({
  slots: Math.max(a.slots, b.slots),
  maxChars: Math.max(a.maxChars, b.maxChars),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
});

function roleOf(state: ArrayState, index: number, id: string): BoxRole {
  const { compare, swapped, highlight, settled } = state.marks;
  if (compare !== null && compare.includes(index)) return 'compare';
  if (swapped !== null && swapped.includes(index)) return 'swap';
  if (highlight.includes(index)) return 'highlight';
  if (settled.includes(id)) return 'settled';
  return 'default';
}

export interface Block {
  readonly items: readonly SceneItem[];
  readonly width: number;
  readonly height: number;
}

export function layoutArray(
  name: string,
  title: string,
  state: ArrayState,
  metrics: ArrayMetrics,
  origin: { readonly x: number; readonly y: number },
  o: LayoutOptions,
): Block {
  const cellWidth = Math.max(
    o.minCellWidth,
    Math.ceil(
      metrics.maxChars * o.valueFontSize * o.charWidthRatio + 2 * o.cellPadding,
    ),
  );
  const pitch = cellWidth + o.cellGap;
  const centerX = (index: number) => origin.x + index * pitch + cellWidth / 2;

  const titleRow = o.showTitles ? o.titleFontSize + 11 : 0;
  const indexRow = o.showIndices ? o.indexFontSize + 8 : 0;
  const cellsTop = origin.y + titleRow + indexRow;
  const cellsBottom = cellsTop + o.cellHeight;
  // Pointer area: a 14-unit arrow, then badges stacked every `badgePitch`.
  const badgeHeight = o.pointerFontSize + 8;
  const badgePitch = badgeHeight + 4;
  const badgeTop = cellsBottom + 20;
  const pointerArea =
    metrics.pointerRows === 0 ? 0 : 20 + metrics.pointerRows * badgePitch;

  const items: SceneItem[] = [];
  if (o.showTitles) {
    items.push({
      type: 'text',
      key: `${name}/title`,
      x: origin.x,
      y: origin.y + titleRow / 2,
      anchor: 'start',
      role: 'title',
      text: title,
      fontSize: o.titleFontSize,
    });
  }

  state.data.forEach((element, index) => {
    if (o.showIndices) {
      items.push({
        type: 'text',
        key: `${name}/index/${index}`,
        x: centerX(index),
        y: origin.y + titleRow + indexRow / 2,
        anchor: 'middle',
        role: 'index',
        text: String(index),
        fontSize: o.indexFontSize,
      });
    }
    items.push({
      type: 'box',
      key: `${name}/element/${element.id}`,
      x: origin.x + index * pitch,
      y: cellsTop,
      width: cellWidth,
      height: o.cellHeight,
      role: roleOf(state, index, element.id),
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
  });

  // Group pointers by index, sorted by name so stacking is deterministic.
  const byIndex = new Map<number, string[]>();
  for (const [pointer, index] of Object.entries(state.marks.pointers).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  ))
    byIndex.set(index, [...(byIndex.get(index) ?? []), pointer]);

  for (const [index, names] of byIndex) {
    const x = centerX(index);
    names.forEach((pointer, depth) => {
      if (depth === 0) {
        items.push({
          type: 'arrow',
          key: `${name}/pointer-arrow/${pointer}`,
          x1: x,
          y1: cellsBottom + 18,
          x2: x,
          y2: cellsBottom + 4,
          role: 'pointer',
        });
      }
      items.push({
        type: 'badge',
        key: `${name}/pointer/${pointer}`,
        x,
        y: badgeTop + depth * badgePitch + badgeHeight / 2,
        width: Math.max(
          badgeHeight,
          Math.ceil(
            [...pointer].length * o.pointerFontSize * o.charWidthRatio + 12,
          ),
        ),
        height: badgeHeight,
        role: 'pointer',
        text: pointer,
        fontSize: o.pointerFontSize,
      });
    });
  }

  return {
    items,
    width: metrics.slots === 0 ? 0 : metrics.slots * pitch - o.cellGap,
    height: titleRow + indexRow + o.cellHeight + pointerArea,
  };
}
