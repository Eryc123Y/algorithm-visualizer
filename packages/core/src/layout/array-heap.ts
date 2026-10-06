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
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import {
  NODE_GAP_X,
  NODE_GAP_Y,
  nodeRadius,
  placeForest,
  sidePointerItems,
  sidePointerWidth,
  treeEdge,
} from './node-tree.ts';
import type { ElementRole, SceneItem } from './scene.ts';

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
  const radius = nodeRadius(metrics.maxChars, o);
  const pointerWidth = sidePointerWidth(
    metrics.pointerRows,
    metrics.maxPointerChars,
    o,
  );
  const pitchX = 2 * radius + NODE_GAP_X;
  const pitchY = 2 * radius + NODE_GAP_Y;
  const left = origin.x + pointerWidth;
  const top = origin.y + titleRowHeight(o) + 4;

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
    x: left + radius + column.get(String(index))! * pitchX,
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
  for (let i = 1; i < state.data.length; i++)
    items.push(
      treeEdge(
        `${name}/heap-edge/${i}`,
        centre((i - 1) >> 1),
        centre(i),
        radius,
        o,
      ),
    );
  state.data.forEach((element, index) => {
    const at = centre(index);
    items.push({
      type: 'node',
      key: `${name}/element/${element.id}`,
      ...at,
      radius,
      role: roleOf(state, index, element.id),
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
    if (o.showIndices)
      items.push({
        type: 'text',
        key: `${name}/index/${index}`,
        // Below the node, between the edges to its children.
        x: at.x,
        y: at.y + radius + 9,
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
        ...sidePointerItems(name, names, { ...centre(index), radius }, o),
      );

  return {
    items,
    width: Math.max(
      pointerWidth + (columns - 1) * pitchX + 2 * radius + 16,
      titleWidth(title, o),
    ),
    height: top - origin.y + (levels - 1) * pitchY + 2 * radius + 12,
  };
}
