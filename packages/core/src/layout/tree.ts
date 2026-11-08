/**
 * Layout for the `tree` kind: circles joined by straight edges, root at the
 * top (see node-tree.ts for placement).
 *
 * ```
 *  T
 *            (8)
 *          ╱     ╲
 *  [x]→ (3)       (10)
 *         ╲          ╲
 *          (6)        (14)
 * ```
 *
 * Pointer badges sit left of their node; annotations sit above it.
 */
import type { TreeDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { TreeState } from '../kinds/tree.ts';
import {
  formatScalar,
  groupPointers,
  maxWidth,
  own,
  pointerRows,
  settledUnder,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import {
  NODE_GAP_X,
  NODE_GAP_Y,
  NOTE_HEIGHT,
  nodeShape,
  noteFontSize,
  noteTextWidth,
  placeForest,
  sidePointerItems,
  sidePointerWidth,
  treeEdge,
} from './node-tree.ts';
import type { LabelBox } from './edge-label.ts';
import { clearestAngle, noteRegion } from './notes.ts';
import type { LayoutFonts } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';

/** Where a tree's notes go, in order: above, above left, above right. */
const NOTE_ANGLES: readonly number[] = [0, 315, 45];
/** Where else they may go, inside the tree's block: the sides, below. */
const MORE_NOTE_ANGLES: readonly number[] = [90, 270, 180];

export interface TreeMetrics {
  /** Columns the widest frame spans. */
  readonly columns: number;
  readonly levels: number;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  /** Most pointers at one node. */
  readonly pointerRows: number;
  /** Widest pointer name, in em of the value font. */
  readonly pointerWidth: number;
  /** Whether any node is ever annotated (needs room above the root). */
  readonly hasNotes: boolean;
  /** Widest note, in em of the value font. */
  readonly noteWidth: number;
}

const childrenLookup = (state: TreeState) => {
  const byId = new Map(state.data.nodes.map((n) => [n.id, n.children]));
  return (id: string) => byId.get(id) ?? [];
};

export function measureTree(
  state: TreeState,
  _decl: TreeDecl,
  fonts: LayoutFonts,
): TreeMetrics {
  const placement = placeForest(
    state.data.roots,
    childrenLookup(state),
    state.binary,
  );
  return {
    columns: placement.columns,
    levels: placement.levels,
    valueWidth: maxWidth(
      state.data.nodes.map((n) => formatScalar(n.value)),
      fonts.value,
    ),
    pointerRows: pointerRows(Object.entries(state.marks.pointers)),
    pointerWidth: maxWidth(Object.keys(state.marks.pointers), fonts.value),
    hasNotes: Object.keys(state.marks.notes).length > 0,
    noteWidth: maxWidth(Object.values(state.marks.notes), fonts.value),
  };
}

export const mergeTreeMetrics = (
  a: TreeMetrics,
  b: TreeMetrics,
): TreeMetrics => ({
  columns: Math.max(a.columns, b.columns),
  levels: Math.max(a.levels, b.levels),
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
  hasNotes: a.hasNotes || b.hasNotes,
  noteWidth: Math.max(a.noteWidth, b.noteWidth),
});

function roleOf(state: TreeState, id: string): ElementRole {
  const { compare, highlight, settled, visited } = state.marks;
  if (compare?.includes(id)) return 'compare';
  if (highlight.includes(id)) return 'highlight';
  if (settled.includes(id)) return 'settled';
  if (visited.includes(id)) return 'visited';
  return 'default';
}

export function layoutTree({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<TreeDecl, TreeState, TreeMetrics>): Block {
  const shape = nodeShape(metrics.valueWidth, o);
  const { radius, halfWidth } = shape;
  const pointerWidth = sidePointerWidth(
    metrics.pointerRows,
    metrics.pointerWidth,
    o,
  );
  // Siblings share a level, so in non-binary trees each column also makes
  // room for the badges of the node right of it. In-order neighbours of a
  // binary tree are never on the same level.
  const pitchX = 2 * halfWidth + NODE_GAP_X + (state.binary ? 0 : pointerWidth);
  const pitchY = 2 * radius + NODE_GAP_Y;
  // Notes go above nodes, or above left or above right, whichever clears
  // the edges (ADR 0031); the block keeps room for any of them, measured
  // with the widest note of the trace.
  const noteFont = noteFontSize(shape);
  const noteHalf = noteTextWidth(metrics.noteWidth, shape) / 2;
  const noteAt = (x: number, y: number, angle: number) =>
    noteRegion({ x, y, radius, halfWidth }, angle, noteHalf, noteFont);
  const reaches = NOTE_ANGLES.map((angle) => noteAt(0, 0, angle));
  const noteOverhang = metrics.hasNotes
    ? Math.max(
        0,
        Math.ceil(
          Math.max(...reaches.map((b) => b.x + b.halfWidth)) - halfWidth,
        ),
      )
    : 0;
  const noteRoom = metrics.hasNotes
    ? Math.max(
        NOTE_HEIGHT,
        Math.ceil(Math.max(...reaches.map((b) => b.halfHeight - b.y)) - radius),
      )
    : 4;
  const left = origin.x + Math.max(pointerWidth, noteOverhang);
  const top = origin.y + titleRowHeight(o) + noteRoom;
  const { column, depth } = placeForest(
    state.data.roots,
    childrenLookup(state),
    state.binary,
  );
  const centre = (id: string) => ({
    x: left + halfWidth + (column.get(id) ?? 0) * pitchX,
    y: top + radius + (depth.get(id) ?? 0) * pitchY,
  });

  const items: SceneItem[] = titleItems(name, title, origin, o);
  if (state.data.nodes.length === 0)
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

  for (const node of state.data.nodes)
    for (const child of node.children)
      if (child !== null)
        items.push(
          treeEdge(
            `${name}/edge/${child}`,
            centre(node.id),
            centre(child),
            shape,
            o,
          ),
        );

  const { groups, notes, pointers } = state.marks;
  // The direction of each note, in node order, clear of this frame's edges,
  // the other nodes and the notes before it.
  const lines = state.data.nodes.flatMap((node) =>
    node.children.flatMap((child) =>
      child === null ? [] : [[centre(node.id), centre(child)] as const],
    ),
  );
  const placed: LabelBox[] = [];
  const noteAngles = new Map<string, number>();
  const columns = Math.max(1, metrics.columns);
  const levels = Math.max(1, metrics.levels);
  const width = Math.max(
    Math.max(pointerWidth, noteOverhang) +
      (columns - 1) * pitchX +
      2 * halfWidth +
      noteOverhang,
    titleWidth(title, o),
  );
  const height = top - origin.y + (levels - 1) * pitchY + 2 * radius + 4;
  const inside = (b: LabelBox) =>
    b.x - b.halfWidth >= origin.x &&
    b.x + b.halfWidth <= origin.x + width &&
    b.y - b.halfHeight >= origin.y + titleRowHeight(o) &&
    b.y + b.halfHeight <= origin.y + height;
  for (const node of state.data.nodes) {
    if (own(notes, node.id) === undefined) continue;
    const at = centre(node.id);
    const candidates = [
      ...NOTE_ANGLES,
      ...MORE_NOTE_ANGLES.filter((a) => inside(noteAt(at.x, at.y, a))),
    ];
    const angle = clearestAngle(candidates, (a) => noteAt(at.x, at.y, a), {
      segments: lines,
      discs: state.data.nodes.flatMap((n) =>
        n.id === node.id ? [] : [{ ...centre(n.id), radius: halfWidth }],
      ),
      boxes: placed,
    });
    noteAngles.set(node.id, angle);
    placed.push(noteAt(at.x, at.y, angle));
  }
  for (const node of state.data.nodes) {
    const group = own(groups, node.id);
    const note = own(notes, node.id);
    const angle = noteAngles.get(node.id) ?? 0;
    items.push({
      type: 'node',
      key: `${name}/element/${node.id}`,
      ...centre(node.id),
      radius,
      ...(halfWidth > radius ? { width: 2 * halfWidth } : {}),
      role: roleOf(state, node.id),
      ...settledUnder(
        roleOf(state, node.id),
        state.marks.settled.includes(node.id),
      ),
      ...(group === undefined ? {} : { group }),
      ...(node.color === null ? {} : { variant: node.color }),
      text: formatScalar(node.value),
      fontSize: shape.fontSize,
      ...(note === undefined ? {} : { label: note }),
      ...(angle === 0 ? {} : { labelAngle: angle }),
    });
  }

  for (const [id, names] of groupPointers(Object.entries(pointers)))
    items.push(
      ...sidePointerItems(name, names, { ...centre(id), halfWidth }, o),
    );

  return { items, width, height };
}
