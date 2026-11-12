/**
 * Transitive closure against reachability found by a breadth-first search
 * from each vertex, a different method, on random directed graphs: the
 * final table, the count of pairs, and one step for each entry that
 * becomes 1.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runOk, stateOf } from './helpers.ts';

/** reach[i][j]: 1 if a path leads from i to j, by BFS from each vertex. */
function reachability(
  nodes: readonly string[],
  edges: readonly [string, string][],
) {
  const out = new Map(nodes.map((v) => [v, [] as string[]]));
  for (const [a, b] of edges) out.get(a)!.push(b);
  return nodes.map((s) => {
    const seen = new Set([s]);
    const queue = [s];
    while (queue.length > 0)
      for (const v of out.get(queue.shift()!)!)
        if (!seen.has(v)) {
          seen.add(v);
          queue.push(v);
        }
    return nodes.map((v) => (seen.has(v) ? 1 : 0));
  });
}

const graphs = fc.integer({ min: 1, max: 9 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    edges: fc.uniqueArray(
      fc.tuple(fc.constantFrom(...nodes), fc.constantFrom(...nodes)),
      { maxLength: 20, selector: ([a, b]) => `${a} ${b}` },
    ),
  });
});

describe('transitive-closure', () => {
  it('finds CLRS’s closure', () => {
    const { document, results } = runOk('transitive-closure', {
      graph: '2->3, 2->4, 3->2, 4->1, 4->3, 1',
    });
    const t = stateOf(replay(document), 't', 'table').data;
    // Rows and columns in the order the nodes are first named: 2 3 4 1.
    expect(t).toEqual([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [0, 0, 0, 1],
    ]);
    expect(results).toEqual([9]);
  });

  it('takes undirected edges one way, and keeps self-loops on the diagonal', () => {
    const one = runOk('transitive-closure', {
      graph: { directed: false, nodes: ['a', 'b'], edges: [['a', 'b']] },
    });
    expect(stateOf(replay(one.document), 't', 'table').data).toEqual([
      [1, 1],
      [0, 1],
    ]);
    expect(one.results).toEqual([1]);
    const loop = runOk('transitive-closure', { graph: 'a->a, a->b' });
    expect(stateOf(replay(loop.document), 't', 'table').data).toEqual([
      [1, 1],
      [0, 1],
    ]);
  });

  it('closes a ring of 40, every vertex reaching every other', () => {
    const ring = Array.from(
      { length: 40 },
      (_, k) => `v${k}->v${(k + 1) % 40}`,
    );
    const { results } = runOk('transitive-closure', { graph: ring.join(', ') });
    expect(results).toEqual([40 * 39]);
  });

  it('agrees with a search from every vertex', () => {
    fc.assert(
      fc.property(graphs, ({ nodes, edges }) => {
        const want = reachability(nodes, edges);
        const { document, results } = runOk('transitive-closure', {
          graph: { directed: true, nodes, edges },
        });
        const trace = replay(document);
        expect(stateOf(trace, 't', 'table').data).toEqual(want);
        const pairs = want.flat().filter((x) => x === 1).length - nodes.length;
        expect(results).toEqual([pairs]);
        // One update step per entry that becomes 1 through some vertex.
        const initial = new Set([
          ...nodes.map((v) => `${v} ${v}`),
          ...edges.map(([a, b]) => `${a} ${b}`),
        ]);
        const added = want
          .flatMap((row, i) =>
            row.map((x, j) => (x === 1 ? `${nodes[i]} ${nodes[j]}` : '')),
          )
          .filter((p) => p !== '' && !initial.has(p)).length;
        expect(
          trace.visualization.steps.filter((s) => s.meta?.id === 'update')
            .length,
        ).toBe(added);
      }),
      fuzz,
    );
  });
});
