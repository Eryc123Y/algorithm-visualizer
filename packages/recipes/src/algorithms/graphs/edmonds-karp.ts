/**
 * Edmonds–Karp maximum flow (CLRS 24.2): Ford–Fulkerson that always
 * augments along a shortest path, by edges, in the residual network,
 * found by breadth-first search. Each edge shows its flow over its
 * capacity; a path may send flow back along an edge, cancelling it. When
 * no path is left, the vertices still reachable from the source form a
 * minimum cut, whose capacity equals the flow. Edges are taken as
 * directed, weights as capacities.
 */
import { LIMITS } from '@algoviz/spec';
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  startOf,
  type GraphInput,
} from './graph.ts';

/** Most actions a step may hold. */
const MAX_ACTIONS = LIMITS.actionsPerStep;

/** A residual move: along edge `k` forward, or back against it. */
interface Step {
  readonly k: number;
  readonly forward: boolean;
}

export const edmondsKarp = defineAlgorithm({
  id: 'edmonds-karp',
  title: 'Edmonds–Karp maximum flow',
  topic: 'graphs',
  summary:
    'Finds a maximum flow from a source to a sink by augmenting along shortest paths in the residual network, found by breadth-first search, until none is left; the vertices still reachable then form a minimum cut.',
  input: z.strictObject({
    graph: Graph.describe(
      'A graph whose edges are taken as directed, with whole-number capacities as weights (1 by default).',
    ),
    source: z
      .string()
      .optional()
      .describe('The source; by default the first node.'),
    sink: z.string().optional().describe('The sink; by default the last node.'),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        directed: true,
        nodes: ['s', 'v1', 'v2', 'v3', 'v4', 't'],
        edges: [
          ['s', 'v1', 16],
          ['s', 'v2', 13],
          ['v1', 'v3', 12],
          ['v2', 'v1', 4],
          ['v2', 'v4', 14],
          ['v3', 'v2', 9],
          ['v3', 't', 20],
          ['v4', 'v3', 7],
          ['v4', 't', 4],
        ],
      },
      source: 's',
      sink: 't',
    },
  ],
  code: {
    pseudocode: `
      EDMONDS-KARP(G, s, t)
          for each edge (u, v) in G.E
              f(u, v) = 0  // @start
          while a path p from s to t exists in the residual network  // @path
              p = the path with fewest edges, by BFS
              c = the least residual capacity on p
              for each edge (u, v) on p  // @augment
                  if (u, v) is in G.E
                      f(u, v) = f(u, v) + c
                  else f(v, u) = f(v, u) - c
          return f  // @done
    `,
    python: `
      def edmonds_karp(g, s, t):
          f = {e: 0 for e in g.edges}  # @start
          while True:
              p = shortest_residual_path(g, f, s, t)  # @path
              if p is None:
                  return f  # @done
              c = min(residual(g, f, e) for e in p)
              for u, v in p:  # @augment
                  if (u, v) in g.edges:
                      f[u, v] += c
                  else:
                      f[v, u] -= c
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    const s = startOf(g, input.source);
    // By default the last node that is not the source.
    const t = input.sink ?? [...g.nodes].reverse().find((v) => v !== s) ?? s;
    if (!g.nodes.includes(t))
      throw new RangeError(`"${t}" is not a node of the graph`);
    if (s === t)
      throw new RangeError('The source and the sink must be different nodes');
    const ids = edgeIds(g);
    const cap = g.edges.map(([, , w = 1]) => {
      if (!Number.isInteger(w) || w < 0)
        throw new RangeError(
          `Capacities are whole numbers of 0 or more, not ${w}`,
        );
      return w;
    });
    const flow = cap.map(() => 0);
    const label = (k: number) => `${flow[k]}/${cap[k]}`;
    // Each edge starts labelled 0/c in the declaration: a step holds at
    // most 100 actions, and a network may have 200 edges.
    // Left to right, as CLRS draws flow networks, where no edge would
    // then cross a node; else in layers, whose edges bend around nodes.
    const placed = placeByLayers(g, s, t);
    const decl = clearOfNodes(placed, g.edges)
      ? { ...declareGraph(g, false), layout: 'manual' as const, nodes: placed }
      : declareGraph(g, false, { from: s });
    const graph = trace.add('g', {
      ...decl,
      edges: g.edges.map(([from, to], k) => ({
        id: ids[k]!,
        from,
        to,
        weight: label(k),
      })),
    });
    trace.step(
      'start',
      `Start with no flow: every edge carries 0 of its capacity. Send flow from ${s} to ${t}.`,
    );
    // Pointers name the source and sink, unless their names already do.
    const ends = () => {
      if (s !== 's') graph.pointer({ name: 's', node: s });
      if (t !== 't') graph.pointer({ name: 't', node: t });
    };
    ends();

    /** Residual moves out of u: forward with room, or back against flow. */
    const moves = (u: string): (Step & { to: string; room: number })[] =>
      g.edges.flatMap(([a, b], k) => [
        ...(a === u && flow[k]! < cap[k]!
          ? [{ k, forward: true, to: b, room: cap[k]! - flow[k]! }]
          : []),
        ...(b === u && flow[k]! > 0
          ? [{ k, forward: false, to: a, room: flow[k]! }]
          : []),
      ]);
    let total = 0;
    for (;;) {
      // Breadth-first search from s in the residual network.
      const via = new Map<string, Step & { from: string; room: number }>();
      const seen = new Set([s]);
      const queue = [s];
      while (queue.length > 0 && !seen.has(t)) {
        const u = queue.shift()!;
        for (const m of moves(u))
          if (!seen.has(m.to)) {
            seen.add(m.to);
            via.set(m.to, { ...m, from: u });
            queue.push(m.to);
          }
      }
      if (!seen.has(t)) {
        trace.step(
          'done',
          `No path is left from ${s} to ${t} in the residual network: the flow, ${total}, is maximum. The vertices still reachable from ${s} form a minimum cut: the edges leaving them are full, and those coming into them carry nothing.`,
        );
        graph.resetMarks();
        ends();
        for (const v of seen) graph.group({ node: v, group: 0 });
        // The edges leaving the cut, marked in the room this step has
        // left (a step holds at most 100 actions), the rest in more steps.
        const leaving = g.edges.flatMap(([a, b], k) =>
          seen.has(a) && !seen.has(b) ? [ids[k]!] : [],
        );
        const room = Math.max(0, MAX_ACTIONS - 3 - seen.size);
        leaving
          .slice(0, room)
          .forEach((edge) => graph.markEdge({ edge, mark: 'selected' }));
        for (let i = room; i < leaving.length; i += MAX_ACTIONS) {
          trace.step(
            'done',
            `More of the ${leaving.length} edges leaving the cut, all full.`,
          );
          for (const edge of leaving.slice(i, i + MAX_ACTIONS))
            graph.markEdge({ edge, mark: 'selected' });
        }
        return { results: [total] };
      }
      const path: (Step & { from: string; to: string; room: number })[] = [];
      for (let v = t; v !== s;) {
        const m = via.get(v)!;
        path.unshift({ ...m, to: v });
        v = m.from;
      }
      const c = Math.min(...path.map((m) => m.room));
      const route = [s, ...path.map((m) => m.to)].join(' → ');
      const backward = path.filter((m) => !m.forward).length;
      trace.step(
        'path',
        `Breadth-first search finds a shortest path in the residual network, ${route}, of ${path.length} edge${path.length === 1 ? '' : 's'}${backward === 0 ? '' : `, ${backward} of them against the flow`}. Its least residual capacity is ${c}.`,
      );
      graph.resetMarks();
      ends();
      // Forward edges are marked; edges the path goes back along are
      // only highlighted, as their flow is cancelled, not refused.
      graph.highlight({
        nodes: [s, ...path.map((m) => m.to)],
        edges: path.filter((m) => !m.forward).map((m) => ids[m.k]!),
      });
      for (const m of path)
        if (m.forward) graph.markEdge({ edge: ids[m.k]!, mark: 'selected' });
      for (const m of path) flow[m.k] = flow[m.k]! + (m.forward ? c : -c);
      total += c;
      trace.step(
        'augment',
        `Send ${c} more along it${backward === 0 ? '' : ', cancelling flow on the edges it goes back along'}: the flow is now ${total}.`,
      );
      for (const m of path)
        graph.setWeight({ edge: ids[m.k]!, weight: label(m.k) });
    }
  },
});

/** Room between columns, and between rows of up to six nodes. */
const COLUMN_GAP = 130;
const ROW_GAP = 90;

/** A node's half-width as drawn, roughly, from its name, with room. */
const reach = (v: string) => Math.max(22, 5 * v.length + 10) + 6;

type Place = { id: string; x: number; y: number };

/**
 * Each node's place: one column per breadth-first layer from the source,
 * along the edges' direction; the sink in a column of its own after them
 * when it shares its layer; and the nodes the source cannot reach in a
 * column after the last. Each column is centred, its nodes in the input's
 * order.
 */
function placeByLayers(g: GraphInput, s: string, t: string): Place[] {
  const layer = new Map([[s, 0]]);
  const queue = [s];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const [a, b] of g.edges)
      if (a === u && !layer.has(b)) {
        layer.set(b, layer.get(u)! + 1);
        queue.push(b);
      }
  }
  const deepest = Math.max(...layer.values());
  const tLayer = layer.get(t);
  if (
    tLayer !== undefined &&
    [...layer].some(([v, l]) => v !== t && l >= tLayer)
  )
    layer.set(t, deepest + 1);
  const unreached = Math.max(...layer.values()) + 1;
  const columns: string[][] = [];
  for (const v of [s, ...g.nodes.filter((v) => v !== s)])
    (columns[layer.get(v) ?? unreached] ??= []).push(v);
  const widest = Math.max(...g.nodes.map(reach));
  const step = Math.max(COLUMN_GAP, 2 * widest + 40);
  const rows = Math.max(...columns.map((c) => c?.length ?? 0));
  const gap = rows <= 6 ? ROW_GAP : Math.max(48, (5 * ROW_GAP) / (rows - 1));
  const middle = 40 + ((rows - 1) * gap) / 2;
  return columns.flatMap((column, k) =>
    (column ?? []).map((id, i) => ({
      id,
      x: 60 + k * step,
      y: middle + (i - (column.length - 1) / 2) * gap,
    })),
  );
}

/**
 * Whether every edge, drawn straight, keeps clear of every node but its
 * own two, as a layout by hand needs: it has no bends to go around one.
 */
function clearOfNodes(
  places: readonly Place[],
  edges: GraphInput['edges'],
): boolean {
  const at = new Map(places.map((p) => [p.id, p]));
  return edges.every(([a, b]) => {
    const [p, q] = [at.get(a)!, at.get(b)!];
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    const length2 = dx * dx + dy * dy;
    return places.every((n) => {
      if (n.id === a || n.id === b) return true;
      const k =
        length2 === 0
          ? 0
          : Math.max(
              0,
              Math.min(1, ((n.x - p.x) * dx + (n.y - p.y) * dy) / length2),
            );
      return Math.hypot(p.x + k * dx - n.x, p.y + k * dy - n.y) >= reach(n.id);
    });
  });
}
