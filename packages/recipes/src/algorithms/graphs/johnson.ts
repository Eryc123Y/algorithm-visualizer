/**
 * Johnson's algorithm (CLRS 23.3): all-pairs shortest paths in a sparse
 * graph with negative weights. A new vertex s, joined to every vertex by
 * a 0-weight edge, gives each vertex a potential h, its distance from s by
 * Bellman–Ford. Reweighting each edge to w + h(u) − h(v) makes every
 * weight non-negative without changing which paths are shortest, so
 * Dijkstra can run from every vertex; each result is then shifted back.
 * Edges are taken as directed; a negative cycle is reported.
 */
import { LIMITS } from '@algoviz/spec';
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { num } from './dag-shortest-paths.ts';
import {
  adjacency,
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

/** Most vertices: one Dijkstra run each, all drawn. */
export const MAX_JOHNSON_NODES = 8;

/** An id for s that no vertex has. */
const freshName = (taken: readonly string[]) => {
  for (let k = 0; ; k++) {
    const id = k === 0 ? 's' : `s${k}`;
    if (!taken.includes(id)) return id;
  }
};

export const johnson = defineAlgorithm({
  id: 'johnson',
  title: 'Johnson’s algorithm',
  topic: 'graphs',
  summary:
    'Finds shortest paths between all pairs in a graph with negative weights: Bellman–Ford from a new vertex gives each vertex a potential, which reweights the edges to be non-negative, so Dijkstra can run from every vertex.',
  input: z.strictObject({
    graph: Graph.describe(
      `A graph whose edges are taken as directed, with at most ${MAX_JOHNSON_NODES} vertices.`,
    ),
  }),
  main: 'graph',
  examples: [
    {
      graph: {
        directed: true,
        nodes: ['1', '2', '3', '4', '5'],
        edges: [
          ['1', '2', 3],
          ['1', '3', 8],
          ['1', '5', -4],
          ['2', '4', 1],
          ['2', '5', 7],
          ['3', '2', 4],
          ['4', '1', 2],
          ['4', '3', -5],
          ['5', '4', 6],
        ],
      },
    },
  ],
  code: {
    pseudocode: `
      JOHNSON(G, w)
          add a vertex s, with an edge (s, v) of weight 0 to each vertex v  // @extend
          if BELLMAN-FORD(G, w, s) finds a negative cycle  // @potential
              return  // @cycle
          h(v) = the distance found to v, for each vertex v
          ŵ(u, v) = w(u, v) + h(u) - h(v), for each edge (u, v)  // @reweight
          remove s
          for each vertex u  // @source
              run DIJKSTRA(G, ŵ, u), finding d̂(u, v) for each v  // @settle
              for each vertex v
                  D[u][v] = d̂(u, v) + h(v) - h(u)  // @row
          return D  // @done
    `,
    python: `
      def johnson(g):
          vs = list(g.vertices())
          s = g.add_vertex()  # @extend
          for v in vs:
              g.add_edge(s, v, 0)
          h = bellman_ford(g, s)  # @potential
          if h is None:
              return None  # @cycle
          w = {(u, v): g.w(u, v) + h[u] - h[v] for u, v in g.edges()}  # @reweight
          g.remove_vertex(s)
          D = {}
          for u in g.vertices():  # @source
              d = dijkstra(g, w, u)  # @settle
              for v in g.vertices():
                  D[u, v] = d[v] + h[v] - h[u]  # @row
          return D  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: true };
    const n = g.nodes.length;
    if (n > MAX_JOHNSON_NODES)
      throw new RangeError(
        `Johnson’s algorithm here takes at most ${MAX_JOHNSON_NODES} vertices, one Dijkstra run each; the graph has ${n}`,
      );
    const ids = edgeIds(g);
    const graph = trace.add('g', declareGraph(g, true));
    const table = trace.add('D', {
      kind: 'table',
      place: 'side',
      label: 'D, distances',
      initial: g.nodes.map(() => g.nodes.map(() => '')),
      rowLabels: [...g.nodes],
      columnLabels: [...g.nodes],
    });
    const s = freshName(g.nodes);
    trace.step(
      'extend',
      `Add a vertex ${s} with an edge of weight 0 to every vertex, so every vertex is reached from ${s}.`,
    );
    graph.addNode({ node: s });
    // Edge ids from s that no vertex or edge has.
    const taken = new Set([...g.nodes, ...ids]);
    for (const v of g.nodes) {
      let id = `${s}:${v}`;
      for (let k = 2; taken.has(id); k++) id = `${s}:${v}.${k}`;
      taken.add(id);
      graph.addEdge({ edge: { id, from: s, to: v, weight: 0 } });
    }

    // Bellman–Ford from s: the potentials h.
    const h = new Map(g.nodes.map((v) => [v, 0]));
    const edges = g.edges.map(([u, v, w = 1], k) => ({ u, v, w, id: ids[k]! }));
    for (let round = 0; round < n; round++)
      for (const { u, v, w } of edges)
        if (h.get(u)! + w < h.get(v)!) h.set(v, h.get(u)! + w);
    const cycle = edges.find(({ u, v, w }) => h.get(u)! + w < h.get(v)!);
    if (cycle !== undefined) {
      trace.step(
        'cycle',
        `Bellman–Ford from ${s}: ${cycle.u} → ${cycle.v} still improves after ${n} rounds, so a negative-weight cycle is reachable and there are no shortest paths.`,
      );
      graph
        .highlight({ edges: [cycle.id] })
        .markEdge({ edge: cycle.id, mark: 'rejected' });
      return { results: [false] };
    }
    trace.step(
      'potential',
      `Bellman–Ford from ${s} gives each vertex its distance from ${s}, its potential h: ${g.nodes.map((v) => `h(${v}) = ${num(h.get(v)!)}`).join(', ')}.`,
    );
    for (const v of g.nodes)
      graph.annotate({ node: v, text: `h=${num(h.get(v)!)}` });

    // Rounded to 12 digits, so decimal weights leave no residue below 0.
    const hat = new Map(
      edges.map(({ u, v, w, id }) => [
        id,
        Number((w + h.get(u)! - h.get(v)!).toPrecision(12)),
      ]),
    );
    // A step holds at most 100 actions; with many parallel edges, the
    // new weights take more than one, and the last also removes s.
    const per = LIMITS.actionsPerStep - 1;
    const many = edges.length > per;
    for (let i = 0; i === 0 || i < edges.length; i += per) {
      const last = i + per >= edges.length;
      trace.step(
        'reweight',
        i === 0
          ? `Reweight every edge (u, v) to w + h(u) − h(v), which is never negative, since h(v) is at most h(u) + w. Every path between two vertices changes by the same amount, so the shortest ones stay shortest.${many ? '' : ` Then remove ${s}.`}`
          : `Reweight more of the ${edges.length} edges${last ? `, then remove ${s}` : ''}.`,
      );
      for (const { id } of edges.slice(i, i + per))
        graph.setWeight({ edge: id, weight: num(hat.get(id)!) });
    }
    graph.removeNode({ node: s });

    const adj = adjacency(g);
    g.nodes.forEach((u, row) => {
      trace.step('source', `Run Dijkstra from ${u} on the new weights.`);
      graph.resetMarks().pointer({ name: 'u', node: u });
      for (const v of g.nodes)
        graph.annotate({ node: v, text: v === u ? '0' : '∞' });
      table.highlight({
        cells: g.nodes.map((_, c) => [row, c] as [number, number]),
      });
      const d = new Map(g.nodes.map((v) => [v, v === u ? 0 : Infinity]));
      const done = new Set<string>();
      for (;;) {
        let x: string | undefined;
        for (const v of g.nodes)
          if (
            !done.has(v) &&
            d.get(v)! < Infinity &&
            (x === undefined || d.get(v)! < d.get(x)!)
          )
            x = v;
        if (x === undefined) break;
        done.add(x);
        const improved: string[] = [];
        for (const { to: v, edge } of adj.get(x)!) {
          const c = d.get(x)! + hat.get(edge)!;
          if (!done.has(v) && c < d.get(v)!) {
            d.set(v, c);
            if (!improved.includes(v)) improved.push(v);
          }
        }
        trace.step(
          'settle',
          `${x} is the closest vertex not yet settled, at d̂ = ${num(d.get(x)!)} from ${u}${improved.length === 0 ? '.' : `; relaxing its edges improves ${improved.join(', ')}.`}`,
        );
        graph.settle({ node: x }).annotate({ node: x, text: num(d.get(x)!) });
        for (const v of improved)
          graph.annotate({ node: v, text: num(d.get(v)!) });
      }
      trace.step(
        'row',
        `Shift each result back: the distance from ${u} to v on the original weights is d̂(${u}, v) + h(v) − h(${u}).`,
      );
      g.nodes.forEach((v, c) => {
        const dv = d.get(v)!;
        table.set({
          cell: [row, c],
          value: dv === Infinity ? '∞' : num(dv + h.get(v)! - h.get(u)!),
        });
      });
    });
    trace.step(
      'done',
      'Every row is filled: the table holds the shortest distance from each vertex to each other.',
    );
    graph.pointer({ name: 'u', node: null });
    return { results: [true] };
  },
});
