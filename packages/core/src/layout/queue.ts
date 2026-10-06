/**
 * Layout for the `queue` kind: a row inside an open pipe, with "front" and
 * "back" markers below the ends.
 */
import type { QueueDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { QueueState } from '../kinds/queue.ts';
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
import type { SceneItem } from './scene.ts';

export interface QueueMetrics {
  readonly slots: number;
  readonly maxChars: number;
  /** 2 when front and back ever coincide (one element), else 1 or 0. */
  readonly pointerRows: number;
}

export const measureQueue = (s: QueueState): QueueMetrics => ({
  slots: s.data.length,
  maxChars: maxChars(s.data.map((e) => formatScalar(e.value))),
  pointerRows: s.data.length === 0 ? 0 : s.data.length === 1 ? 2 : 1,
});

export const mergeQueueMetrics = (
  a: QueueMetrics,
  b: QueueMetrics,
): QueueMetrics => ({
  slots: Math.max(a.slots, b.slots),
  maxChars: Math.max(a.maxChars, b.maxChars),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
});

/** Gap between the cells and the pipe walls. */
const PIPE = 6;

export function layoutQueue({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<QueueDecl, QueueState, QueueMetrics>): Block {
  const cellWidth = cellWidthFor(metrics.maxChars, o);
  const pitch = cellWidth + o.cellGap;
  const overhang = Math.max(PIPE * 2, badgeOverhang(5, cellWidth, o));
  const cellsLeft = origin.x + overhang;
  const centerX = (k: number) => cellsLeft + k * pitch + cellWidth / 2;
  const titleRow = titleRowHeight(o);
  const indexRow = indexRowHeight(o);
  const cellsTop = origin.y + titleRow + indexRow + PIPE;
  const cellsBottom = cellsTop + o.cellHeight;
  const slots = Math.max(1, metrics.slots);
  const rowWidth = slots * pitch - o.cellGap;

  const items: SceneItem[] = titleItems(name, title, origin, o);
  for (const [id, y] of [
    ['top', cellsTop - PIPE],
    ['bottom', cellsBottom + PIPE],
  ] as const) {
    items.push({
      type: 'edge',
      key: `${name}/wall/${id}`,
      x1: cellsLeft - PIPE * 2,
      y1: y,
      x2: cellsLeft + rowWidth + PIPE * 2,
      y2: y,
      role: 'link',
      directed: false,
      fontSize: o.indexFontSize,
    });
  }
  const n = state.data.length;
  state.data.forEach((element, k) => {
    if (o.showIndices)
      items.push({
        type: 'text',
        key: `${name}/index/${k}`,
        x: centerX(k),
        y: origin.y + titleRow + indexRow / 2,
        anchor: 'middle',
        role: 'index',
        text: String(k),
        fontSize: o.indexFontSize,
      });
    items.push({
      type: 'box',
      key: `${name}/element/${element.id}`,
      x: cellsLeft + k * pitch,
      y: cellsTop,
      width: cellWidth,
      height: o.cellHeight,
      role: state.marks.highlight.includes(k) ? 'highlight' : 'default',
      text: formatScalar(element.value),
      fontSize: o.valueFontSize,
    });
  });
  if (n > 0) {
    const ends = groupPointers<number>([
      ['front', 0],
      ['back', n - 1],
    ]);
    items.push(...pointerItems(name, ends, centerX, cellsBottom + PIPE, o));
  }

  return {
    items,
    width: Math.max(rowWidth + 2 * overhang, titleWidth(title, o)),
    height:
      titleRow +
      indexRow +
      PIPE +
      o.cellHeight +
      PIPE +
      pointerAreaHeight(metrics.pointerRows, o),
  };
}
