/**
 * Layout for the `graph` kind.
 *
 * Positions are computed once per trace from every node and edge that ever
 * exists (collected in the metrics), so nodes never move while edges come
 * and go, and a node added later already has its place (ADR 0013).
 *
 * - circle: nodes clockwise from the top, in order of first appearance.
 * - layered: rows top to bottom. Directed graphs rank each node one below
 *   its lowest predecessor (back edges of cycles are ignored); undirected
 *   graphs rank by breadth-first distance from the first node of each
 *   component. Rows are then ordered by the barycentre heuristic.
 * - grid: rows of ⌈√n⌉ nodes.
 * - manual: each node's x and y.
 *
 * Edges are straight and trimmed to the node circles. Parallel and
 * antiparallel edges are spread apart, with their labels outside the pair;
 * a self-loop sits on top of its node.
 */
import type { GraphDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { GraphEdgeState, GraphState } from '../kinds/graph.ts';
import {
  ceilWidth,
  formatScalar,
  groupPointers,
  maxWidth,
  own,
  pointerRows,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import {
  NOTE_HEIGHT,
  nodeShape,
  noteTextWidth,
  outlineDistance,
  sidePointerItems,
  sidePointerWidth,
} from './node-tree.ts';
import { separateEdgeLabels } from './edge-label.ts';
import type { LayoutFonts } from './options.ts';
import type { EdgeRole, ElementRole, SceneItem } from './scene.ts';

export interface GraphMetrics {
  /** Every node id that ever exists, in order of first appearance. */
  readonly nodes: readonly string[];
  /** Every `[from, to]` pair that is ever joined by an edge. */
  readonly links: readonly (readonly [string, string])[];
  /** Hand placements, from each node's first appearance. */
  readonly positions: Readonly<
    Record<string, { readonly x: number; readonly y: number }>
  >;
  /** Widest value, in em of the value font. */
  readonly valueWidth: number;
  readonly pointerRows: number;
  /** Widest pointer name, in em of the value font. */
  readonly pointerWidth: number;
  readonly hasNotes: boolean;
  /** Widest note, in em of the value font. */
  readonly noteWidth: number;
  readonly hasLoops: boolean;
  readonly hasWeights: boolean;
  /** Widest edge label, in em of the value font. */
  readonly weightWidth: number;
  /** Most edges that ever join the same two nodes (either way). */
  readonly maxParallel: number;
  /** Most self-loops each node ever has (nodes without any are absent). */
  readonly loops: Readonly<Record<string, number>>;
}

const linkKey = (from: string, to: string) => `${from}\u0000${to}`;

export function measureGraph(
  state: GraphState,
  _decl: GraphDecl,
  fonts: LayoutFonts,
): GraphMetrics {
  // Built with fromEntries: assigning to an id such as "__proto__" would
  // change the object's prototype instead.
  const positions = Object.fromEntries(
    state.data.nodes.flatMap((n) =>
      n.x !== undefined && n.y !== undefined
        ? [[n.id, { x: n.x, y: n.y }] as const]
        : [],
    ),
  );
  return {
    nodes: state.data.nodes.map((n) => n.id),
    links: state.data.edges.map((e) => [e.from, e.to] as const),
    positions,
    valueWidth: maxWidth(
      state.data.nodes.map((n) => formatScalar(n.value)),
      fonts.value,
    ),
    pointerRows: pointerRows(Object.entries(state.marks.pointers)),
    pointerWidth: maxWidth(Object.keys(state.marks.pointers), fonts.value),
    hasNotes: Object.keys(state.marks.notes).length > 0,
    noteWidth: maxWidth(Object.values(state.marks.notes), fonts.value),
    hasLoops: state.data.edges.some((e) => e.from === e.to),
    hasWeights: state.data.edges.some((e) => e.weight !== null),
    weightWidth: maxWidth(
      state.data.edges.flatMap((e) =>
        e.weight === null ? [] : [formatScalar(e.weight)],
      ),
      fonts.value,
    ),
    loops: countLoops(state),
    maxParallel: maxParallel(state),
  };
}

function union<T>(
  a: readonly T[],
  b: readonly T[],
  key: (x: T) => string,
): readonly T[] {
  const seen = new Set(a.map(key));
  const extra = b.filter((x) => !seen.has(key(x)) && seen.add(key(x)));
  return extra.length === 0 ? a : [...a, ...extra];
}

export const mergeGraphMetrics = (
  a: GraphMetrics,
  b: GraphMetrics,
): GraphMetrics => ({
  nodes: union(a.nodes, b.nodes, (id) => id),
  links: union(a.links, b.links, ([from, to]) => linkKey(from, to)),
  positions: { ...b.positions, ...a.positions },
  valueWidth: Math.max(a.valueWidth, b.valueWidth),
  pointerRows: Math.max(a.pointerRows, b.pointerRows),
  pointerWidth: Math.max(a.pointerWidth, b.pointerWidth),
  hasNotes: a.hasNotes || b.hasNotes,
  noteWidth: Math.max(a.noteWidth, b.noteWidth),
  hasLoops: a.hasLoops || b.hasLoops,
  hasWeights: a.hasWeights || b.hasWeights,
  weightWidth: Math.max(a.weightWidth, b.weightWidth),
  maxParallel: Math.max(a.maxParallel, b.maxParallel),
  loops: Object.fromEntries(
    [...new Set([...Object.keys(a.loops), ...Object.keys(b.loops)])].map(
      (id) => [id, Math.max(own(a.loops, id) ?? 0, own(b.loops, id) ?? 0)],
    ),
  ),
});

function maxParallel(state: GraphState): number {
  const count = new Map<string, number>();
  for (const { from, to } of state.data.edges)
    if (from !== to) {
      const key = from < to ? linkKey(from, to) : linkKey(to, from);
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  return Math.max(1, ...count.values());
}

function countLoops(state: GraphState): Record<string, number> {
  const count = new Map<string, number>();
  for (const e of state.data.edges)
    if (e.from === e.to) count.set(e.from, (count.get(e.from) ?? 0) + 1);
  // fromEntries: ids such as "__proto__" must become keys.
  return Object.fromEntries(count);
}

type Point = { readonly x: number; readonly y: number };

/** Positions in layout units: columns and rows, or unit-circle points. */
interface Arrangement {
  readonly kind: 'circle' | 'rows' | 'manual';
  readonly at: ReadonlyMap<string, Point>;
  /** Bend points of routed edges, from `from` to `to`, keyed by link. */
  readonly bends?: ReadonlyMap<string, readonly Point[]>;
}

function isAcyclic(nodes: readonly string[], out: Map<string, string[]>) {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      const s = state.get(next);
      if (s === 1 || (s === undefined && !visit(next))) return false;
    }
    state.set(id, 2);
    return true;
  };
  return nodes.every((id) => state.has(id) || visit(id));
}

function adjacency(metrics: GraphMetrics, directed: boolean) {
  const out = new Map<string, string[]>(metrics.nodes.map((id) => [id, []]));
  for (const [from, to] of metrics.links) {
    if (from === to) continue;
    out.get(from)?.push(to);
    if (!directed) out.get(to)?.push(from);
  }
  return out;
}

/** Rank of each node: its row in the layered layout. */
function ranks(metrics: GraphMetrics, directed: boolean): Map<string, number> {
  const out = adjacency(metrics, directed);
  const rank = new Map<string, number>();
  if (!directed) {
    for (const start of metrics.nodes) {
      if (rank.has(start)) continue;
      rank.set(start, 0);
      const queue = [start];
      for (let k = 0; k < queue.length; k++) {
        const id = queue[k]!;
        for (const next of out.get(id) ?? [])
          if (!rank.has(next)) {
            rank.set(next, rank.get(id)! + 1);
            queue.push(next);
          }
      }
    }
    return rank;
  }
  // Keep only edges that do not close a cycle (depth-first back edges),
  // then rank by longest path from the sources.
  const forward = new Map<string, string[]>();
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string) => {
    state.set(id, 1);
    const kept: string[] = [];
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) continue;
      kept.push(next);
      if (!state.has(next)) dfs(next);
    }
    forward.set(id, kept);
    state.set(id, 2);
  };
  for (const id of metrics.nodes) if (!state.has(id)) dfs(id);
  const indegree = new Map(metrics.nodes.map((id) => [id, 0]));
  for (const targets of forward.values())
    for (const t of targets) indegree.set(t, indegree.get(t)! + 1);
  const queue = metrics.nodes.filter((id) => indegree.get(id) === 0);
  for (const id of queue) rank.set(id, 0);
  for (let k = 0; k < queue.length; k++) {
    const id = queue[k]!;
    for (const next of forward.get(id) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, rank.get(id)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return rank;
}

/**
 * Most dummy nodes the layered layout creates. Beyond it, edges that span
 * rows are drawn straight, so that a long trace cannot make layout slow.
 */
const MAX_DUMMIES = 3000;

function layered(metrics: GraphMetrics, directed: boolean): Arrangement {
  const rank = ranks(metrics, directed);
  const dummies = metrics.links.reduce(
    (sum, [from, to]) =>
      sum +
      Math.max(0, Math.abs((rank.get(to) ?? 0) - (rank.get(from) ?? 0)) - 1),
    0,
  );
  const route = dummies <= MAX_DUMMIES;
  // An edge spanning several rows passes through a dummy node in each row
  // between, so that it gets its own place in those rows (Sugiyama).
  const chains = new Map<string, string[]>();
  const neighbours = new Map<string, string[]>();
  const join = (a: string, b: string) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  };
  for (const [from, to] of metrics.links) {
    if (from === to) continue;
    const rf = rank.get(from) ?? 0;
    const rt = rank.get(to) ?? 0;
    const step = Math.sign(rt - rf);
    const chain = [from];
    for (let r = rf + step; route && step !== 0 && r !== rt; r += step) {
      const dummy = `\u0000${linkKey(from, to)}\u0000${r}`;
      rank.set(dummy, r);
      chain.push(dummy);
    }
    chain.push(to);
    for (let k = 1; k < chain.length; k++) join(chain[k - 1]!, chain[k]!);
    if (chain.length > 2) chains.set(linkKey(from, to), chain);
  }
  const rows: string[][] = [];
  for (const id of metrics.nodes) (rows[rank.get(id) ?? 0] ??= []).push(id);
  const position = new Map<string, number>();
  const index = (row: readonly string[]) =>
    row.forEach((id, k) => position.set(id, k - (row.length - 1) / 2));
  rows.forEach(index);
  // Dummies start beside the node their edge leaves from.
  for (const chain of chains.values())
    chain.slice(1, -1).forEach((dummy) => {
      position.set(dummy, position.get(chain[0]!)! + 0.5);
      rows[rank.get(dummy)!]!.push(dummy);
    });
  for (const row of rows) {
    row.sort((a, b) => position.get(a)! - position.get(b)!);
    index(row);
  }

  // Barycentre sweeps, down then up: order each row by the mean position
  // of its neighbours in the row before.
  const sweep = (row: string[], fixed: number) => {
    const key = new Map(
      row.map((id) => {
        const near = (neighbours.get(id) ?? []).filter(
          (n) => rank.get(n) === fixed,
        );
        return [
          id,
          near.length === 0
            ? position.get(id)!
            : near.reduce((sum, n) => sum + position.get(n)!, 0) / near.length,
        ];
      }),
    );
    row.sort((a, b) => key.get(a)! - key.get(b)!);
    index(row);
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r < rows.length; r++) sweep(rows[r] ?? [], r - 1);
    for (let r = rows.length - 2; r >= 0; r--) sweep(rows[r] ?? [], r + 1);
  }
  const at = new Map<string, Point>();
  for (const id of metrics.nodes)
    at.set(id, { x: position.get(id) ?? 0, y: rank.get(id) ?? 0 });
  const bends = new Map<string, readonly Point[]>();
  for (const [key, chain] of chains)
    bends.set(
      key,
      chain.slice(1, -1).map((d) => ({ x: position.get(d)!, y: rank.get(d)! })),
    );
  // An edge within a row that would cross the nodes between its ends
  // bows up into the gap above the row.
  for (const [from, to] of metrics.links) {
    const a = at.get(from);
    const b = at.get(to);
    if (from !== to && a && b && a.y === b.y && Math.abs(a.x - b.x) > 1)
      bends.set(linkKey(from, to), [{ x: (a.x + b.x) / 2, y: a.y - 0.45 }]);
  }
  return { kind: 'rows', at, bends };
}

const arrangements = new WeakMap<GraphMetrics, Arrangement>();

function arrange(metrics: GraphMetrics, decl: GraphDecl): Arrangement {
  const cached = arrangements.get(metrics);
  if (cached) return cached;
  const { nodes } = metrics;
  let layout = decl.layout;
  if (layout === 'auto')
    layout =
      nodes.length > 0 &&
      nodes.every((id) => Object.hasOwn(metrics.positions, id))
        ? 'manual'
        : decl.directed && isAcyclic(nodes, adjacency(metrics, true))
          ? 'layered'
          : 'circle';
  let result: Arrangement;
  if (layout === 'manual') {
    result = {
      kind: 'manual',
      at: new Map(
        nodes.map((id) => [id, own(metrics.positions, id) ?? { x: 0, y: 0 }]),
      ),
    };
  } else if (layout === 'layered') {
    result = layered(metrics, decl.directed);
  } else if (layout === 'grid') {
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    result = {
      kind: 'rows',
      at: new Map(
        nodes.map((id, k) => [
          id,
          { x: k % columns, y: Math.floor(k / columns) },
        ]),
      ),
    };
  } else {
    const n = nodes.length;
    result = {
      kind: 'circle',
      at: new Map(
        nodes.map((id, k) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * k) / n;
          return [id, { x: Math.cos(angle), y: Math.sin(angle) }];
        }),
      ),
    };
  }
  arrangements.set(metrics, result);
  return result;
}

/** Space between nodes beyond their diameters; room for a weight label. */
const GAP = 48;
const SELF_LOOP_HEIGHT = 36;
const PARALLEL_SPREAD = 12;

function nodeRole(state: GraphState, id: string): ElementRole {
  const { highlightNodes, settled, visited } = state.marks;
  if (highlightNodes.includes(id)) return 'highlight';
  if (settled.includes(id)) return 'settled';
  if (visited.includes(id)) return 'visited';
  return 'default';
}

function edgeRole(state: GraphState, id: string): EdgeRole {
  if (state.marks.highlightEdges.includes(id)) return 'highlight';
  return own(state.marks.edgeMarks, id) ?? 'default';
}

export function layoutGraph({
  name,
  title,
  decl,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<GraphDecl, GraphState, GraphMetrics>): Block {
  const shape = nodeShape(metrics.valueWidth, o);
  const { radius, halfWidth } = shape;
  const pointerWidth = sidePointerWidth(
    metrics.pointerRows,
    metrics.pointerWidth,
    o,
  );
  const pitch = 2 * halfWidth + GAP + pointerWidth;
  const arrangement = arrange(metrics, decl);

  // Scale layout units to pixels, relative to the top-left node centre.
  const n = metrics.nodes.length;
  const scale =
    arrangement.kind === 'manual'
      ? { x: 1, y: 1 }
      : arrangement.kind === 'rows'
        ? {
            x: pitch,
            y: 2 * radius + GAP + (metrics.hasNotes ? NOTE_HEIGHT : 0),
          }
        : (() => {
            const r =
              n <= 1
                ? 0
                : n === 2
                  ? pitch / 2
                  : pitch / (2 * Math.sin(Math.PI / n));
            return { x: r, y: r };
          })();
  const raw = [
    ...arrangement.at.values(),
    ...[...(arrangement.bends?.values() ?? [])].flat(),
  ];
  const extreme = (f: (...v: number[]) => number, v: number[]) =>
    v.length === 0 ? 0 : v.reduce((m, x) => f(m, x));
  const minX =
    extreme(
      Math.min,
      raw.map((p) => p.x),
    ) * scale.x;
  const minY =
    extreme(
      Math.min,
      raw.map((p) => p.y),
    ) * scale.y;
  const maxX =
    extreme(
      Math.max,
      raw.map((p) => p.x),
    ) * scale.x;
  const maxY =
    extreme(
      Math.max,
      raw.map((p) => p.y),
    ) * scale.y;
  // Self-loops may point any way; notes sit above nodes.
  // Room around the nodes for self-loops, notes beside nodes and weights.
  // Edge labels sit beside midpoints and reach out by their own width;
  // loop labels sit beyond the loop.
  const weightWidth = metrics.hasWeights
    ? ceilWidth(metrics.weightWidth * o.indexFontSize)
    : 0;
  // Routed parallel edges are shifted apart beyond their bend points.
  const routeShift =
    arrangement.bends === undefined || arrangement.bends.size === 0
      ? 0
      : ((metrics.maxParallel - 1) / 2) * PARALLEL_SPREAD;
  // Straight parallel edges are spread up to 0.8 r from the centre line,
  // and their labels sit beyond them.
  const straightShift =
    metrics.maxParallel > 1
      ? Math.min(
          ((metrics.maxParallel - 1) / 2) * PARALLEL_SPREAD,
          0.8 * radius,
        )
      : 0;
  const pad =
    routeShift +
    Math.max(
      metrics.hasWeights
        ? Math.max(12, weightWidth + 6 - halfWidth + straightShift)
        : 4,
      metrics.hasLoops
        ? metrics.hasWeights
          ? Math.max(
              SELF_LOOP_HEIGHT,
              Math.ceil(36 + Math.max(o.indexFontSize, weightWidth) + 2),
            )
          : SELF_LOOP_HEIGHT
        : 0,
      // A note turned sideways extends its full width beyond the node.
      metrics.hasNotes
        ? Math.max(30, noteTextWidth(metrics.noteWidth, shape) + 8)
        : 0,
    );
  const above = Math.max(pad, metrics.hasNotes ? NOTE_HEIGHT : 0);
  const left = origin.x + pointerWidth + halfWidth + pad;
  const top = origin.y + titleRowHeight(o) + above + radius;
  const toPixel = (p: Point): Point => ({
    x: left + p.x * scale.x - minX,
    y: top + p.y * scale.y - minY,
  });
  const centre = (id: string): Point =>
    toPixel(arrangement.at.get(id) ?? { x: 0, y: 0 });

  const items: SceneItem[] = titleItems(name, title, origin, o);
  if (state.data.nodes.length === 0)
    items.push({
      type: 'text',
      key: `${name}/empty`,
      x: left - halfWidth,
      y: top,
      anchor: 'start',
      role: 'label',
      text: '(empty)',
      fontSize: o.indexFontSize,
    });

  // Edges between the same two nodes, in either direction, are spread
  // perpendicular to the line from the lower id to the higher one.
  const pairKey = (e: GraphEdgeState) =>
    e.from < e.to ? linkKey(e.from, e.to) : linkKey(e.to, e.from);
  const pairs = new Map<string, string[]>();
  for (const e of state.data.edges)
    if (e.from !== e.to)
      pairs.set(pairKey(e), [...(pairs.get(pairKey(e)) ?? []), e.id]);

  // Self-loops and notes point where no other edge of their node, in any
  // frame, leaves: so they stay put. Notes prefer up, loops any side; left
  // is kept for pointer badges.
  const awayCache = new Map<string, number[]>();
  const away = (id: string): number[] => {
    const cached = awayCache.get(id);
    if (cached) return cached;
    const c = centre(id);
    const angles = metrics.links.flatMap(([from, to]) => {
      if (from === to || (from !== id && to !== id)) return [];
      const bends = arrangement.bends?.get(linkKey(from, to));
      const next =
        bends === undefined
          ? centre(from === id ? to : from)
          : toPixel(from === id ? bends[0]! : bends.at(-1)!);
      return [(Math.atan2(next.x - c.x, c.y - next.y) * 180) / Math.PI];
    });
    awayCache.set(id, angles);
    return angles;
  };
  const gap = (angle: number, taken: readonly number[]) =>
    Math.min(
      360,
      ...taken.map((d) => {
        const diff = Math.abs(((angle - d) % 360) + 360) % 360;
        return Math.min(diff, 360 - diff);
      }),
    );
  /** Candidates clear of `taken` in order of preference, then the rest by room. */
  const ranked = (candidates: readonly number[], taken: readonly number[]) => [
    ...candidates.filter((angle) => gap(angle, taken) >= 40),
    ...candidates
      .filter((angle) => gap(angle, taken) < 40)
      .sort((a, b) => gap(b, taken) - gap(a, taken)),
  ];
  const sides = (angles: number[]) =>
    angles.filter((angle) => !(angle === 270 && metrics.pointerRows > 0));
  // Each self-loop of a node takes the next free direction.
  const loopAngles = (id: string): number[] => {
    const directions = ranked(
      sides([0, 90, 180, 270, 45, 315, 135, 225]).filter(
        (angle) => !(angle === 0 && metrics.hasNotes),
      ),
      away(id),
    );
    const count = own(metrics.loops, id) ?? 0;
    if (count <= directions.length) return directions.slice(0, count);
    // More loops than directions: spread them evenly from the best one, so
    // that no two coincide.
    return Array.from(
      { length: count },
      (_, k) => (directions[0]! + (k * 360) / count) % 360,
    );
  };
  const loopsSeen = new Map<string, number>();
  const labelAngle = (id: string): number =>
    ranked(sides([0, 45, 315, 90, 270, 135, 225, 180]), [
      ...away(id),
      ...loopAngles(id),
    ])[0]!;

  for (const e of state.data.edges) {
    const key = `${name}/edge/${e.id}`;
    const label = e.weight === null ? {} : { label: formatScalar(e.weight) };
    const common = {
      type: 'edge' as const,
      key,
      role: edgeRole(state, e.id),
      directed: state.directed,
      fontSize: o.indexFontSize,
    };
    const a = centre(e.from);
    if (e.from === e.to) {
      const k = loopsSeen.get(e.from) ?? 0;
      loopsSeen.set(e.from, k + 1);
      const angles = loopAngles(e.from);
      const angle = angles[k % angles.length] ?? 0;
      const rad = (angle * Math.PI) / 180;
      const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
      const reach = outlineDistance(shape, dir.x, dir.y);
      const tip = { x: a.x + dir.x * reach, y: a.y + dir.y * reach };
      items.push({
        ...common,
        x1: tip.x,
        y1: tip.y,
        x2: tip.x,
        y2: tip.y,
        ...label,
        ...(angle === 0 ? {} : { loopAngle: angle }),
      });
      continue;
    }
    const b = centre(e.to);
    const group = pairs.get(pairKey(e))!;
    const offset =
      (group.indexOf(e.id) - (group.length - 1) / 2) * PARALLEL_SPREAD;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    // The edge's right-hand normal, and the pair's shared one.
    const right = { x: -u.y, y: u.x };
    const sameWay = e.from < e.to ? 1 : -1;
    const shared = { x: right.x * sameWay, y: right.y * sameWay };
    // Straight edges must leave through the node, so they share at most
    // 1.6 r between them; the spacing shrinks so that none coincide.
    const d =
      group.length === 1
        ? 0
        : (group.indexOf(e.id) - (group.length - 1) / 2) *
          Math.min(PARALLEL_SPREAD, (1.6 * radius) / (group.length - 1));
    const side =
      d === 0
        ? {}
        : {
            labelSide: d * sameWay > 0 ? ('right' as const) : ('left' as const),
          };

    const bends = arrangement.bends?.get(linkKey(e.from, e.to));
    if (bends !== undefined) {
      // Parallel routed edges share their bends, so shift them apart too.
      const via = bends.map(toPixel).map((p) => ({
        x: p.x + shared.x * offset,
        y: p.y + shared.y * offset,
      }));
      const trim = (from: Point, toward: Point) => {
        const length = Math.hypot(toward.x - from.x, toward.y - from.y) || 1;
        const u = {
          x: (toward.x - from.x) / length,
          y: (toward.y - from.y) / length,
        };
        const reach = outlineDistance(shape, u.x, u.y);
        return { x: from.x + u.x * reach, y: from.y + u.y * reach };
      };
      const start = trim(a, via[0]!);
      const end = trim(b, via.at(-1)!);
      items.push({
        ...common,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        via,
        ...label,
        ...side,
      });
      continue;
    }
    // Shifting sideways by d moves the outline closer by r − √(r² − d²).
    const along =
      outlineDistance(shape, u.x, u.y) -
      (radius - Math.sqrt(radius * radius - d * d));
    items.push({
      ...common,
      x1: a.x + u.x * along + shared.x * d,
      y1: a.y + u.y * along + shared.y * d,
      x2: b.x - u.x * along + shared.x * d,
      y2: b.y - u.y * along + shared.y * d,
      ...label,
      ...side,
    });
  }

  const { groups, notes, pointers } = state.marks;
  for (const node of state.data.nodes) {
    const group = own(groups, node.id);
    const note = own(notes, node.id);
    items.push({
      type: 'node',
      key: `${name}/element/${node.id}`,
      ...centre(node.id),
      radius,
      ...(halfWidth > radius ? { width: 2 * halfWidth } : {}),
      role: nodeRole(state, node.id),
      ...(group === undefined ? {} : { group }),
      text: formatScalar(node.value),
      fontSize: shape.fontSize,
      ...(note === undefined ? {} : { label: note }),
      ...(note === undefined || labelAngle(node.id) === 0
        ? {}
        : { labelAngle: labelAngle(node.id) }),
    });
  }
  for (const [id, names] of groupPointers(Object.entries(pointers)))
    items.push(
      ...sidePointerItems(name, names, { ...centre(id), halfWidth }, o),
    );

  return {
    items: separateEdgeLabels(items, o.fonts.value),
    width: Math.max(
      pointerWidth + maxX - minX + 2 * halfWidth + 2 * pad,
      titleWidth(title, o),
      n === 0 ? 2 * halfWidth + 60 : 0,
    ),
    height: titleRowHeight(o) + above + maxY - minY + 2 * radius + pad,
  };
}
