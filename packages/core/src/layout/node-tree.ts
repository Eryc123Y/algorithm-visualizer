/**
 * Geometry shared by layouts that draw node-link trees: the `tree` kind and
 * the heap view of `array`.
 *
 * Binary trees are placed in in-order, one column per node, so a left
 * subtree is always left of its parent and nothing overlaps. Other trees put
 * leaves side by side and centre each parent over its children. Trees of a
 * forest follow each other left to right, half a column apart.
 */
import { textWidth } from '@algoviz/fonts';

import { badgeHeight, badgeWidthFor, ceilWidth } from './common.ts';
import type { LayoutOptions } from './options.ts';
import type { SceneItem } from './scene.ts';

/** Space between neighbouring columns and between levels. */
export const NODE_GAP_X = 16;
export const NODE_GAP_Y = 40;
/** Room above a node for its annotation. */
export const NOTE_HEIGHT = 18;
/** Length of the arrow from a pointer badge to its node. */
export const POINTER_ARROW = 12;

/**
 * Size of a node and of its text. Short values get a circle that fits them;
 * longer ones first shrink the font a little, then stretch the circle into
 * a stadium (`halfWidth > radius`).
 */
export interface NodeShape {
  readonly radius: number;
  /** Half the width; equal to `radius` for a circle. */
  readonly halfWidth: number;
  readonly fontSize: number;
}

const MIN_RADIUS = 20;
const MAX_RADIUS = 26;
const TEXT_INSET = 8;

/** Shape of a node whose widest value is `em` wide in the value font. */
export function nodeShape(em: number, o: LayoutOptions): NodeShape {
  const halfText = (font: number) => (em * font) / 2;
  const natural = ceilWidth(halfText(o.valueFontSize) + TEXT_INSET);
  if (natural <= MAX_RADIUS) {
    const radius = Math.max(MIN_RADIUS, natural);
    return { radius, halfWidth: radius, fontSize: o.valueFontSize };
  }
  const minFont = Math.min(o.valueFontSize, 13);
  const fitted = Math.floor((2 * (MAX_RADIUS - TEXT_INSET)) / em + 1e-9);
  if (fitted >= minFont)
    return { radius: MAX_RADIUS, halfWidth: MAX_RADIUS, fontSize: fitted };
  return {
    radius: MAX_RADIUS,
    halfWidth: ceilWidth(halfText(minFont) + 12),
    fontSize: minFont,
  };
}

/** Font size of notes beside a node: 70% of the value size, at least 10. */
export const noteFontSize = (shape: NodeShape): number =>
  Math.max(10, shape.fontSize * 0.7);

/** Width of a note `em` wide in the value font, beside a node of `shape`. */
export const noteTextWidth = (em: number, shape: NodeShape): number =>
  ceilWidth(em * noteFontSize(shape));

/**
 * Distance from a node's centre to its outline along the unit direction
 * `(ux, uy)`.
 */
export function outlineDistance(
  shape: NodeShape,
  ux: number,
  uy: number,
): number {
  const { radius: r, halfWidth } = shape;
  const straight = halfWidth - r;
  if (straight <= 0 || (ux === 0 && uy === 0)) return r;
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  // Through the flat top or bottom…
  if (ay > 0 && (ax * r) / ay <= straight) return r / ay;
  // …or through an end cap: |t·u − (straight, 0)| = r.
  const b = straight * ax;
  return b + Math.sqrt(b * b - straight * straight + r * r);
}

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
 * Width taken left of a node by `rows` pointer badges side by side, with
 * names at most `pointerEm` wide, and the arrow to the node.
 */
export const sidePointerWidth = (
  rows: number,
  pointerEm: number,
  o: LayoutOptions,
): number =>
  rows === 0
    ? 0
    : POINTER_ARROW + 4 + rows * badgeWidthFor(pointerEm, o) + (rows - 1) * 4;

/**
 * Pointer badges left of a node, joined by an arrow to its left side; only
 * the first (rightmost) badge has the arrow.
 */
export function sidePointerItems(
  name: string,
  pointers: readonly string[],
  /** Centre and half width of the node. */
  at: { readonly x: number; readonly y: number; readonly halfWidth: number },
  o: LayoutOptions,
): SceneItem[] {
  const items: SceneItem[] = [];
  let right = at.x - at.halfWidth - 2 - POINTER_ARROW;
  pointers.forEach((pointer, k) => {
    const width = badgeWidthFor(textWidth(pointer, o.fonts.value), o);
    if (k === 0)
      items.push({
        type: 'arrow',
        key: `${name}/pointer-arrow/${pointer}`,
        x1: right,
        y1: at.y,
        x2: at.x - at.halfWidth - 3,
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

/** A tree edge between two nodes, trimmed to their outlines. */
export function treeEdge(
  key: string,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  shape: NodeShape,
  o: LayoutOptions,
): SceneItem {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const trim = outlineDistance(shape, ux, uy);
  return {
    type: 'edge',
    key,
    x1: from.x + ux * trim,
    y1: from.y + uy * trim,
    x2: to.x - ux * trim,
    y2: to.y - uy * trim,
    role: 'link',
    directed: false,
    fontSize: o.indexFontSize,
  };
}
