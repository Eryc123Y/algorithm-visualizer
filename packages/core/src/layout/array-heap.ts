/**
 * The heap view of the `array` kind (`view: "tree"`): position `i` is drawn
 * as a node of a complete binary tree with children `2i + 1` and `2i + 2`.
 *
 * ```
 *  H
 *            (9)
 *             0
 *        ╱       ╲
 *      (7)       (8)
 *       1         2
 * ```
 *
 * Nodes are keyed by element id like the cells of the row view, so a swap
 * animates as two nodes trading places; edges are keyed by position, since
 * they belong to the shape, not to the values.
 */
import type { ArrayDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { ArrayState } from '../kinds/array.ts';
import type { ArrayMetrics } from './array.ts';
import {
  formatScalar,
  groupPointers,
  settledUnder,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import {
  NODE_GAP_X,
  NODE_GAP_Y,
  nodeShape,
  placeForest,
  sidePointerItems,
  sidePointerWidth,
  treeEdge,
} from './node-tree.ts';
import { labelHalfWidth, type LabelBox } from './edge-label.ts';
import { NOTE_GAP, clearestAngle, noteBox } from './notes.ts';
import type { ElementRole, SceneItem } from './scene.ts';

/** Where a position's index goes: above, above left, above right. */
const INDEX_ANGLES: readonly number[] = [0, 315, 45];

function roleOf(state: ArrayState, index: number, id: string): ElementRole {
  const { compare, swapped, highlight, settled } = state.marks;
  if (compare !== null && compare.includes(index)) return 'compare';
  if (swapped !== null && swapped.includes(index)) return 'swap';
  if (highlight.includes(index)) return 'highlight';
  if (settled.includes(id)) return 'settled';
  return 'default';
}

export function layoutArrayHeap({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<ArrayDecl, ArrayState, ArrayMetrics>): Block {
  const shape = nodeShape(metrics.valueWidth, o);
  const { radius, halfWidth } = shape;
  const pointerWidth = sidePointerWidth(
    metrics.pointerRows,
    metrics.pointerWidth,
    o,
  );
  const pitchX = 2 * halfWidth + NODE_GAP_X;
  const pitchY = 2 * radius + NODE_GAP_Y;
  // Indices go above their nodes, as CLRS numbers heaps (ADR 0031): the
  // root's needs room above it.
  const indexRoom = o.showIndices ? NOTE_GAP + o.indexFontSize + 2 : 4;
  const left = origin.x + pointerWidth;
  const top = origin.y + titleRowHeight(o) + indexRoom;

  // Place every position the trace ever uses, so the shape stays put while
  // the heap grows and shrinks.
  const slots = Math.max(1, metrics.slots);
  const { column, depth, columns, levels } = placeForest(
    ['0'],
    (id) => {
      const i = Number(id);
      return [2 * i + 1, 2 * i + 2].map((c) => (c < slots ? String(c) : null));
    },
    true,
  );
  const centre = (index: number) => ({
    x: left + halfWidth + column.get(String(index))! * pitchX,
    y: top + radius + depth.get(String(index))! * pitchY,
  });

  const items: SceneItem[] = titleItems(name, title, origin, o);
  if (state.data.length === 0)
    items.push({
      type: 'text',
      key: `${name}/empty`,
      x: left,
      y: top + radius,
      anchor: 'start',
      role: 'label',
      text: '(empty)',
      fontSize: o.indexFontSize,
    });
  // A settled element is out of the heap (ADR 0031): no edge links it.
  const settled = (i: number) =>
    state.marks.settled.includes(state.data[i]!.id);
  for (let i = 1; i < state.data.length; i++)
    if (!settled(i) && !settled((i - 1) >> 1))
      items.push(
        treeEdge(
          `${name}/heap-edge/${i}`,
          centre((i - 1) >> 1),
          centre(i),
          shape,
          o,
        ),
      );
  // Every edge the shape ever has, so an index keeps its place as the
  // heap grows and shrinks.
  const lines = Array.from(
    { length: Math.max(0, slots - 1) },
    (_, k) => [centre(k >> 1), centre(k + 1)] as const,
  );
  const indexBox = (index: number, angle: number) =>
    noteBox(
      { ...centre(index), radius, halfWidth },
      angle,
      labelHalfWidth(String(index), o.indexFontSize, o.fonts.value),
      o.indexFontSize,
    );
  const placed: LabelBox[] = [];
  state.data.forEach((element, index) => {
    const at = centre(index);
    items.push({
      type: 'node',
      key: `${name}/element/${element.id}`,
      ...at,
      radius,
      ...(halfWidth > radius ? { width: 2 * halfWidth } : {}),
      role: roleOf(state, index, element.id),
      ...settledUnder(
        roleOf(state, index, element.id),
        state.marks.settled.includes(element.id),
      ),
      text: formatScalar(element.value),
      fontSize: shape.fontSize,
    });
    if (!o.showIndices) return;
    const angle = clearestAngle(INDEX_ANGLES, (a) => indexBox(index, a), {
      segments: lines,
      discs: Array.from({ length: slots }, (_, k) => k)
        .filter((k) => k !== index)
        .map((k) => ({ ...centre(k), radius: halfWidth })),
      boxes: placed,
    });
    const box = indexBox(index, angle);
    placed.push(box);
    items.push({
      type: 'text',
      key: `${name}/index/${index}`,
      x: box.x,
      y: box.y,
      anchor: 'middle',
      role: 'index',
      text: String(index),
      fontSize: o.indexFontSize,
    });
  });
  for (const [index, names] of groupPointers(
    Object.entries(state.marks.pointers),
  ))
    if (index < slots)
      items.push(
        ...sidePointerItems(name, names, { ...centre(index), halfWidth }, o),
      );

  return {
    items,
    width: Math.max(
      pointerWidth + (columns - 1) * pitchX + 2 * halfWidth + 16,
      titleWidth(title, o),
    ),
    height: top - origin.y + (levels - 1) * pitchY + 2 * radius + 4,
  };
}
