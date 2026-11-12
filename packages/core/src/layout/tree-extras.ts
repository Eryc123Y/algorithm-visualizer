/**
 * The parts of a tree's drawing that ADR 0034 adds:
 *
 * - NIL leaves that pointers name, as small boxes half a column beside
 *   their parent and one level down;
 * - the links of a root list between consecutive roots, and the link of a
 *   circular one from the last root, over the forest, back to the first;
 * - pointers at the roots of a linked forest, lifted above their root so
 *   they do not sit on the list;
 * - the one label that joins a node's notes.
 *
 * ```
 *   ┌─────────────────────────┐
 *   │  [min]                  │
 *   │    ↓                    │
 *   └─(3)───(7)──────(17)─────┘
 *     ╱ ╲             │
 *  (18) (52)        (30)
 *         ╲
 *        [NIL]
 * ```
 */
import { textWidth } from '@algoviz/fonts';

import {
  isNilSlot,
  type NilSlot,
  type TreeMarks,
  type TreePointerTarget,
} from '../kinds/tree.ts';
import { badgeHeight, badgeWidthFor, ceilWidth, own } from './common.ts';
import { outlineDistance, POINTER_ARROW, type NodeShape } from './node-tree.ts';
import type { LayoutOptions } from './options.ts';
import type { SceneItem } from './scene.ts';

/** The text of a NIL leaf. */
export const NIL_TEXT = 'NIL';

/** Room between the outermost roots and the circular list's link. */
export const WRAP_GAP = 12;
/** Height of the lane the circular list's link runs along. */
export const WRAP_LANE = 14;

/**
 * A NIL slot as a key, `parent/slot`; element ids never hold a `/`, so it
 * cannot be a node's id.
 */
export const nilKey = (nil: NilSlot): string => `${nil.parent}/${nil.slot}`;

/** Where a pointer points, as a key: a node id or a NIL slot's key. */
export const targetKey = (target: TreePointerTarget): string =>
  isNilSlot(target) ? nilKey(target) : target;

/**
 * A node's notes as one label: its plain note, then its named notes in the
 * order their fields were first set, joined by " · "; undefined if none.
 */
export function noteText(marks: TreeMarks, id: string): string | undefined {
  const parts = [
    own(marks.notes, id),
    ...Object.values(own(marks.namedNotes, id) ?? {}),
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** The size of a NIL leaf's box, and the size of its text. */
export interface NilBox {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

export const nilBox = (o: LayoutOptions): NilBox => ({
  width: ceilWidth(textWidth(NIL_TEXT, o.fonts.value) * o.indexFontSize) + 20,
  height: o.indexFontSize + 8,
  fontSize: o.indexFontSize,
});

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A NIL leaf at `at`, and the edge to it from its parent at `from`. */
export function nilItems(
  name: string,
  nil: NilSlot,
  from: Point,
  at: Point,
  shape: NodeShape,
  box: NilBox,
  o: LayoutOptions,
): SceneItem[] {
  const key = nilKey(nil);
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  const start = outlineDistance(shape, ux, uy);
  // Where the line from the parent enters the box.
  const end = Math.min(
    ux === 0 ? Infinity : box.width / 2 / Math.abs(ux),
    uy === 0 ? Infinity : box.height / 2 / Math.abs(uy),
  );
  return [
    {
      type: 'edge',
      key: `${name}/nil-edge/${key}`,
      x1: from.x + ux * start,
      y1: from.y + uy * start,
      x2: at.x - ux * end,
      y2: at.y - uy * end,
      role: 'link',
      directed: false,
      fontSize: o.indexFontSize,
    },
    {
      type: 'box',
      key: `${name}/nil/${key}`,
      x: at.x - box.width / 2,
      y: at.y - box.height / 2,
      width: box.width,
      height: box.height,
      role: 'default',
      text: NIL_TEXT,
      fontSize: box.fontSize,
    },
  ];
}

/** A root's centre and half width. */
export interface RootAt extends Point {
  readonly id: string;
  readonly halfWidth: number;
}

/**
 * The links of a root list: from each root's right side to the next one's
 * left side, and for a circular list from the last root's right side, up
 * to `laneY`, across and down into the first root's left side.
 */
export function rootLinkItems(
  name: string,
  roots: readonly RootAt[],
  list: 'list' | 'circular',
  laneY: number,
  o: LayoutOptions,
): SceneItem[] {
  const link = (
    key: string,
    a: Point,
    b: Point,
    via?: readonly Point[],
  ): SceneItem => ({
    type: 'edge',
    key: `${name}/root-link/${key}`,
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    role: 'link',
    directed: false,
    ...(via === undefined ? {} : { via }),
    fontSize: o.indexFontSize,
  });
  const right = (r: RootAt) => ({ x: r.x + r.halfWidth, y: r.y });
  const left = (r: RootAt) => ({ x: r.x - r.halfWidth, y: r.y });
  const items = roots
    .slice(1)
    .map((next, k) => link(roots[k]!.id, right(roots[k]!), left(next)));
  const [first, last] = [roots[0], roots.at(-1)];
  if (list === 'circular' && first !== undefined && last !== undefined) {
    const out = last.x + last.halfWidth + WRAP_GAP;
    const back = first.x - first.halfWidth - WRAP_GAP;
    items.push(
      link('wrap', right(last), left(first), [
        { x: out, y: last.y },
        { x: out, y: laneY },
        { x: back, y: laneY },
        { x: back, y: first.y },
      ]),
    );
  }
  return items;
}

/** Height above a root taken by `rows` pointer badges stacked upward. */
export const abovePointerHeight = (rows: number, o: LayoutOptions): number =>
  rows === 0 ? 0 : POINTER_ARROW + 2 + rows * (badgeHeight(o) + 4);

/**
 * Pointer badges above a node, stacked upward; only the lowest has the
 * arrow down to the node's top.
 */
export function abovePointerItems(
  name: string,
  pointers: readonly string[],
  at: Point & { readonly radius: number },
  o: LayoutOptions,
): SceneItem[] {
  const height = badgeHeight(o);
  const top = at.y - at.radius;
  let bottom = top - 2 - POINTER_ARROW;
  const items: SceneItem[] = [];
  pointers.forEach((pointer, k) => {
    if (k === 0)
      items.push({
        type: 'arrow',
        key: `${name}/pointer-arrow/${pointer}`,
        x1: at.x,
        y1: bottom,
        x2: at.x,
        y2: top - 3,
        role: 'pointer',
      });
    items.push({
      type: 'badge',
      key: `${name}/pointer/${pointer}`,
      x: at.x,
      y: bottom - height / 2,
      width: badgeWidthFor(textWidth(pointer, o.fonts.value), o),
      height,
      role: 'pointer',
      text: pointer,
      fontSize: o.pointerFontSize,
    });
    bottom -= height + 4;
  });
  return items;
}
