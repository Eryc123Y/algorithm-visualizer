/**
 * The graph modules against independent references: shortest distances
 * by repeated relaxation, a minimum spanning forest by a plain greedy
 * pass, and the order constraints of a topological sort.
 * `properties.spec.ts` runs them on random graphs.
 */
import { describe, expect, it } from 'vitest';

import type { GraphState } from '@algomotion/core';
import type { VisualizationInput } from '@algomotion/spec';

import type { GraphInput } from '../src/index.ts';
import { replay, runError, runOk, stateOf } from './helpers.ts';

const doc = (id: string, input: object): VisualizationInput =>
  runOk(id, input).document;
const ids = (d: VisualizationInput) => d.steps.map((s) => s.meta?.id);

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
    const trace = replay(doc('bfs', { graph: withIsland, source: '1' }));
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
    const trace = replay(doc('dfs', { graph: withIsland }));
    const g = stateOf(trace, 'g', 'graph');
    const times = Object.entries(notes(g)).map(([v, t]) => {
      const [d, f] = t.split('/').map(Number);
      return { v, d: d!, f: f! };
    });
    // Every vertex, in a forest of two trees.
    expect(times.map((t) => t.v).sort()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    for (const a of times)
      for (const b of times)
        // Intervals are either disjoint or nested (parenthesis theorem).
        expect(a.f < b.d || b.f < a.d || a.d < b.d === b.f < a.f).toBe(true);
    expect(selected(g)).toHaveLength(4);
    expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
  });
});

describe('dijkstra', () => {
  it.each([
    ['undirected', weighted],
    ['directed', { ...weighted, directed: true }],
  ])('finds shortest distances (%s)', (_, graph) => {
    const trace = replay(doc('dijkstra', { graph, source: 'A' }));
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
    const trace = replay(doc('bellman-ford', { graph: negative, source: 's' }));
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
    const trace = replay(doc('bellman-ford', { graph: cycle, source: 's' }));
    const g = stateOf(trace, 'g', 'graph');
    expect(Object.values(g.marks.edgeMarks)).toContain('rejected');
  });
});

describe('minimum spanning trees', () => {
  it.each([
    ['prim', (graph: GraphInput) => doc('prim', { graph, root: 'A' })],
    ['kruskal', (graph: GraphInput) => doc('kruskal', { graph })],
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
    const trace = replay(doc('topological-sort', { graph: dag }));
    const order = stateOf(trace, 'order', 'array').data.map((e) =>
      String(e.value),
    );
    expect([...order].sort()).toEqual([...dag.nodes].sort());
    for (const [u, v] of dag.edges)
      expect(order.indexOf(u)).toBeLessThan(order.indexOf(v));
  });
  it('refuses a graph with a cycle, naming it', () => {
    expect(
      runError('topological-sort', {
        graph: {
          directed: true,
          nodes: ['a', 'b', 'c'],
          edges: [
            ['a', 'b'],
            ['b', 'c'],
            ['c', 'b'],
          ],
        },
      }),
    ).toEqual({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message:
        'The graph has a cycle, b → c → b, so it has no topological order',
    });
  });

  it('puts each vertex at the front of the list as it finishes', () => {
    const d = doc('topological-sort', { graph: dag });
    const finishes = d.steps.filter((s) => s.meta?.id === 'finish').length;
    expect(finishes).toBe(dag.nodes.length);
    const order = stateOf(replay(d), 'order', 'array').data.map((e) => e.value);
    // The first vertex to finish ends up last.
    const first = d.steps.find((s) => s.meta?.id === 'finish')!;
    expect(first.meta!.narration).toContain(`put ${String(order.at(-1))} at`);
  });
});

describe('parallel edges', () => {
  const multi: GraphInput = {
    nodes: ['A', 'B', 'C'],
    edges: [
      ['A', 'B', 5],
      ['A', 'B', 2],
      ['B', 'C', 1],
    ],
  };
  it('keeps each edge distinct and uses the lighter one', () => {
    const g = stateOf(
      replay(doc('dijkstra', { graph: multi, source: 'A' })),
      'g',
      'graph',
    );
    expect(g.data.edges.map((e) => e.id)).toEqual(['A-B', 'A-B.2', 'B-C']);
    expect(notes(g)['C']).toBe('3');
    expect(selected(g).sort()).toEqual(['A-B.2', 'B-C']);
  });
  it('does not reuse a node name as an edge id', () => {
    const named: GraphInput = { nodes: ['A', 'B', 'A-B'], edges: [['A', 'B']] };
    const g = stateOf(
      replay(doc('bfs', { graph: named, source: 'A' })),
      'g',
      'graph',
    );
    expect(g.data.edges.map((e) => e.id)).toEqual(['A-B.2']);
  });
  it('runs every graph module', () => {
    for (const [id, input] of [
      ['bfs', { graph: multi, source: 'A' }],
      ['dfs', { graph: multi }],
      ['bellman-ford', { graph: multi, source: 'A' }],
      ['prim', { graph: multi, root: 'A' }],
      ['kruskal', { graph: multi }],
      ['topological-sort', { graph: { ...multi, directed: true } }],
      ['floyd-warshall', { graph: multi }],
    ] as const)
      replay(doc(id, input));
    const k = stateOf(replay(doc('kruskal', { graph: multi })), 'g', 'graph');
    expect(weightOf(k, selected(k))).toBe(3);
  });
});

describe('input checks', () => {
  it('rejects a start node that is not in the graph', () => {
    for (const [id, input] of [
      ['bfs', { graph: withIsland, source: 'Z' }],
      ['dijkstra', { graph: weighted, source: 'Z' }],
      ['prim', { graph: weighted, root: 'Z' }],
    ] as const)
      expect(runError(id, input)).toEqual({
        code: 'INVALID_ARGUMENT',
        path: '$.input',
        message: '"Z" is not a node of the graph',
      });
  });

  it('rejects negative weights for Dijkstra', () => {
    const graph: GraphInput = {
      directed: true,
      nodes: ['A', 'B', 'C'],
      edges: [
        ['A', 'B', 1],
        ['A', 'C', 2],
        ['C', 'B', -5],
      ],
    };
    expect(runError('dijkstra', { graph, source: 'A' }).message).toBe(
      'Dijkstra’s algorithm needs non-negative weights; use bellman-ford for negative ones',
    );
  });

  it('rejects node names that cannot be ids, repeated nodes and stray edges', () => {
    for (const [graph, message] of [
      [
        { nodes: ['a b'], edges: [] },
        'Node name "a b" must be 1 to 24 letters, digits or _ . : -',
      ],
      [{ nodes: ['a', 'a'], edges: [] }, 'Node "a" is listed twice'],
      [
        { nodes: ['a'], edges: [['a', 'z']] },
        'Edge a–z ends at "z", which is not a node',
      ],
    ] as const)
      expect(runError('dfs', { graph }).message).toBe(message);
    expect(runError('dfs', { graph: { nodes: [], edges: [] } }).path).toBe(
      '$.input.graph.nodes',
    );
  });
});

describe('weights', () => {
  it('narrates a negative self-loop with the distance before it improves', () => {
    const d = doc('bellman-ford', {
      graph: {
        directed: true,
        nodes: ['A', 'B'],
        edges: [
          ['A', 'A', -1],
          ['A', 'B', 2],
        ],
      },
      source: 'A',
    });
    const first = d.steps.find((s) => s.meta?.id === 'improve')!;
    expect(first.meta!.narration).toBe(
      '0 − 1 = -1 improves A to -1, through A.',
    );
  });

  it('takes weights up to 1e9 either way, so sums stay finite', () => {
    const cycle = {
      directed: true,
      nodes: ['A', 'B'],
      edges: [
        ['A', 'B', -1e9],
        ['B', 'A', -1e9],
      ],
    };
    expect(runOk('floyd-warshall', { graph: cycle }).document).toBeDefined();
    expect(
      runError('floyd-warshall', {
        graph: { ...cycle, edges: [['A', 'B', -1e308]] },
      }).path,
    ).toBe('$.input.graph.edges[0][2]');
  });
});

describe('procedures of CLRS', () => {
  it('dijkstra extracts an unreachable vertex with ∞ and relaxes nothing from it', () => {
    const d = doc('dijkstra', { graph: withIsland, source: '1' });
    const extracted = d.steps.filter((s) => s.meta?.id === 'extract');
    expect(extracted).toHaveLength(6);
    expect(extracted.at(-1)!.meta!.narration).toContain('∞');
    expect(ids(d).at(-1)).toBe('done');
  });

  it('bellman-ford runs all |V| - 1 rounds', () => {
    const d = doc('bellman-ford', { graph: weighted, source: 'A' });
    expect(ids(d).filter((x) => x === 'round')).toHaveLength(5);
    expect(ids(d).slice(-2)).toEqual(['check', 'done']);
  });

  it('prim starts a new tree for an unreachable vertex, giving a forest', () => {
    const d = doc('prim', { graph: withIsland, root: '1' });
    const g = stateOf(replay(d), 'g', 'graph');
    expect(selected(g)).toHaveLength(4);
    expect(g.marks.settled).toHaveLength(6);
  });

  it('kruskal unites by rank in a forest beside the graph', () => {
    const d = doc('kruskal', { graph: weighted });
    const sets = stateOf(replay(d), 'sets', 'tree');
    expect(sets.data.roots).toHaveLength(1);
    expect(Object.values(sets.marks.notes)).toContain('rank 2');
    expect(ids(d).filter((x) => x === 'take')).toHaveLength(5);
    expect(ids(d).filter((x) => x === 'skip')).toHaveLength(4);
  });

  it('dfs starts a tree at each vertex not reached yet', () => {
    const d = doc('dfs', { graph: withIsland });
    expect(ids(d).filter((x) => x === 'root')).toHaveLength(2);
  });
});

describe('floydWarshall', () => {
  it('shows a negative cycle on the diagonal', () => {
    const graph: GraphInput = {
      directed: true,
      nodes: ['a', 'b', 'c'],
      edges: [
        ['a', 'b', 1],
        ['b', 'c', -2],
        ['c', 'a', -1],
      ],
    };
    const trace = replay(doc('floyd-warshall', { graph }));
    const table = stateOf(trace, 'dist', 'table');
    expect(table.data.some((row, i) => (row[i] as number) < 0)).toBe(true);
    expect(trace.visualization.steps.at(-1)?.meta?.narration).toContain(
      'negative-weight cycle',
    );
  });

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
    const trace = replay(doc('floyd-warshall', { graph }));
    const table = stateOf(trace, 'dist', 'table');
    graph.nodes.forEach((s, i) => {
      const d = reference(graph, s);
      graph.nodes.forEach((t, j) => expect(table.data[i]![j]).toBe(d.get(t)));
    });
  });
});
