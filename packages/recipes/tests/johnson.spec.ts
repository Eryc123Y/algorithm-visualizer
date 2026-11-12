/**
 * Johnson's algorithm against Floyd–Warshall written on a plain matrix, a
 * different method, on random directed graphs with negative weights but
 * no negative cycle: the distance table, the non-negative reweighting,
 * and the report of a negative cycle.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Edge = [string, string, number];

/** All-pairs distances by Floyd–Warshall; null if a cycle is negative. */
function floyd(nodes: readonly string[], edges: readonly Edge[]) {
  const n = nodes.length;
  const at = new Map(nodes.map((v, k) => [v, k]));
  const d = nodes.map((_, i) => nodes.map((_, j) => (i === j ? 0 : Infinity)));
  for (const [a, b, w] of edges) {
    const [i, j] = [at.get(a)!, at.get(b)!];
    d[i]![j] = Math.min(d[i]![j]!, w);
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (d[i]![k]! + d[k]![j]! < d[i]![j]!) d[i]![j] = d[i]![k]! + d[k]![j]!;
  return d.some((row, i) => row[i]! < 0) ? null : d;
}

const shown = (d: number) =>
  d === Infinity ? '∞' : d < 0 ? `−${-d}` : String(d);

const graphs = fc.integer({ min: 1, max: 6 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    edges: fc
      .uniqueArray(
        fc.tuple(
          fc.constantFrom(...nodes),
          fc.constantFrom(...nodes),
          fc.integer({ min: -4, max: 9 }),
        ),
        { maxLength: 14, selector: ([a, b]) => `${a} ${b}` },
      )
      .map((es) => es as Edge[]),
  });
});

describe('johnson', () => {
  it('finds CLRS’s distances', () => {
    const { document, results } = runOk('johnson', {
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
    });
    expect(results).toEqual([true]);
    const D = stateOf(replay(document), 'D', 'table').data;
    expect(D).toEqual([
      ['0', '1', '−3', '2', '−4'],
      ['3', '0', '−4', '1', '−1'],
      ['7', '4', '0', '5', '3'],
      ['2', '−1', '−5', '0', '−2'],
      ['8', '5', '1', '6', '0'],
    ]);
  });

  it('agrees with Floyd–Warshall, and reweights to non-negative', () => {
    fc.assert(
      fc.property(graphs, ({ nodes, edges }) => {
        const want = floyd(nodes, edges);
        const { document, results } = runOk('johnson', {
          graph: { directed: true, nodes, edges },
        });
        const trace = replay(document);
        if (want === null) {
          expect(results).toEqual([false]);
          return;
        }
        expect(results).toEqual([true]);
        expect(stateOf(trace, 'D', 'table').data).toEqual(
          want.map((row) => row.map(shown)),
        );
        // After the reweighting, every weight is 0 or more.
        const g = stateOf(trace, 'g', 'graph');
        for (const e of g.data.edges)
          expect(String(e.weight).startsWith('−'), e.id).toBe(false);
      }),
      fuzz,
    );
  });

  it('takes names it would give s, parallel edges and decimals', () => {
    const names = runOk('johnson', {
      graph: {
        directed: true,
        nodes: ['s', 's1', 's:a', 'a'],
        edges: [
          ['s', 's1', -1],
          ['s1', 's:a', 2],
          ['s:a', 'a', 1],
        ],
      },
    });
    expect(stateOf(replay(names.document), 'D', 'table').data[0]).toEqual([
      '0',
      '−1',
      '1',
      '2',
    ]);
    const parallel = runOk('johnson', {
      graph: {
        directed: true,
        nodes: ['a', 'b'],
        edges: [
          ['a', 'b', 3],
          ['a', 'b', -1],
        ],
      },
    });
    expect(stateOf(replay(parallel.document), 'D', 'table').data).toEqual([
      ['0', '−1'],
      ['∞', '0'],
    ]);
    // Each edge of a bundle improves b; it is named once.
    const bundle = runOk('johnson', { graph: 'a->b 3, a->b 2, a->b 1' });
    expect(
      bundle.document.steps.map((s) => s.meta?.narration ?? '').join(' '),
    ).not.toMatch(/b, b/);
    const decimals = runOk('johnson', {
      graph: 'a->b 0.1, b->c 0.2, a->c 0.3, c->a -0.25',
    });
    const g = stateOf(replay(decimals.document), 'g', 'graph');
    for (const e of g.data.edges)
      expect(String(e.weight).startsWith('−'), e.id).toBe(false);
  });

  it('keeps every step within its action limit with 200 edges', () => {
    // 8 vertices in a ring, each edge 25 times, of weights 1 to 25 and a
    // −1 in each bundle: more new weights than one step may set.
    const nodes = Array.from({ length: 8 }, (_, k) => `v${k}`);
    const edges = nodes.flatMap((v, k) =>
      Array.from({ length: 25 }, (_, m): Edge => [
        v,
        nodes[(k + 1) % 8]!,
        m === 24 ? -1 : m + 1,
      ]),
    );
    const { document, results } = runOk('johnson', {
      graph: { directed: true, nodes, edges },
    });
    expect(results).toEqual([false]);
    const positive = edges.map(([a, b, w]): Edge => [a, b, Math.abs(w)]);
    const run = runOk('johnson', {
      graph: { directed: true, nodes, edges: positive },
    });
    for (const { steps } of [document, run.document])
      for (const step of steps)
        expect(step.actions.length).toBeLessThanOrEqual(100);
    expect(stateOf(replay(run.document), 'D', 'table').data).toEqual(
      floyd(nodes, positive)!.map((row) => row.map(shown)),
    );
  });

  it('reports a negative cycle, and refuses more than 8 vertices', () => {
    expect(runOk('johnson', { graph: 'a->b 1, b->a -2' }).results).toEqual([
      false,
    ]);
    const nine = Array.from(
      { length: 9 },
      (_, k) => `v${k}->v${(k + 1) % 9}`,
    ).join(', ');
    expect(runError('johnson', { graph: nine }).message).toMatch(/at most 8/);
  });
});
