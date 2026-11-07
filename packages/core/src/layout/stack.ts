/**
 * Layout for the `stack` kind: cells stacked bottom-up inside a container
 * open at the top, with a "top" marker beside the top element.
 *
 * ```
 *  st
 *  │ ┌───┐ │ ← top
 *  │ │ 7 │ │
 *  │ ├───┤ │
 *  │ │ 3 │ │
 *  └───────┘
 * ```
 */
import type { StackDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { StackState } from '../kinds/stack.ts';
import {
  cellWidthFor,
  formatScalar,
  maxWidth,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LayoutFonts } from './options.ts';
import type { SceneItem } from './scene.ts';

export interface StackMetrics {
  /** Most elements at any time. */
  readonly slots: number;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  /** Whether the stack is ever empty (the label then needs more room). */
  readonly empty: boolean;
}

export const measureStack = (
  s: StackState,
  _decl: StackDecl,
  fonts: LayoutFonts,
): StackMetrics => ({
  slots: s.data.length,
  valueWidth: maxWidth(
    s.data.map((e) => formatScalar(e.value)),
    fonts.value,
  ),
  empty: s.data.length === 0,
});

export const mergeStackMetrics = (
  a: StackMetrics,
  b: StackMetrics,
): StackMetrics => ({
  slots: Math.max(a.slots, b.slots),
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  empty: a.empty || b.empty,
});

/** Space between the cells and the container walls. */
const INSET = 6;
const GAP = 4;
const LABEL_WIDTH = 64;

export function layoutStack({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<StackDecl, StackState, StackMetrics>): Block {
  const cellWidth = cellWidthFor(metrics.valueWidth, o);
  const cellHeight = Math.round(o.cellHeight * 0.77);
  const slots = Math.max(1, metrics.slots);
  const top = origin.y + titleRowHeight(o);
  const innerHeight = slots * (cellHeight + GAP) + GAP;
  const bottom = top + innerHeight + INSET;
  const left = origin.x;
  const right = left + cellWidth + 2 * INSET;

  const items: SceneItem[] = titleItems(name, title, origin, o);
  const wall = (
    id: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): SceneItem => ({
    type: 'edge',
    key: `${name}/wall/${id}`,
    x1,
    y1,
    x2,
    y2,
    role: 'link',
    directed: false,
    fontSize: o.indexFontSize,
  });
  items.push(
    wall('left', left, top, left, bottom),
    wall('bottom', left, bottom, right, bottom),
    wall('right', right, bottom, right, top),
  );

  const cellTop = (k: number) =>
    bottom - INSET - GAP - (k + 1) * cellHeight - k * GAP;
  const n = state.data.length;
  state.data.forEach((element, k) => {
    items.push({
      type: 'box',
      key: `${name}/element/${element.id}`,
      x: left + INSET,
      y: cellTop(k),
      width: cellWidth,
      height: cellHeight,
      role: state.marks.highlight.includes(k) ? 'highlight' : 'default',
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
  });
  const markerY =
    n === 0 ? bottom - INSET - cellHeight / 2 : cellTop(n - 1) + cellHeight / 2;
  items.push(
    {
      type: 'arrow',
      key: `${name}/top-arrow`,
      x1: right + 26,
      y1: markerY,
      x2: right + 6,
      y2: markerY,
      role: 'pointer',
    },
    {
      type: 'text',
      key: `${name}/top`,
      x: right + 30,
      y: markerY,
      anchor: 'start',
      role: 'label',
      text: n === 0 ? 'top (empty)' : 'top',
      fontSize: o.pointerFontSize,
    },
  );

  return {
    items,
    width: Math.max(
      right - left + LABEL_WIDTH + (metrics.empty ? 40 : 0),
      titleWidth(title, o),
    ),
    height: bottom - origin.y,
  };
}
