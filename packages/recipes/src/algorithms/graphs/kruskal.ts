/**
 * Kruskal's algorithm, as in CLRS (ADR 0023): take the edges from
 * lightest to heaviest (ties in the order listed), and keep each one whose
 * ends are in different sets, uniting the sets. The sets are a
 * disjoint-set forest with union by rank and path compression, drawn
 * beside the graph. The sorted edges are a table under the graph, the
 * current one highlighted and the ones taken settled (ADR 0029). Edges are
 * taken as undirected; a disconnected graph gives a minimum spanning
 * forest.
 */
import { LIMITS } from '@algomotion/spec';
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
  title: { en: 'Kruskal’s algorithm', zh: 'Kruskal 算法' },
  topic: 'graphs',
  summary: {
    en: 'Builds a minimum spanning forest by taking edges from lightest to heaviest and keeping each that joins two different trees.',
    zh: '按从轻到重的顺序考虑每条边，保留连接两棵不同树的边，构造最小生成森林。',
  },
  input: z.strictObject({
    graph: Graph.describe(
      'A graph whose edges are taken as undirected, with at most 100 edges: one column each in the table of edges by weight.',
    ),
  }),
  main: 'graph',
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
    if (g.edges.length > LIMITS.tableColumns)
      throw new RangeError(
        `Kruskal’s algorithm draws its edges in a table of at most ${LIMITS.tableColumns} columns: give at most ${LIMITS.tableColumns} edges`,
      );
    const ids = edgeIds(g);
    const sorted = g.edges
      .map(([u, v, w = 1], k) => ({ u, v, w, edge: ids[k]! }))
      .sort((a, b) => a.w - b.w);
    const graph = trace.add('g', declareGraph(g, true));
    const table = trace.add('edges', {
      kind: 'table',
      label: trace.say({ en: 'edges by weight', zh: '按权重排序的边' }),
      rowLabels: ['w'],
      columnLabels: sorted.map(({ u, v }) => `${u}–${v}`),
      // One row, also when there are no edges.
      rows: 1,
      initial: [sorted.map(({ w }) => w)],
    });
    const sets = trace.add('sets', {
      kind: 'tree',
      label: trace.say({ en: 'disjoint sets', zh: '不相交集合' }),
      place: 'side',
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
    trace.step('sort', {
      en: 'Take the edges in order of weight, lightest first.',
      zh: '按权重从轻到重依次考虑每条边。',
    });
    for (const [k, { u, v, w, edge }] of sorted.entries()) {
      const cell: [number, number] = [0, k];
      trace.step(
        'compare',
        {
          en: `${u}–${v}, weight ${w}: find the sets of ${u} and ${v}.`,
          zh: `${u}–${v}，权重 ${w}：找出 ${u} 和 ${v} 所在的集合。`,
        },
        { vars: { w } },
      );
      graph.highlight({ edges: [edge] });
      table.highlight({ cells: [cell] });
      // The roots are found, and paths compressed, in the step that
      // reports them, so the first step does not give the answer away.
      if (find(u) === find(v)) {
        // The test fails, on the same line.
        const r = find(u);
        trace.step(
          'compare',
          {
            en: `${u} and ${v} are both in the set of ${r}: ${u}–${v} would close a cycle, so skip it.`,
            zh: `${u} 和 ${v} 都在 ${r} 的集合中：${u}–${v} 会形成环，跳过。`,
          },
          { id: 'skip' },
        );
        compress(u);
        compress(v);
        sets.highlight({ nodes: [r] });
        graph.highlight({ edges: [edge] }).markEdge({ edge, mark: 'rejected' });
        table.highlight({ cells: [cell] });
        continue;
      }
      const [ru, rv] = [find(u), find(v)];
      // UNION(u, v): the root of lower rank goes under the other; on a
      // tie, the root of u's set goes under the root of v's.
      const [child, root] = rank.get(ru)! > rank.get(rv)! ? [rv, ru] : [ru, rv];
      trace.step('take', {
        en: `${u} is in the set of ${ru} and ${v} in the set of ${rv}: take ${u}–${v} and unite the sets, hanging ${child} under ${root}.`,
        zh: `${u} 在 ${ru} 的集合中，${v} 在 ${rv} 的集合中：选取 ${u}–${v} 并合并两个集合，把 ${child} 挂到 ${root} 下面。`,
      });
      compress(u);
      compress(v);
      sets.highlight({ nodes: [ru, rv] });
      graph.highlight({ edges: [edge] }).markEdge({ edge, mark: 'selected' });
      table.highlight({ cells: [cell] }).settle({ cells: [cell] });
      sets.setChild({ parent: root, child });
      parent.set(child, root);
      if (rank.get(ru) === rank.get(rv)) {
        rank.set(root, rank.get(root)! + 1);
        sets.annotate({
          node: root,
          text: trace.say({
            en: `rank ${rank.get(root)}`,
            zh: `秩 ${rank.get(root)}`,
          }),
        });
      }
    }
    trace.step('done', {
      en: 'Every edge is considered: the selected edges form a minimum spanning tree, or a forest if the graph is not connected.',
      zh: '每条边都考虑过了：选中的边构成一棵最小生成树；如果图不连通，则构成一片最小生成森林。',
    });
  },
});
