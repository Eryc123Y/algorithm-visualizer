/**
 * Layout for the `linkedList` kind: nodes in a row with pointer arrows.
 *
 * - A `next` link to the node directly right is a straight arrow; with
 *   `prev` links as well, `next` runs above the centre line and `prev`
 *   below it.
 * - A link to the node directly left (as during a reversal) is a straight
 *   arrow leftwards.
 * - Any other link (skipping nodes, or a circular list's last link) is
 *   routed over the row in two segments.
 * - A null `next` is drawn as "∅" at the node's top-right corner (a null
 *   `prev` at its bottom-left), clear of arrows arriving at its sides.
 */
import type { LinkedListDecl } from '@algomotion/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { LinkedListState } from '../kinds/linked-list.ts';
import {
  badgeOverhang,
  cellWidthFor,
  formatScalar,
  groupPointers,
  maxWidth,
  pointerAreaHeight,
  pointerItems,
  pointerRows,
  settledUnder,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LayoutFonts } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';

export interface LinkedListMetrics {
  readonly slots: number;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  readonly pointerRows: number;
  /** Widest pointer name, in em of the value font. */
  readonly pointerWidth: number;
  /**
   * Whether any link ever skips over nodes or points to its own node: both
   * are drawn above the row, which then needs room.
   */
  readonly skips: boolean;
}

const LINK_GAP = 40;
const LIFT = 26;

export function measureLinkedList(
  s: LinkedListState,
  _decl: LinkedListDecl,
  fonts: LayoutFonts,
): LinkedListMetrics {
  const at = new Map(s.data.map((node, k) => [node.id, k]));
  const skips = s.data.some((node, k) =>
    [node.next, node.prev].some((target) => {
      const j = target === null ? undefined : at.get(target);
      // Self-links loop above the node, so they need the room too.
      return j !== undefined && (j === k || Math.abs(j - k) > 1);
    }),
  );
  return {
    slots: s.data.length,
    valueWidth: maxWidth(
      s.data.map((node) => formatScalar(node.value)),
      fonts.value,
    ),
    pointerRows: pointerRows(Object.entries(s.marks.pointers)),
    pointerWidth: maxWidth(Object.keys(s.marks.pointers), fonts.value),
    skips,
  };
}

export const mergeLinkedListMetrics = (
  a: LinkedListMetrics,
  b: LinkedListMetrics,
): LinkedListMetrics => ({
  slots: Math.max(a.slots, b.slots),
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
  skips: a.skips || b.skips,
});

export function layoutLinkedList({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
  pointersShown,
}: LayoutInput<LinkedListDecl, LinkedListState, LinkedListMetrics>): Block {
  const width = cellWidthFor(metrics.valueWidth, o);
  const height = o.cellHeight;
  const pitch = width + LINK_GAP;
  const overhang = Math.max(18, badgeOverhang(metrics.pointerWidth, width, o));
  const left = origin.x + overhang;
  const top = origin.y + titleRowHeight(o) + (metrics.skips ? LIFT + 14 : 0);
  const bottom = top + height;
  const midY = top + height / 2;
  const x = (k: number) => left + k * pitch;
  const at = new Map(state.data.map((node, k) => [node.id, k]));

  const items: SceneItem[] = titleItems(name, title, origin, o);
  const { highlight, visited, settled, pointers } = state.marks;
  const role = (k: number, id: string): ElementRole =>
    highlight.includes(k)
      ? 'highlight'
      : settled.includes(id)
        ? 'settled'
        : visited.includes(id)
          ? 'visited'
          : 'default';

  state.data.forEach((node, k) => {
    items.push({
      type: 'box',
      key: `${name}/element/${node.id}`,
      x: x(k),
      y: top,
      width,
      height,
      role: role(k, node.id),
      ...settledUnder(role(k, node.id), settled.includes(node.id)),
      text: formatScalar(node.value),
      fontSize: o.valueFontSize,
    });
  });

  const offset = state.doubly ? 7 : 0;
  const link = (field: 'next' | 'prev', k: number, target: string | null) => {
    const key = `${name}/${field}/${state.data[k]!.id}`;
    const y = field === 'next' ? midY - offset : midY + offset;
    const outward = field === 'next' ? 1 : -1;
    if (target === null) {
      // In the corner, clear of arrows that arrive at the node's sides.
      items.push({
        type: 'text',
        key: `${key}#null`,
        x: field === 'next' ? x(k) + width + 9 : x(k) - 9,
        y: field === 'next' ? top + 8 : bottom - 8,
        anchor: 'middle',
        role: 'label',
        text: '∅',
        fontSize: o.indexFontSize,
      });
      return;
    }
    const j = at.get(target);
    if (j === undefined) return;
    const edge = (
      suffix: string,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      directed: boolean,
    ): SceneItem => ({
      type: 'edge',
      key: `${key}${suffix}`,
      x1,
      y1,
      x2,
      y2,
      role: 'link',
      directed,
      fontSize: o.indexFontSize,
    });
    if (j === k) {
      items.push(edge('', x(k) + width / 2, top, x(k) + width / 2, top, true));
    } else if (j === k + 1 || j === k - 1) {
      // Leave from the side facing the target.
      const fromX = j > k ? x(k) + width : x(k);
      const toX = j > k ? x(j) : x(j) + width;
      items.push(edge('', fromX, y, toX, y, true));
    } else {
      // Over the row: up from the top of `k`, down onto the top of `j`.
      const lift = field === 'next' ? LIFT : LIFT - 10;
      const fromX = x(k) + width / 2 + (outward * width) / 4;
      const toX = x(j) + width / 2 - (outward * width) / 4;
      const apexX = (fromX + toX) / 2;
      items.push(
        edge('', fromX, top, apexX, top - lift, false),
        edge('#b', apexX, top - lift, toX, top, true),
      );
    }
  };
  state.data.forEach((node, k) => {
    link('next', k, node.next);
    if (state.doubly) link('prev', k, node.prev);
  });

  const bySlot = groupPointers(
    Object.entries(pointers).flatMap(([pointer, id]) => {
      const k = at.get(id);
      return k === undefined ? [] : [[pointer, k] as const];
    }),
  );
  items.push(...pointerItems(name, bySlot, (k) => x(k) + width / 2, bottom, o));

  const slots = Math.max(1, metrics.slots);
  // The band below the nodes is open only over the frames with pointers.
  const band = Math.max(pointerAreaHeight(metrics.pointerRows, o), 8) - 8;
  const open = pointersShown !== false;
  return {
    items,
    width: Math.max(
      slots * pitch - LINK_GAP + 2 * overhang,
      titleWidth(title, o),
    ),
    height: top - origin.y + height + 8 + (open ? band : 0),
    ...(open || band === 0 ? {} : { reserved: band }),
  };
}
