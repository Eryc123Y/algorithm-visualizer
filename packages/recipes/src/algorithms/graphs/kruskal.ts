/**
 * Kruskal's algorithm, as in CLRS (ADR 0023): take the edges from
 * lightest to heaviest (ties in the order listed), and keep each one whose
 * ends are in different sets, uniting the sets. The sets are a
 * disjoint-set forest with union by rank and path compression, drawn
 * beside the graph. Edges are taken as undirected; a disconnected graph
 * gives a minimum spanning forest.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  CITIES,
  declareGraph,
  edgeIds,
  Graph,
  graphOf,
  type GraphInput,
} from './graph.ts';

export const kruskal = defineAlgorithm({
  id: 'kruskal',
  title: 'Kruskal’s algorithm',
  topic: 'graphs',
  summary:
    'Builds a minimum spanning forest by taking edges from lightest to heaviest and keeping each that joins two different trees.',
  input: z.strictObject({
    graph: Graph.describe('A graph whose edges are taken as undirected.'),
  }),
  examples: [{ graph: CITIES }],
  code: {
    pseudocode: `
      MST-KRUSKAL(G, w)
          A = ∅
          for each vertex v in G.V
              MAKE-SET(v)
          sort the edges of G.E by weight, lightest first  // @sort
          for each edge (u, v) in that order
              if FIND-SET(u) ≠ FIND-SET(v)  // @compare
                  A = A ∪ {(u, v)}  // @take
                  UNION(u, v)
          return A  // @done
    `,
    python: `
      def kruskal(g):
          tree = []
          for v in g:
              make_set(v)
          for u, v, w in sorted(g.edges, key=lambda e: e[2]):  # @sort
              if find_set(u) != find_set(v):  # @compare
                  tree.append((u, v))  # @take
                  union(u, v)
          return tree  # @done
    `,
  },
  run(input, trace) {
    const g: GraphInput = { ...graphOf(input.graph), directed: false };
    const graph = trace.add('g', declareGraph(g, true));
    const sets = trace.add('sets', {
      kind: 'tree',
      label: 'disjoint sets',
      nodes: g.nodes.map((v) => ({ id: v, value: v })),
    });
    const parent = new Map(g.nodes.map((v) => [v, v]));
    const rank = new Map(g.nodes.map((v) => [v, 0]));
    /** The root of v's set, read from the model. */
    const find = (v: string): string => {
      const p = parent.get(v)!;
      return p === v ? v : find(p);
    };
    /** Path compression: hangs every node on v's path under the root. */
    const compress = (v: string): void => {
      const root = find(v);
      for (let x = v; parent.get(x) !== root && x !== root;) {
        const next = parent.get(x)!;
        sets.setChild({ parent: root, child: x });
        parent.set(x, root);
        x = next;
      }
    };
    const ids = edgeIds(g);
    const sorted = g.edges
      .map(([u, v, w = 1], k) => ({ u, v, w, edge: ids[k]! }))
      .sort((a, b) => a.w - b.w);
    trace.step('sort', 'Take the edges in order of weight, lightest first.');
    for (const { u, v, w, edge } of sorted) {
      trace.step(
        'compare',
        `${u}–${v}, weight ${w}: find the sets of ${u} and ${v}.`,
        { vars: { w } },
      );
      graph.highlight({ edges: [edge] });
      // The roots are found, and paths compressed, in the step that
      // reports them, so the first step does not give the answer away.
      if (find(u) === find(v)) {
        // The test fails, on the same line.
        const r = find(u);
        trace.step(
          'compare',
          `${u} and ${v} are both in the set of ${r}: ${u}–${v} would close a cycle, so skip it.`,
          { id: 'skip' },
        );
        compress(u);
        compress(v);
        sets.highlight({ nodes: [r] });
        graph.highlight({ edges: [edge] }).markEdge({ edge, mark: 'rejected' });
        continue;
      }
      const [ru, rv] = [find(u), find(v)];
      // UNION(u, v): the root of lower rank goes under the other; on a
      // tie, the root of u's set goes under the root of v's.
      const [child, root] = rank.get(ru)! > rank.get(rv)! ? [rv, ru] : [ru, rv];
      trace.step(
        'take',
        `${u} is in the set of ${ru} and ${v} in the set of ${rv}: take ${u}–${v} and unite the sets, hanging ${child} under ${root}.`,
      );
      compress(u);
      compress(v);
      sets.highlight({ nodes: [ru, rv] });
      graph.highlight({ edges: [edge] }).markEdge({ edge, mark: 'selected' });
      sets.setChild({ parent: root, child });
      parent.set(child, root);
      if (rank.get(ru) === rank.get(rv)) {
        rank.set(root, rank.get(root)! + 1);
        sets.annotate({ node: root, text: `rank ${rank.get(root)}` });
      }
    }
    trace.step(
      'done',
      'Every edge is considered: the selected edges form a minimum spanning tree, or a forest if the graph is not connected.',
    );
  },
});
