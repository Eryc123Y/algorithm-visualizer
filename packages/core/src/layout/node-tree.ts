/**
 * Geometry shared by layouts that draw node-link trees: the `tree` kind and
 * the heap view of `array`.
 *
 * Binary trees are placed in in-order, one column per node, so a left
 * subtree is always left of its parent and nothing overlaps. Other trees put
 * leaves side by side and centre each parent over its children. Trees of a
 * forest follow each other left to right, half a column apart.
 */
import { badgeHeight, badgeWidthFor, chars } from './common.ts';
import type { LayoutOptions } from './options.ts';
import type { SceneItem } from './scene.ts';

/** Space between neighbouring columns and between levels. */
export const NODE_GAP_X = 16;
export const NODE_GAP_Y = 40;
/** Room above a node for its annotation. */
export const NOTE_HEIGHT = 18;
/** Length of the arrow from a pointer badge to its node. */
const POINTER_ARROW = 12;

/** Radius of a node that fits `count` value characters. */
export const nodeRadius = (count: number, o: LayoutOptions): number =>
  Math.max(20, Math.ceil((count * o.valueFontSize * o.charWidthRatio) / 2 + 8));

export interface Placement {
  /** Column of each node; may be fractional for centred parents. */
  readonly column: ReadonlyMap<string, number>;
  readonly depth: ReadonlyMap<string, number>;
  /** Columns spanned, from the first to one past the last. */
  readonly columns: number;
  /** Number of levels. */
  readonly levels: number;
}

export function placeForest(
  roots: readonly string[],
  childrenOf: (id: string) => readonly (string | null)[],
  binary: boolean,
): Placement {
  const column = new Map<string, number>();
  const depth = new Map<string, number>();
  let next = 0;
  let levels = 0;
  // `column.has` guards against cycles, which valid states never contain.
  const inorder = (id: string, d: number): void => {
    if (column.has(id)) return;
    column.set(id, -1);
    const [left = null, right = null] = childrenOf(id);
    if (left !== null) inorder(left, d + 1);
    column.set(id, next++);
    depth.set(id, d);
    levels = Math.max(levels, d + 1);
    if (right !== null) inorder(right, d + 1);
  };
  const centred = (id: string, d: number): number | undefined => {
    if (column.has(id)) return undefined;
    column.set(id, -1);
    const placed = childrenOf(id).flatMap((child) => {
      const c = child === null ? undefined : centred(child, d + 1);
      return c === undefined ? [] : [c];
    });
    const c = placed.length === 0 ? next++ : (placed[0]! + placed.at(-1)!) / 2;
    column.set(id, c);
    depth.set(id, d);
    levels = Math.max(levels, d + 1);
    return c;
  };
  roots.forEach((root, k) => {
    if (k > 0 && next > 0) next += 0.5;
    if (binary) inorder(root, 0);
    else centred(root, 0);
  });
  return { column, depth, columns: next, levels };
}

/**
 * Width taken left of a node by `rows` pointer badges side by side, each
 * at most `maxPointerChars` long, and the arrow to the node.
 */
export const sidePointerWidth = (
  rows: number,
  maxPointerChars: number,
  o: LayoutOptions,
): number =>
  rows === 0
    ? 0
    : POINTER_ARROW +
      4 +
      rows * badgeWidthFor(maxPointerChars, o) +
      (rows - 1) * 4;

/**
 * Pointer badges left of a node, joined by an arrow to its left side; only
 * the first (rightmost) badge has the arrow.
 */
export function sidePointerItems(
  name: string,
  pointers: readonly string[],
  at: { readonly x: number; readonly y: number; readonly radius: number },
  o: LayoutOptions,
): SceneItem[] {
  const items: SceneItem[] = [];
  let right = at.x - at.radius - 2 - POINTER_ARROW;
  pointers.forEach((pointer, k) => {
    const width = badgeWidthFor(chars(pointer), o);
    if (k === 0)
      items.push({
        type: 'arrow',
        key: `${name}/pointer-arrow/${pointer}`,
        x1: right,
        y1: at.y,
        x2: at.x - at.radius - 3,
        y2: at.y,
        role: 'pointer',
      });
    items.push({
      type: 'badge',
      key: `${name}/pointer/${pointer}`,
      x: right - width / 2,
      y: at.y,
      width,
      height: badgeHeight(o),
      role: 'pointer',
      text: pointer,
      fontSize: o.pointerFontSize,
    });
    right -= width + 4;
  });
  return items;
}

/** A tree edge between two node circles, trimmed to their outlines. */
export function treeEdge(
  key: string,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  radius: number,
  o: LayoutOptions,
): SceneItem {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    type: 'edge',
    key,
    x1: from.x + ux * radius,
    y1: from.y + uy * radius,
    x2: to.x - ux * radius,
    y2: to.y - uy * radius,
    role: 'link',
    directed: false,
    fontSize: o.indexFontSize,
  };
}
