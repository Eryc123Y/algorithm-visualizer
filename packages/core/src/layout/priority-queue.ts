/**
 * Layout for the `priorityQueue` kind (ADR 0029): the items front first,
 * each a cell with its value and, joined to it, a smaller cell with its key.
 *
 * In a row (the main column, or any narrow figure) the key is under the
 * value and the front is on the left, marked below:
 *
 * ```
 *  Q
 *  ┌───┐┌───┐┌───┐
 *  │ C ││ B ││ E │
 *  │ 2 ││ 7 ││ ∞ │
 *  └───┘└───┘└───┘
 *    ↑
 *   min
 * ```
 *
 * In the side column of a wide figure it is a column, the key right of the
 * value and the front at the top, marked beside it:
 *
 * ```
 *  Q
 *  ┌───┬───┐
 *  │ C │ 2 │ ← min
 *  ├───┼───┤
 *  │ B │ 7 │
 *  └───┴───┘
 * ```
 *
 * Cells are keyed by item id, so an item slides to its new place when its
 * key changes. The block's size depends only on the metrics, so it is the
 * same in every frame.
 */
import type {
  PriorityItem,
  PriorityKey,
  PriorityQueueDecl,
} from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import {
  queueOrder,
  type PriorityOrder,
  type PriorityQueueState,
} from '../kinds/priority-queue.ts';
import {
  badgeOverhang,
  cellWidthFor,
  ceilWidth,
  formatScalar,
  groupPointers,
  maxWidth,
  pointerAreaHeight,
  pointerItems,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LayoutFonts, LayoutOptions } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';

export interface PriorityQueueMetrics {
  /** Most items at any time. */
  readonly slots: number;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  /** Widest key, in em of the value font. */
  readonly keyWidth: number;
}

/** A key as drawn: a null key is ∞ in a min-queue and −∞ in a max-queue. */
export const formatKey = (key: PriorityKey, order: PriorityOrder): string =>
  key === null ? (order === 'min' ? '∞' : '−∞') : formatScalar(key);

/** The label that marks the front. */
const frontLabel = (order: PriorityOrder) => order;

export const measurePriorityQueue = (
  s: PriorityQueueState,
  _decl: PriorityQueueDecl,
  fonts: LayoutFonts,
): PriorityQueueMetrics => ({
  slots: s.data.items.length,
  valueWidth: maxWidth(
    s.data.items.map((item) => formatScalar(item.value)),
    fonts.value,
  ),
  keyWidth: maxWidth(
    s.data.items.map((item) => formatKey(item.key, s.data.order)),
    fonts.value,
  ),
});

export const mergePriorityQueueMetrics = (
  a: PriorityQueueMetrics,
  b: PriorityQueueMetrics,
): PriorityQueueMetrics => ({
  slots: Math.max(a.slots, b.slots),
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  keyWidth: Math.max(a.keyWidth, b.keyWidth),
});

/** Keys are set smaller than values, as a subscript to them. */
const keyFontSize = (o: LayoutOptions) => Math.round(o.valueFontSize * 0.7);
const KEY_PADDING = 10;
/** Space between the rows of a column. */
const ROW_GAP = 4;
/** Room right of a column for the arrow and label that mark the front. */
const MARKER_ARROW = 26;

const keyCellWidth = (em: number, o: LayoutOptions): number =>
  ceilWidth(em * keyFontSize(o) + 2 * KEY_PADDING);

/** One item's value cell and key cell. */
function itemCells(
  name: string,
  item: PriorityItem,
  key: string,
  role: ElementRole,
  value: { x: number; y: number; width: number; height: number },
  cell: { x: number; y: number; width: number; height: number },
  o: LayoutOptions,
): SceneItem[] {
  return [
    {
      type: 'box',
      key: `${name}/element/${item.id}`,
      ...value,
      role,
      text: formatScalar(item.value),
      fontSize: o.valueFontSize,
    },
    {
      type: 'box',
      key: `${name}/key/${item.id}`,
      ...cell,
      role,
      text: key,
      fontSize: keyFontSize(o),
    },
  ];
}

const emptyLabel = (name: string, x: number, y: number, o: LayoutOptions) => ({
  type: 'text' as const,
  key: `${name}/empty`,
  x,
  y,
  anchor: 'start' as const,
  role: 'label' as const,
  text: '(empty)',
  fontSize: o.indexFontSize,
});

export function layoutPriorityQueue(
  input: LayoutInput<
    PriorityQueueDecl,
    PriorityQueueState,
    PriorityQueueMetrics
  >,
): Block {
  return input.region === 'side' ? layoutColumn(input) : layoutRow(input);
}

function layoutRow({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<
  PriorityQueueDecl,
  PriorityQueueState,
  PriorityQueueMetrics
>): Block {
  const { order } = state.data;
  const width = Math.max(
    cellWidthFor(metrics.valueWidth, o),
    keyCellWidth(metrics.keyWidth, o),
  );
  const keyHeight = Math.round(o.cellHeight * 0.6);
  const pitch = width + o.cellGap;
  const label = frontLabel(order);
  const overhang = badgeOverhang(maxWidth([label], o.fonts.value), width, o);
  const left = origin.x + overhang;
  const top = origin.y + titleRowHeight(o);
  const bottom = top + o.cellHeight + keyHeight;
  const slots = Math.max(1, metrics.slots);

  const items: SceneItem[] = titleItems(name, title, origin, o);
  const front = queueOrder(state.data);
  front.forEach((item, k) => {
    const x = left + k * pitch;
    items.push(
      ...itemCells(
        name,
        item,
        formatKey(item.key, order),
        state.marks.highlight.includes(item.id) ? 'highlight' : 'default',
        { x, y: top, width, height: o.cellHeight },
        { x, y: top + o.cellHeight, width, height: keyHeight },
        o,
      ),
    );
  });
  if (front.length === 0)
    items.push(emptyLabel(name, left, top + o.cellHeight / 2, o));
  else
    items.push(
      ...pointerItems(
        name,
        groupPointers([[label, 0]]),
        () => left + width / 2,
        bottom,
        o,
      ),
    );

  return {
    items,
    width: Math.max(
      2 * overhang + slots * pitch - o.cellGap,
      titleWidth(title, o),
    ),
    height: bottom - origin.y + pointerAreaHeight(1, o),
  };
}

function layoutColumn({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<
  PriorityQueueDecl,
  PriorityQueueState,
  PriorityQueueMetrics
>): Block {
  const { order } = state.data;
  const valueWidth = cellWidthFor(metrics.valueWidth, o);
  const keyWidth = Math.max(
    keyCellWidth(metrics.keyWidth, o),
    Math.round(valueWidth * 0.75),
  );
  const height = Math.round(o.cellHeight * 0.77);
  const left = origin.x;
  const top = origin.y + titleRowHeight(o);
  const right = left + valueWidth + keyWidth;
  const slots = Math.max(1, metrics.slots);
  const label = frontLabel(order);

  const items: SceneItem[] = titleItems(name, title, origin, o);
  const front = queueOrder(state.data);
  front.forEach((item, k) => {
    const y = top + k * (height + ROW_GAP);
    items.push(
      ...itemCells(
        name,
        item,
        formatKey(item.key, order),
        state.marks.highlight.includes(item.id) ? 'highlight' : 'default',
        { x: left, y, width: valueWidth, height },
        { x: left + valueWidth, y, width: keyWidth, height },
        o,
      ),
    );
  });
  if (front.length === 0)
    items.push(emptyLabel(name, left, top + height / 2, o));
  else {
    const y = top + height / 2;
    items.push(
      {
        type: 'arrow',
        key: `${name}/front-arrow`,
        x1: right + MARKER_ARROW,
        y1: y,
        x2: right + 6,
        y2: y,
        role: 'pointer',
      },
      {
        type: 'text',
        key: `${name}/front`,
        x: right + MARKER_ARROW + 4,
        y,
        anchor: 'start',
        role: 'label',
        text: label,
        fontSize: o.pointerFontSize,
      },
    );
  }

  const labelWidth = ceilWidth(
    MARKER_ARROW + 4 + maxWidth([label], o.fonts.label) * o.pointerFontSize,
  );
  return {
    items,
    width: Math.max(right - left + labelWidth, titleWidth(title, o)),
    height: top - origin.y + slots * (height + ROW_GAP) - ROW_GAP,
  };
}
