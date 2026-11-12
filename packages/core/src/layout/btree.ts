/**
 * Layout for the `btree` kind (ADR 0035): each node a row of key cells,
 * child edges from the gaps between keys, a subtree as wide as its node
 * or its children side by side, whichever is wider, and each node centred
 * over its children.
 *
 * ```
 *               ┌───┬───┐
 *               │ G │ M │
 *               └───┴───┘
 *              ╱    │    ╲
 *    ┌───┬───┐ ┌───┬───┐ ┌───┬───┐
 *    │ A │ C │ │ H │ K │ │ N │ R │
 *    └───┴───┘ └───┴───┘ └───┴───┘
 * ```
 *
 * Cells are keyed by key id, so a key slides between nodes; a node with
 * no keys is one empty cell. Pointers sit left of their node, notes right.
 */
import type { BTreeDecl } from '@algomotion/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { BTreeNodeState, BTreeState } from '../kinds/btree.ts';
import {
  cellWidthFor,
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
import { sidePointerItems, sidePointerWidth } from './node-tree.ts';
import type { LayoutFonts } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';

/** Room between neighbouring subtrees, and between levels. */
const NODE_GAP = 24;
const LEVEL_GAP = 44;
/** Room between a node and its note. */
const NOTE_GAP = 6;

export interface BTreeMetrics {
  /** Widest key, in em of the value font. */
  readonly valueWidth: number;
  readonly levels: number;
  /**
   * The widest frame is at most `cells` cell widths plus `gaps` gaps: an
   * upper bound that holds for any cell width and gap.
   */
  readonly cells: number;
  readonly gaps: number;
  readonly pointerRows: number;
  readonly pointerWidth: number;
  /** Widest note, in em of the value font; 0 without notes. */
  readonly noteWidth: number;
}

const byIdOf = (s: BTreeState) => new Map(s.data.nodes.map((n) => [n.id, n]));

/** Cells a node takes: its keys, or one empty cell. */
const cellsOf = (n: BTreeNodeState) => Math.max(1, n.keys.length);

export function measureBTree(
  s: BTreeState,
  _decl: BTreeDecl,
  fonts: LayoutFonts,
): BTreeMetrics {
  const byId = byIdOf(s);
  let levels = 0;
  const bound = (
    id: string,
    depth: number,
  ): { cells: number; gaps: number } => {
    levels = Math.max(levels, depth + 1);
    const n = byId.get(id)!;
    if (n.children.length === 0) return { cells: cellsOf(n), gaps: 0 };
    const below = n.children.map((c) => bound(c, depth + 1));
    return {
      cells: Math.max(
        cellsOf(n),
        below.reduce((sum, b) => sum + b.cells, 0),
      ),
      gaps: below.reduce((sum, b) => sum + b.gaps, 0) + n.children.length - 1,
    };
  };
  const { cells, gaps } = bound(s.data.root, 0);
  return {
    valueWidth: maxWidth(
      s.data.nodes.flatMap((n) => n.keys.map((k) => formatScalar(k.value))),
      fonts.value,
    ),
    levels,
    cells,
    gaps,
    pointerRows: pointerRows(Object.entries(s.marks.pointers)),
    pointerWidth: maxWidth(Object.keys(s.marks.pointers), fonts.value),
    noteWidth: maxWidth(Object.values(s.marks.notes), fonts.value),
  };
}

export const mergeBTreeMetrics = (
  a: BTreeMetrics,
  b: BTreeMetrics,
): BTreeMetrics => ({
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  levels: Math.max(a.levels, b.levels),
  cells: Math.max(a.cells, b.cells),
  gaps: Math.max(a.gaps, b.gaps),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
  noteWidth: Math.max(a.noteWidth, b.noteWidth),
});

function roleOf(
  s: BTreeState,
  node: string,
  key: string | undefined,
): ElementRole {
  if (s.marks.nodes.includes(node)) return 'highlight';
  if (key !== undefined && s.marks.keys.includes(key)) return 'highlight';
  if (key !== undefined && s.marks.settled.includes(key)) return 'settled';
  return 'default';
}

export function layoutBTree({
  name,
  title,
  state: s,
  metrics,
  origin,
  options: o,
}: LayoutInput<BTreeDecl, BTreeState, BTreeMetrics>): Block {
  const cellW = cellWidthFor(metrics.valueWidth, o);
  const cellH = Math.round(o.cellHeight * 0.75);
  const pointerWidth = sidePointerWidth(
    metrics.pointerRows,
    metrics.pointerWidth,
    o,
  );
  const noteFont = o.indexFontSize;
  const noteRoom =
    metrics.noteWidth > 0
      ? NOTE_GAP + Math.ceil(metrics.noteWidth * noteFont)
      : 0;
  // Neighbours keep room for one node's note and the next one's badges.
  const gap = NODE_GAP + pointerWidth + noteRoom;
  const pitch = cellH + LEVEL_GAP;
  const left = origin.x + pointerWidth;
  const top = origin.y + titleRowHeight(o);
  const byId = byIdOf(s);

  // Subtree widths, then positions: each node centred over its children.
  const width = new Map<string, number>();
  const widthOf = (id: string): number => {
    const n = byId.get(id)!;
    const self = cellsOf(n) * cellW;
    const kids = n.children.map(widthOf);
    const span =
      kids.reduce((sum, w) => sum + w, 0) + Math.max(0, kids.length - 1) * gap;
    const w = Math.max(self, span);
    width.set(id, w);
    return w;
  };
  widthOf(s.data.root);
  const x = new Map<string, number>();
  const depth = new Map<string, number>();
  const place = (id: string, from: number, d: number) => {
    const n = byId.get(id)!;
    const w = width.get(id)!;
    const self = cellsOf(n) * cellW;
    depth.set(id, d);
    const span =
      n.children.reduce((sum, c) => sum + width.get(c)!, 0) +
      Math.max(0, n.children.length - 1) * gap;
    let at = from + (w - span) / 2;
    for (const c of n.children) {
      place(c, at, d + 1);
      at += width.get(c)! + gap;
    }
    x.set(id, from + (w - self) / 2);
  };
  place(s.data.root, left, 0);

  const items: SceneItem[] = titleItems(name, title, origin, o);
  const yOf = (id: string) => top + depth.get(id)! * pitch;
  // Edges first, from the gap left of each key to the child's middle.
  for (const n of s.data.nodes) {
    n.children.forEach((c, i) => {
      const child = byId.get(c)!;
      const from =
        n.keys.length === 0
          ? x.get(n.id)! + cellW / 2
          : x.get(n.id)! + i * cellW;
      items.push({
        type: 'edge',
        key: `${name}/edge/${c}`,
        x1: from,
        y1: yOf(n.id) + cellH,
        x2: x.get(c)! + (cellsOf(child) * cellW) / 2,
        y2: yOf(c),
        role: 'link',
        directed: false,
        fontSize: o.indexFontSize,
      });
    });
  }
  for (const n of s.data.nodes) {
    const [nx, ny] = [x.get(n.id)!, yOf(n.id)];
    if (n.keys.length === 0)
      items.push({
        type: 'box',
        key: `${name}/empty/${n.id}`,
        x: nx,
        y: ny,
        width: cellW,
        height: cellH,
        role: roleOf(s, n.id, undefined),
        text: '',
        fontSize: o.valueFontSize,
      });
    n.keys.forEach((k, i) => {
      const role = roleOf(s, n.id, k.id);
      items.push({
        type: 'box',
        key: `${name}/key/${k.id}`,
        x: nx + i * cellW,
        y: ny,
        width: cellW,
        height: cellH,
        role,
        ...settledUnder(role, s.marks.settled.includes(k.id)),
        text: formatScalar(k.value),
        fontSize: o.valueFontSize,
      });
    });
    const note = own(s.marks.notes, n.id);
    if (note !== undefined)
      items.push({
        type: 'text',
        key: `${name}/note/${n.id}`,
        x: nx + cellsOf(n) * cellW + NOTE_GAP,
        y: ny + cellH / 2,
        anchor: 'start',
        role: 'label',
        text: note,
        fontSize: noteFont,
      });
  }
  for (const [id, names] of groupPointers(Object.entries(s.marks.pointers))) {
    const n = byId.get(id)!;
    const half = (cellsOf(n) * cellW) / 2;
    items.push(
      ...sidePointerItems(
        name,
        names,
        { x: x.get(id)! + half, y: yOf(id) + cellH / 2, halfWidth: half },
        o,
      ),
    );
  }

  const blockWidth = Math.max(
    pointerWidth + metrics.cells * cellW + metrics.gaps * gap + noteRoom,
    titleWidth(title, o),
  );
  const blockHeight =
    titleRowHeight(o) + (Math.max(1, metrics.levels) - 1) * pitch + cellH + 4;
  return { items, width: blockWidth, height: blockHeight };
}
