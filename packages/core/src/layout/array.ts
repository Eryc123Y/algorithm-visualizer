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
 *
 * With a pattern (ADR 0037), its indices and its row come between the
 * text and the pointers, shifted so that pattern element 0 sits under
 * text position `shift`; the pointers then point at a column of both.
 */
import type { ArrayDecl } from '@algomotion/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { ArrayPattern, ArrayState } from '../kinds/array.ts';
import { layoutArrayHeap } from './array-heap.ts';
import {
  badgeOverhang,
  cellWidthFor,
  formatScalar,
  groupPointers,
  indexRowHeight,
  maxWidth,
  pointerAreaHeight,
  pointerItems,
  settledUnder,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LayoutFonts, LayoutOptions } from './options.ts';
import type { BoxRole, SceneItem } from './scene.ts';

/** Sizes an array needs; merged over all frames so the layout stays stable. */
export interface ArrayMetrics {
  /** Positions to reserve: elements, plus pointers one past the end. */
  readonly slots: number;
  /** Widest displayed value, in em of the value font. */
  readonly valueWidth: number;
  /** Most pointers sharing one index. */
  readonly pointerRows: number;
  /** Widest pointer name, in em of the value font. */
  readonly pointerWidth: number;
}

export function measureArray(
  state: ArrayState,
  _decl: ArrayDecl,
  fonts: LayoutFonts,
): ArrayMetrics {
  const perIndex = new Map<number, number>();
  for (const index of Object.values(state.marks.pointers))
    perIndex.set(index, (perIndex.get(index) ?? 0) + 1);
  const pattern = state.pattern;
  return {
    slots: Math.max(
      state.data.length,
      pattern === undefined ? 0 : pattern.shift + pattern.elements.length,
      ...[...perIndex.keys()].map((i) => i + 1),
    ),
    valueWidth: maxWidth(
      [...state.data, ...(pattern?.elements ?? [])].map((e) =>
        formatScalar(e.value),
      ),
      fonts.value,
    ),
    pointerRows: Math.max(0, ...perIndex.values()),
    pointerWidth: maxWidth(Object.keys(state.marks.pointers), fonts.value),
  };
}

export const mergeArrayMetrics = (
  a: ArrayMetrics,
  b: ArrayMetrics,
): ArrayMetrics => ({
  slots: Math.max(a.slots, b.slots),
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
});

function roleOf(state: ArrayState, index: number, id: string): BoxRole {
  const { compare, swapped, highlight, settled } = state.marks;
  const p = state.pattern;
  // A text cell over the compared or a matched pattern element.
  const under = (j: number) => p !== undefined && p.shift + j === index;
  if (compare !== null && compare.includes(index)) return 'compare';
  if (p?.compared != null && under(p.compared)) return 'compare';
  if (swapped !== null && swapped.includes(index)) return 'swap';
  if (highlight.includes(index)) return 'highlight';
  if (p?.matched.some(under) === true) return 'highlight';
  if (settled.includes(id)) return 'settled';
  return 'default';
}

/** Space between the text row and the pattern's index row. */
const PATTERN_GAP = 6;

/** The pattern's index labels and cells, starting at `top`. */
function patternItems(
  name: string,
  p: ArrayPattern,
  left: (column: number) => number,
  cellWidth: number,
  top: number,
  o: LayoutOptions,
): SceneItem[] {
  const indexRow = indexRowHeight(o);
  const cellsTop = top + indexRow;
  return p.elements.flatMap((e, j): SceneItem[] => {
    const x = left(p.shift + j);
    const role: BoxRole =
      p.compared === j
        ? 'compare'
        : p.matched.includes(j)
          ? 'highlight'
          : 'default';
    const cell: SceneItem = {
      type: 'box',
      key: `${name}/pattern/${e.id}`,
      x,
      y: cellsTop,
      width: cellWidth,
      height: o.cellHeight,
      role,
      text: formatScalar(e.value),
      fontSize: o.valueFontSize,
    };
    if (!o.showIndices) return [cell];
    return [
      {
        type: 'text',
        key: `${name}/pattern-index/${j}`,
        x: x + cellWidth / 2,
        y: top + indexRow / 2,
        anchor: 'middle',
        role: 'index',
        text: String(j),
        fontSize: o.indexFontSize,
      },
      cell,
    ];
  });
}

/** Height of the pattern's rows under the text, if it has a pattern. */
const patternHeight = (decl: ArrayDecl, o: LayoutOptions) =>
  decl.pattern === undefined
    ? 0
    : PATTERN_GAP + indexRowHeight(o) + o.cellHeight;

export function layoutArray(
  input: LayoutInput<ArrayDecl, ArrayState, ArrayMetrics>,
): Block {
  switch (input.decl.view) {
    case 'tree':
      return layoutArrayHeap(input);
    case 'heap':
      return layoutHeapView(input);
    default:
      return layoutArrayRow(input);
  }
}

/** Space between the tree and the row of the heap view. */
const HEAP_ROW_GAP = 12;

/**
 * The heap view (ADR 0029): the tree with the row under it, from the one
 * state, so marks and pointers show in both. The structure has one title;
 * row items are keyed under `name/row/` so that both views animate.
 * The narrower view is centred under or over the wider one.
 */
function layoutHeapView(
  input: LayoutInput<ArrayDecl, ArrayState, ArrayMetrics>,
): Block {
  const { name, title, origin, options: o } = input;
  const untitled = { ...o, showTitles: false };
  const top = origin.y + titleRowHeight(o);
  const treeAt = (x: number) =>
    layoutArrayHeap({ ...input, origin: { x, y: top }, options: untitled });
  const rowAt = (x: number, y: number) =>
    layoutArrayRow({
      ...input,
      name: `${name}/row`,
      origin: { x, y },
      options: untitled,
    });
  const tree = treeAt(origin.x);
  const row = rowAt(origin.x, top);
  const width = Math.max(tree.width, row.width, titleWidth(title, o));
  const shift = (w: number) => origin.x + Math.round((width - w) / 2);
  const placedTree = tree.width < width ? treeAt(shift(tree.width)) : tree;
  const rowTop = top + tree.height + HEAP_ROW_GAP;
  const placedRow = rowAt(shift(row.width), rowTop);
  const items = titleItems(name, title, origin, o);
  for (const item of placedTree.items) items.push(item);
  for (const item of placedRow.items) items.push(item);
  return {
    items,
    width,
    height: rowTop + row.height - origin.y,
    ...(row.reserved === undefined ? {} : { reserved: row.reserved }),
  };
}

/** The row view: cells left to right, indices above, pointers below. */
function layoutArrayRow(
  input: LayoutInput<ArrayDecl, ArrayState, ArrayMetrics>,
): Block {
  const { name, title, state, metrics, origin, options: o } = input;
  const cellWidth = cellWidthFor(metrics.valueWidth, o);
  const pitch = cellWidth + o.cellGap;
  // Pointer badges are centred under cells and may be wider than a cell, so
  // reserve room for the widest one on both sides of the cell row.
  const overhang = badgeOverhang(metrics.pointerWidth, cellWidth, o);
  const cellsLeft = origin.x + overhang;
  const centerX = (index: number) => cellsLeft + index * pitch + cellWidth / 2;

  const titleRow = titleRowHeight(o);
  const indexRow = indexRowHeight(o);
  const cellsTop = origin.y + titleRow + indexRow;
  const textBottom = cellsTop + o.cellHeight;
  const below = patternHeight(input.decl, o);
  // Pointers go under the pattern, if there is one.
  const cellsBottom = textBottom + below;

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
      ...settledUnder(
        roleOf(state, index, element.id),
        state.marks.settled.includes(element.id),
      ),
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
  });
  if (state.pattern !== undefined)
    items.push(
      ...patternItems(
        name,
        state.pattern,
        (column) => cellsLeft + column * pitch,
        cellWidth,
        textBottom + PATTERN_GAP,
        o,
      ),
    );
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
  // The band below the cells is open only over the frames with pointers.
  const band = pointerAreaHeight(metrics.pointerRows, o);
  const open = input.pointersShown !== false;
  return {
    items,
    width: Math.max(cellsWidth + 2 * overhang, titleWidth(title, o)),
    height: titleRow + indexRow + o.cellHeight + below + (open ? band : 0),
    ...(open || band === 0 ? {} : { reserved: band }),
  };
}
