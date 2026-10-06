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
import type { ArrayDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';

import type { ArrayState } from '../kinds/array.ts';
import {
  badgeOverhang,
  cellWidthFor,
  formatScalar,
  groupPointers,
  indexRowHeight,
  maxChars,
  pointerAreaHeight,
  pointerItems,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { BoxRole, SceneItem } from './scene.ts';

/** Sizes an array needs; merged over all frames so the layout stays stable. */
export interface ArrayMetrics {
  /** Positions to reserve: elements, plus pointers one past the end. */
  readonly slots: number;
  /** Longest displayed value, in characters. */
  readonly maxChars: number;
  /** Most pointers sharing one index. */
  readonly pointerRows: number;
  /** Longest pointer name, in characters. */
  readonly maxPointerChars: number;
}

export function measureArray(state: ArrayState): ArrayMetrics {
  const perIndex = new Map<number, number>();
  for (const index of Object.values(state.marks.pointers))
    perIndex.set(index, (perIndex.get(index) ?? 0) + 1);
  return {
    slots: Math.max(
      state.data.length,
      ...[...perIndex.keys()].map((i) => i + 1),
    ),
    maxChars: maxChars(state.data.map((e) => formatScalar(e.value))),
    pointerRows: Math.max(0, ...perIndex.values()),
    maxPointerChars: maxChars(Object.keys(state.marks.pointers)),
  };
}

export const mergeArrayMetrics = (
  a: ArrayMetrics,
  b: ArrayMetrics,
): ArrayMetrics => ({
  slots: Math.max(a.slots, b.slots),
  maxChars: Math.max(a.maxChars, b.maxChars),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  maxPointerChars: Math.max(a.maxPointerChars, b.maxPointerChars),
});

function roleOf(state: ArrayState, index: number, id: string): BoxRole {
  const { compare, swapped, highlight, settled } = state.marks;
  if (compare !== null && compare.includes(index)) return 'compare';
  if (swapped !== null && swapped.includes(index)) return 'swap';
  if (highlight.includes(index)) return 'highlight';
  if (settled.includes(id)) return 'settled';
  return 'default';
}

export function layoutArray({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<ArrayDecl, ArrayState, ArrayMetrics>): Block {
  const cellWidth = cellWidthFor(metrics.maxChars, o);
  const pitch = cellWidth + o.cellGap;
  // Pointer badges are centred under cells and may be wider than a cell, so
  // reserve room for the widest one on both sides of the cell row.
  const overhang = badgeOverhang(metrics.maxPointerChars, cellWidth, o);
  const cellsLeft = origin.x + overhang;
  const centerX = (index: number) => cellsLeft + index * pitch + cellWidth / 2;

  const titleRow = titleRowHeight(o);
  const indexRow = indexRowHeight(o);
  const cellsTop = origin.y + titleRow + indexRow;
  const cellsBottom = cellsTop + o.cellHeight;

  const items: SceneItem[] = titleItems(name, title, origin, o);
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
      x: cellsLeft + index * pitch,
      y: cellsTop,
      width: cellWidth,
      height: o.cellHeight,
      role: roleOf(state, index, element.id),
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
  });
  items.push(
    ...pointerItems(
      name,
      groupPointers(Object.entries(state.marks.pointers)),
      centerX,
      cellsBottom,
      o,
    ),
  );

  const cellsWidth =
    metrics.slots === 0 ? 0 : metrics.slots * pitch - o.cellGap;
  return {
    items,
    width: Math.max(cellsWidth + 2 * overhang, titleWidth(title, o)),
    height:
      titleRow +
      indexRow +
      o.cellHeight +
      pointerAreaHeight(metrics.pointerRows, o),
  };
}
