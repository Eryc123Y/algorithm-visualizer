import { describe, expect, it } from 'vitest';

import type { GraphState } from '@algoviz/core';

import {
  bellmanFord,
  breadthFirstSearch,
  depthFirstSearch,
  dijkstra,
  floydWarshall,
  kruskal,
  prim,
  topologicalSort,
  type GraphInput,
} from '../src/index.ts';
import { replay, stateOf } from './helpers.ts';

const weighted: GraphInput = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edges: [
    ['A', 'B', 7],
    ['A', 'C', 9],
    ['A', 'F', 14],
    ['B', 'C', 10],
    ['B', 'D', 15],
    ['C', 'D', 11],
    ['C', 'F', 2],
    ['D', 'E', 6],
    ['E', 'F', 9],
  ],
};
const withIsland: GraphInput = {
  nodes: ['1', '2', '3', '4', '5', '6'],
  edges: [
    ['1', '2'],
    ['1', '3'],
    ['2', '4'],
    ['3', '4'],
    ['5', '6'],
  ],
};

/** Shortest distances by repeated relaxation (|V| − 1 rounds). */
function reference(g: GraphInput, s: string): Map<string, number> {
  const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
  for (let k = 1; k < g.nodes.length; k++)
    for (const [u, v, w = 1] of g.edges) {
      d.set(v, Math.min(d.get(v)!, d.get(u)! + w));
      if (!g.directed) d.set(u, Math.min(d.get(u)!, d.get(v)! + w));
    }
  return d;
}

const notes = (g: GraphState) => g.marks.notes;
const selected = (g: GraphState) =>
  Object.entries(g.marks.edgeMarks)
    .filter(([, m]) => m === 'selected')
    .map(([id]) => id);
const weightOf = (g: GraphState, ids: string[]) =>
  ids.reduce(
    (sum, id) => sum + Number(g.data.edges.find((e) => e.id === id)!.weight),
    0,
  );

/** Minimum spanning forest weight by trying every edge set (small graphs). */
function mstWeight(g: GraphInput): number {
  const parent = new Map(g.nodes.map((v) => [v, v]));
  const find = (v: string): string =>
    parent.get(v) === v ? v : find(parent.get(v)!);
  let total = 0;
  for (const [u, v, w = 1] of [...g.edges].sort(
    (a, b) => (a[2] ?? 1) - (b[2] ?? 1),
  ))
    if (find(u) !== find(v)) {
      parent.set(find(u), find(v));
      total += w;
    }
  return total;
}

describe('breadthFirstSearch', () => {
  it('labels every reachable node with its hop distance', () => {
    const trace = replay(breadthFirstSearch(withIsland, '1'));
    const g = stateOf(trace, 'g', 'graph');
    const d = reference(withIsland, '1');
    for (const v of withIsland.nodes)
      expect(notes(g)[v]).toBe(
        d.get(v) === Infinity ? undefined : String(d.get(v)),
      );
    expect(selected(g)).toHaveLength(3);
    expect(stateOf(trace, 'queue', 'queue').data).toEqual([]);
  });
});

describe('depthFirstSearch', () => {
  it('nests discovery and finishing times', () => {
    const trace = replay(depthFirstSearch(withIsland, '1'));
    const g = stateOf(trace, 'g', 'graph');
    const times = Object.entries(notes(g)).map(([v, t]) => {
      const [d, f] = t.split('/').map(Number);
      return { v, d: d!, f: f! };
    });
    expect(times.map((t) => t.v).sort()).toEqual(['1', '2', '3', '4']);
    for (const a of times)
      for (const b of times)
        // Intervals are either disjoint or nested (parenthesis theorem).
        expect(a.f < b.d || b.f < a.d || a.d < b.d === b.f < a.f).toBe(true);
    expect(selected(g)).toHaveLength(3);
    expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
  });
});

describe('dijkstra', () => {
  it.each([
    ['undirected', weighted],
    ['directed', { ...weighted, directed: true }],
  ])('finds shortest distances (%s)', (_, graph) => {
    const trace = replay(dijkstra(graph, 'A'));
    const g = stateOf(trace, 'g', 'graph');
    const d = reference(graph, 'A');
    for (const v of graph.nodes)
      expect(notes(g)[v]).toBe(d.get(v) === Infinity ? '∞' : String(d.get(v)));
    // The selected edges form a tree reaching every reachable node.
    const reachable = graph.nodes.filter((v) => d.get(v) !== Infinity);
    expect(selected(g)).toHaveLength(reachable.length - 1);
  });
});

describe('bellmanFord', () => {
  const negative: GraphInput = {
    directed: true,
    nodes: ['s', 'a', 'b', 'c'],
    edges: [
      ['s', 'a', 4],
      ['s', 'b', 5],
      ['b', 'a', -3],
      ['a', 'c', 2],
    ],
  };
  it('handles negative weights', () => {
    const trace = replay(bellmanFord(negative, 's'));
    const g = stateOf(trace, 'g', 'graph');
    const d = reference(negative, 's');
    for (const v of negative.nodes) expect(notes(g)[v]).toBe(String(d.get(v)));
    expect(g.marks.settled).toHaveLength(4);
  });
  it('detects a negative cycle', () => {
    const cycle = {
      ...negative,
      edges: [...negative.edges, ['c', 'b', -1] as const],
    };
    const trace = replay(bellmanFord(cycle, 's'));
    const g = stateOf(trace, 'g', 'graph');
    expect(Object.values(g.marks.edgeMarks)).toContain('rejected');
  });
});

describe('minimum spanning trees', () => {
  it.each([
    ['prim', (g: GraphInput) => prim(g, 'A')],
    ['kruskal', kruskal],
  ])('%s selects a tree of minimum weight', (_, run) => {
    const trace = replay(run(weighted));
    const g = stateOf(trace, 'g', 'graph');
    expect(selected(g)).toHaveLength(weighted.nodes.length - 1);
    expect(weightOf(g, selected(g))).toBe(mstWeight(weighted));
  });
});

describe('topologicalSort', () => {
  const dag: GraphInput = {
    directed: true,
    nodes: [
      'shirt',
      'tie',
      'jacket',
      'belt',
      'pants',
      'shoes',
      'socks',
      'undershorts',
      'watch',
    ],
    edges: [
      ['undershorts', 'pants'],
      ['undershorts', 'shoes'],
      ['pants', 'belt'],
      ['pants', 'shoes'],
      ['belt', 'jacket'],
      ['shirt', 'belt'],
      ['shirt', 'tie'],
      ['tie', 'jacket'],
      ['socks', 'shoes'],
    ],
  };
  it('orders every node after its predecessors', () => {
    const trace = replay(topologicalSort(dag));
    const order = stateOf(trace, 'order', 'array').data.map((e) =>
      String(e.value),
    );
    expect([...order].sort()).toEqual([...dag.nodes].sort());
    for (const [u, v] of dag.edges)
      expect(order.indexOf(u)).toBeLessThan(order.indexOf(v));
  });
  it('stops short on a cycle', () => {
    const trace = replay(
      topologicalSort({
        directed: true,
        nodes: ['a', 'b', 'c'],
        edges: [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'b'],
        ],
      }),
    );
    expect(stateOf(trace, 'order', 'array').data.map((e) => e.value)).toEqual([
      'a',
    ]);
  });
});

describe('floydWarshall', () => {
  it('fills the table with all-pairs shortest distances', () => {
    const graph: GraphInput = {
      directed: true,
      nodes: ['1', '2', '3', '4'],
      edges: [
        ['1', '3', -2],
        ['3', '4', 2],
        ['4', '2', -1],
        ['2', '1', 4],
        ['2', '3', 3],
      ],
    };
    const trace = replay(floydWarshall(graph));
    const table = stateOf(trace, 'dist', 'table');
    graph.nodes.forEach((s, i) => {
      const d = reference(graph, s);
      graph.nodes.forEach((t, j) => expect(table.data[i]![j]).toBe(d.get(t)));
    });
  });
});
