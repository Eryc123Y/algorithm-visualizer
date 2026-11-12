/**
 * Shortest paths in a DAG against Bellman–Ford, a different method, on
 * random acyclic graphs with negative weights: the distances drawn, the
 * marked edges forming a shortest-path tree, and the refusal of cycles.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Edge = [string, string, number];

/** Distances by Bellman–Ford, ∞ where unreachable. */
function bellmanFord(
  nodes: readonly string[],
  edges: readonly Edge[],
  s: string,
) {
  const d = new Map(nodes.map((v) => [v, v === s ? 0 : Infinity]));
  for (let i = 1; i < nodes.length; i++)
    for (const [u, v, w] of edges)
      if (d.get(u)! + w < d.get(v)!) d.set(v, d.get(u)! + w);
  return d;
}

/** Random DAGs: edges only from earlier to later nodes. */
const dags = fc.integer({ min: 1, max: 10 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    // An edge from an earlier node to a later one; none with one node.
    edges:
      n === 1
        ? fc.constant([] as Edge[])
        : fc
            .uniqueArray(
              fc
                .tuple(
                  fc.nat(n - 2),
                  fc.nat(n - 2),
                  fc.integer({ min: -9, max: 9 }),
                )
                .map(([a, k, w]) => [a, a + 1 + (k % (n - 1 - a)), w] as const),
              { maxLength: 24, selector: ([a, b]) => `${a} ${b}` },
            )
            .map((es) =>
              es.map(([a, b, w]): Edge => [nodes[a]!, nodes[b]!, w]),
            ),
    // Listed in a shuffled order, so the input is not already sorted.
    order: fc.shuffledSubarray(nodes, { minLength: n, maxLength: n }),
  });
});

/** A distance as the module notes it. */
const note = (d: number) =>
  d === Infinity ? '∞' : d < 0 ? `−${-d}` : String(d);

describe('dag-shortest-paths', () => {
  it('finds CLRS’s distances from s', () => {
    const { document } = runOk('dag-shortest-paths', {
      graph:
        'r->s 5, r->t 3, s->t 2, s->x 6, t->x 7, t->y 4, t->z 2, x->y -1, x->z 1, y->z -2',
      source: 's',
    });
    const notes = stateOf(replay(document), 'g', 'graph').marks.notes;
    expect(notes).toEqual({ r: '∞', s: '0', t: '2', x: '6', y: '5', z: '3' });
  });

  it('agrees with Bellman–Ford on random DAGs', () => {
    fc.assert(
      fc.property(dags, ({ nodes, edges, order }) => {
        const s = order[0]!;
        const want = bellmanFord(nodes, edges, s);
        const { document } = runOk('dag-shortest-paths', {
          graph: { directed: true, nodes: order, edges },
          source: s,
        });
        const g = stateOf(replay(document), 'g', 'graph');
        for (const v of nodes) {
          const d = want.get(v)!;
          expect(g.marks.notes[v], v).toBe(note(d));
        }
        // One marked edge into each reachable vertex but the source,
        // and each is tight.
        const marked = g.data.edges.filter(
          (e) => g.marks.edgeMarks[e.id] === 'selected',
        );
        expect(marked.length).toBe(
          nodes.filter((v) => v !== s && want.get(v) !== Infinity).length,
        );
        for (const e of marked)
          expect(want.get(e.from)! + Number(e.weight)).toBe(want.get(e.to));
      }),
      fuzz,
    );
  });

  it('takes the lighter of parallel edges, from a source in the middle', () => {
    const { document } = runOk('dag-shortest-paths', {
      graph: 'a->b 3, a->b 1, b->c 2, c->d -5',
      source: 'b',
    });
    const g = stateOf(replay(document), 'g', 'graph');
    expect(g.marks.notes).toEqual({ a: '∞', b: '0', c: '2', d: '−3' });
  });

  it('keeps long sums and decimals readable', () => {
    const chain = Array.from(
      { length: 39 },
      (_, k) => `n${k}->n${k + 1} -1000000000`,
    );
    const long = stateOf(
      replay(runOk('dag-shortest-paths', { graph: chain.join(', ') }).document),
      'g',
      'graph',
    );
    expect(long.marks.notes['n39']).toBe('−39000000000');
    const decimals = stateOf(
      replay(
        runOk('dag-shortest-paths', { graph: 'a->b 0.1, b->c 0.2' }).document,
      ),
      'g',
      'graph',
    );
    expect(decimals.marks.notes['c']).toBe('0.3');
  });

  it('refuses a graph with a cycle, naming it', () => {
    expect(
      runError('dag-shortest-paths', { graph: 'a->b 1, b->c 1, c->a 1' })
        .message,
    ).toMatch(/cycle/);
  });
});
