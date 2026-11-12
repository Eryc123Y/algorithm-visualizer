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
 * Pointer badges sit left of their node; notes sit beside it, above where
 * that is clear. NIL leaves, root lists and pointers above linked roots
 * (ADR 0034) are drawn by tree-extras.ts.
 */
import type { TreeDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import { isNilSlot, type NilSlot, type TreeState } from '../kinds/tree.ts';
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
import { separateEdgeLabels, type LabelBox, type Point } from './edge-label.ts';
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
import { clearestAngle, noteRegion } from './notes.ts';
import type { LayoutFonts } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';
import {
  abovePointerHeight,
  abovePointerItems,
  nilBox,
  nilItems,
  nilKey,
  noteText,
  rootLinkItems,
  targetKey,
  WRAP_GAP,
  WRAP_LANE,
} from './tree-extras.ts';

/** Where a tree's notes go, in order: above, above left, above right. */
const NOTE_ANGLES: readonly number[] = [0, 315, 45];
/** Where else they may go, inside the tree's block: the sides, below. */
const MORE_NOTE_ANGLES: readonly number[] = [90, 270, 180];

export interface TreeMetrics {
  /** Columns the widest frame spans, from column 0, NIL leaves included. */
  readonly columns: number;
  /** Levels, NIL leaves included. */
  readonly levels: number;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  /** Most pointers left of one node or NIL leaf. */
  readonly pointerRows: number;
  /** Widest pointer name, in em of the value font. */
  readonly pointerWidth: number;
  /** Whether any node is ever annotated (needs room above the root). */
  readonly hasNotes: boolean;
  /** Widest joined note, in em of the value font. */
  readonly noteWidth: number;
  /** Columns a NIL leaf reaches left of column 0: 0 or 0.5. */
  readonly nilLeft: number;
  /** Most pointers above one root of a linked forest. */
  readonly rootPointerRows: number;
  /** Widest name among them, in em of the value font. */
  readonly rootPointerWidth: number;
  /** Widest edge label, in em of the value font. */
  readonly edgeLabelWidth: number;
  /** Whether any edge is ever labelled, even with an empty label. */
  readonly hasEdgeLabels: boolean;
  /** Whether any pointer ever names a NIL leaf. */
  readonly hasNils: boolean;
}

/** A NIL leaf a pointer names, and where it goes. */
interface NilAt {
  readonly nil: NilSlot;
  readonly column: number;
  readonly depth: number;
}

/** One frame's placement and its pointers by where they are drawn. */
interface Geometry {
  readonly column: ReadonlyMap<string, number>;
  readonly depth: ReadonlyMap<string, number>;
  readonly columns: number;
  readonly levels: number;
  /** NIL leaves by key, in pointer order. */
  readonly nils: ReadonlyMap<string, NilAt>;
  /** Pointers drawn left of a node or NIL leaf, by its key. */
  readonly side: readonly (readonly [string, string])[];
  /** Pointers drawn above a root of a linked forest, by its id. */
  readonly above: readonly (readonly [string, string])[];
}

function geometryOf(state: TreeState, decl: TreeDecl): Geometry {
  const byId = new Map(state.data.nodes.map((n) => [n.id, n.children]));
  const placement = placeForest(
    state.data.roots,
    (id) => byId.get(id) ?? [],
    state.binary,
  );
  const roots = new Set(decl.rootList === undefined ? [] : state.data.roots);
  const nils = new Map<string, NilAt>();
  const side: [string, string][] = [];
  const above: [string, string][] = [];
  let { columns, levels } = placement;
  for (const [name, target] of Object.entries(state.marks.pointers)) {
    if (isNilSlot(target)) {
      const column =
        (placement.column.get(target.parent) ?? 0) +
        (target.slot === 0 ? -0.5 : 0.5);
      const depth = (placement.depth.get(target.parent) ?? 0) + 1;
      nils.set(nilKey(target), { nil: target, column, depth });
      columns = Math.max(columns, column + 1);
      levels = Math.max(levels, depth + 1);
    }
    (roots.has(targetKey(target)) ? above : side).push([
      name,
      targetKey(target),
    ]);
  }
  return {
    column: placement.column,
    depth: placement.depth,
    columns,
    levels,
    nils,
    side,
    above,
  };
}

export function measureTree(
  state: TreeState,
  decl: TreeDecl,
  fonts: LayoutFonts,
): TreeMetrics {
  const g = geometryOf(state, decl);
  const notes = state.data.nodes.flatMap((n) => {
    const text = noteText(state.marks, n.id);
    return text === undefined ? [] : [text];
  });
  return {
    columns: g.columns,
    levels: g.levels,
    valueWidth: maxWidth(
      state.data.nodes.map((n) => formatScalar(n.value)),
      fonts.value,
    ),
    pointerRows: pointerRows(g.side),
    pointerWidth: maxWidth(
      g.side.map(([name]) => name),
      fonts.value,
    ),
    hasNotes: notes.length > 0,
    noteWidth: maxWidth(notes, fonts.value),
    nilLeft: Math.max(0, ...[...g.nils.values()].map((n) => -n.column)),
    rootPointerRows: pointerRows(g.above),
    rootPointerWidth: maxWidth(
      g.above.map(([name]) => name),
      fonts.value,
    ),
    edgeLabelWidth: maxWidth(
      Object.values(state.marks.edgeLabels).map(String),
      fonts.value,
    ),
    hasEdgeLabels: Object.keys(state.marks.edgeLabels).length > 0,
    hasNils: g.nils.size > 0,
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
  nilLeft: Math.max(a.nilLeft, b.nilLeft),
  rootPointerRows: Math.max(a.rootPointerRows, b.rootPointerRows),
  rootPointerWidth: Math.max(a.rootPointerWidth, b.rootPointerWidth),
  edgeLabelWidth: Math.max(a.edgeLabelWidth, b.edgeLabelWidth),
  hasEdgeLabels: a.hasEdgeLabels || b.hasEdgeLabels,
  hasNils: a.hasNils || b.hasNils,
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
  decl,
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
  // binary tree are never on the same level, but a NIL leaf, half a column
  // out, may be 1.5 columns from a node on its level: the columns widen
  // when that is too little for the NIL's badges (ADR 0034).
  const box = nilBox(o);
  const pitchX = state.binary
    ? Math.max(
        2 * halfWidth + NODE_GAP_X,
        metrics.hasNils && pointerWidth > 0
          ? Math.ceil((halfWidth + box.width / 2 + pointerWidth + 4) / 1.5)
          : 0,
      )
    : 2 * halfWidth + NODE_GAP_X + pointerWidth;
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
  // A linked forest: pointers above roots, and the circular link's lane.
  const rootList = decl.rootList;
  const lane = rootList === 'circular' ? WRAP_LANE : 0;
  const wrapMargin = rootList === 'circular' ? WRAP_GAP + 2 : 0;
  const aboveRoom = abovePointerHeight(metrics.rootPointerRows, o);
  const aboveOverhang = Math.max(
    0,
    Math.ceil(
      (metrics.rootPointerWidth * o.pointerFontSize + 12) / 2 - halfWidth,
    ),
  );
  // An edge label sits beside a point of its edge, up to its width plus a
  // gap away on the outer side (edge-label.ts); keep room for it beyond the
  // outermost nodes, above the roots and below the deepest level.
  const labelHalf = (metrics.edgeLabelWidth * o.indexFontSize) / 2;
  const [labelX, labelY] = metrics.hasEdgeLabels
    ? [
        Math.ceil(4 + 2 * labelHalf + o.indexFontSize / 2),
        Math.ceil(4 + labelHalf + o.indexFontSize),
      ]
    : [0, 0];
  const margin = Math.max(
    noteOverhang,
    wrapMargin,
    aboveOverhang,
    labelX - halfWidth,
  );
  const leftMargin = Math.max(pointerWidth, margin);
  const left = origin.x + leftMargin;
  const laneTop = origin.y + titleRowHeight(o);
  const top = laneTop + lane + Math.max(noteRoom, aboveRoom, labelY - radius);
  const g = geometryOf(state, decl);
  const at = (column: number, depth: number) => ({
    x: left + halfWidth + (column + metrics.nilLeft) * pitchX,
    y: top + radius + depth * pitchY,
  });
  const centre = (id: string) =>
    at(g.column.get(id) ?? 0, g.depth.get(id) ?? 0);

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

  const { edgeLabels, edgeMarks } = state.marks;
  for (const node of state.data.nodes)
    node.children.forEach((child, slot) => {
      if (child === null) return;
      const [from, to] = [centre(node.id), centre(child)];
      const edge = treeEdge(`${name}/edge/${child}`, from, to, shape, o);
      const label = own(edgeLabels, child);
      const mark = own(edgeMarks, child);
      // In binary trees labels start on the outer side: on screen, left of
      // a left child's edge, which faces down to the left.
      const outer = slot === 0 ? 'right' : 'left';
      items.push({
        ...edge,
        ...(mark === undefined ? {} : { role: mark }),
        ...(label === undefined
          ? {}
          : {
              label: String(label),
              ...(state.binary ? { labelSide: outer } : {}),
            }),
      } as SceneItem);
    });

  const nilCentre = new Map(
    [...g.nils].map(([key, n]) => [key, at(n.column, n.depth)]),
  );
  for (const [key, n] of g.nils)
    items.push(
      ...nilItems(
        name,
        n.nil,
        centre(n.nil.parent),
        nilCentre.get(key)!,
        shape,
        box,
        o,
      ),
    );

  const rootsAt = state.data.roots.map((id) => ({
    id,
    ...centre(id),
    halfWidth,
  }));
  if (rootList !== undefined)
    items.push(
      ...rootLinkItems(name, rootsAt, rootList, laneTop + lane / 2, o),
    );

  const columns = Math.max(1, metrics.columns + metrics.nilLeft);
  const levels = Math.max(1, metrics.levels);
  const width = Math.max(
    leftMargin + (columns - 1) * pitchX + 2 * halfWidth + margin,
    titleWidth(title, o),
  );
  const height =
    top -
    origin.y +
    (levels - 1) * pitchY +
    2 * radius +
    4 +
    Math.max(0, labelY - 2 * radius - 4);

  // Pointers above roots, placed first so notes keep clear of them.
  const aboveItems = [...groupPointers(g.above)].flatMap(([id, names]) =>
    abovePointerItems(name, names, { ...centre(id), radius }, o),
  );
  const notes = placeNotes();
  for (const node of state.data.nodes) {
    const group = own(state.marks.groups, node.id);
    const note = noteText(state.marks, node.id);
    const angle = notes.get(node.id) ?? 0;
    const role = roleOf(state, node.id);
    items.push({
      type: 'node',
      key: `${name}/element/${node.id}`,
      ...centre(node.id),
      radius,
      ...(halfWidth > radius ? { width: 2 * halfWidth } : {}),
      role,
      ...settledUnder(role, state.marks.settled.includes(node.id)),
      ...(group === undefined ? {} : { group }),
      ...(node.color === null ? {} : { variant: node.color }),
      text: formatScalar(node.value),
      fontSize: shape.fontSize,
      ...(note === undefined ? {} : { label: note }),
      ...(angle === 0 ? {} : { labelAngle: angle }),
    });
  }

  for (const [key, names] of groupPointers(g.side)) {
    const nil = nilCentre.get(key);
    items.push(
      ...sidePointerItems(
        name,
        names,
        nil === undefined
          ? { ...centre(key), halfWidth }
          : { ...nil, halfWidth: box.width / 2 },
        o,
      ),
    );
  }
  items.push(...aboveItems);

  return {
    items: separateEdgeLabels(items, o.fonts.value),
    width,
    height,
  };

  /**
   * The direction of each note, in node order, clear of this frame's
   * lines, the other nodes, NIL leaves, the pointers above roots and the
   * notes before it.
   */
  function placeNotes(): Map<string, number> {
    // Tree edges from centre to centre, as before ADR 0034, and the lines
    // it adds: edges to NIL leaves and the links of a root list.
    const treeLines = state.data.nodes.flatMap((node) =>
      node.children.flatMap((child): [Point, Point][] =>
        child === null ? [] : [[centre(node.id), centre(child)]],
      ),
    );
    const lines = items.flatMap((item): [Point, Point][] => {
      if (item.type !== 'edge' || item.key.startsWith(`${name}/edge/`))
        return [];
      const points = [
        { x: item.x1, y: item.y1 },
        ...(item.via ?? []),
        { x: item.x2, y: item.y2 },
      ];
      return points.slice(1).map((p, k) => [points[k]!, p]);
    });
    const placed: LabelBox[] = [
      ...[...nilCentre.values()].map((c) => ({
        ...c,
        halfWidth: box.width / 2,
        halfHeight: box.height / 2,
      })),
      ...aboveItems.flatMap((i): LabelBox[] =>
        i.type === 'badge'
          ? [
              {
                x: i.x,
                y: i.y,
                halfWidth: i.width / 2,
                halfHeight: i.height / 2,
              },
            ]
          : [],
      ),
    ];
    const inside = (b: LabelBox) =>
      b.x - b.halfWidth >= origin.x &&
      b.x + b.halfWidth <= origin.x + width &&
      b.y - b.halfHeight >= origin.y + titleRowHeight(o) + lane &&
      b.y + b.halfHeight <= origin.y + height;
    const angles = new Map<string, number>();
    for (const node of state.data.nodes) {
      if (noteText(state.marks, node.id) === undefined) continue;
      const c = centre(node.id);
      const candidates = [
        ...NOTE_ANGLES,
        ...MORE_NOTE_ANGLES.filter(
          // The left is the pointer badges' side, as in graphs.
          (a) =>
            !(a === 270 && metrics.pointerRows > 0) &&
            inside(noteAt(c.x, c.y, a)),
        ),
      ];
      const angle = clearestAngle(candidates, (a) => noteAt(c.x, c.y, a), {
        segments: [...treeLines, ...lines],
        discs: state.data.nodes.flatMap((n) =>
          n.id === node.id ? [] : [{ ...centre(n.id), radius: halfWidth }],
        ),
        boxes: placed,
      });
      angles.set(node.id, angle);
      placed.push(noteAt(c.x, c.y, angle));
    }
    return angles;
  }
}
