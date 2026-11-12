/**
 * Edmonds–Karp against the max-flow min-cut theorem: the flow it finds
 * equals the least capacity of a cut, found by trying every set of
 * vertices that holds the source and not the sink. The drawn flows obey
 * capacity and conservation, and the marked cut is a minimum one.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Edge = [string, string, number];

/** The least capacity of an s–t cut, over every cut. */
function minCut(
  nodes: readonly string[],
  edges: readonly Edge[],
  s: string,
  t: string,
) {
  const others = nodes.filter((v) => v !== s && v !== t);
  let best = Infinity;
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const S = new Set([s, ...others.filter((_, k) => mask & (1 << k))]);
    const c = edges.reduce(
      (sum, [a, b, w]) => sum + (S.has(a) && !S.has(b) ? w : 0),
      0,
    );
    best = Math.min(best, c);
  }
  return best;
}

const networks = fc.integer({ min: 2, max: 7 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    edges: fc
      .uniqueArray(
        fc.tuple(
          fc.constantFrom(...nodes),
          fc.constantFrom(...nodes),
          fc.integer({ min: 0, max: 9 }),
        ),
        { maxLength: 16, selector: ([a, b]) => `${a} ${b}` },
      )
      .map((es) => es as Edge[]),
  });
});

describe('edmonds-karp', () => {
  it('finds CLRS’s maximum flow of 23', () => {
    const { results } = runOk('edmonds-karp', {
      graph:
        's->v1 16, s->v2 13, v1->v3 12, v2->v1 4, v2->v4 14, v3->v2 9, v3->t 20, v4->v3 7, v4->t 4',
      source: 's',
      sink: 't',
    });
    expect(results).toEqual([23]);
  });

  it('finds a flow as large as the least cut, and draws a valid flow', () => {
    fc.assert(
      fc.property(networks, ({ nodes, edges }) => {
        const [s, t] = [nodes[0]!, nodes.at(-1)!];
        const want = minCut(nodes, edges, s, t);
        const { document, results } = runOk('edmonds-karp', {
          graph: { directed: true, nodes, edges },
          source: s,
          sink: t,
        });
        expect(results).toEqual([want]);
        const g = stateOf(replay(document), 'g', 'graph');
        // Each edge shows f/c with 0 ≤ f ≤ c, and flow is conserved.
        const net = new Map(nodes.map((v) => [v, 0]));
        for (const e of g.data.edges) {
          const [f, c] = String(e.weight).split('/').map(Number);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(c!);
          net.set(e.from, net.get(e.from)! - f!);
          net.set(e.to, net.get(e.to)! + f!);
        }
        for (const v of nodes)
          if (v !== s && v !== t) expect(net.get(v), v).toBe(0);
        expect(net.get(t)).toBe(want);
        // The marked edges leave the cut and add up to the flow.
        const cut = g.data.edges
          .filter((e) => g.marks.edgeMarks[e.id] === 'selected')
          .reduce((sum, e) => sum + Number(String(e.weight).split('/')[1]), 0);
        expect(cut).toBe(want);
      }),
      fuzz,
    );
  });

  it('refuses capacities that are not whole numbers, and a sink that is the source', () => {
    expect(runError('edmonds-karp', { graph: 'a->b 1.5' }).message).toMatch(
      /whole numbers/,
    );
    expect(
      runError('edmonds-karp', { graph: 'a->b 1', source: 'a', sink: 'a' })
        .message,
    ).toMatch(/different/);
  });
});
