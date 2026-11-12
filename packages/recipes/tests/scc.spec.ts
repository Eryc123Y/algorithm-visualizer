/**
 * Strongly connected components against Tarjan's algorithm, a different
 * method (one search with low links), on random directed graphs: the
 * same partition, drawn as groups, with every component listed.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** The components by Tarjan's algorithm, each sorted, sorted by first. */
function tarjan(nodes: readonly string[], edges: readonly [string, string][]) {
  const adj = new Map(nodes.map((v) => [v, [] as string[]]));
  for (const [a, b] of edges) adj.get(a)!.push(b);
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[][] = [];
  const strong = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    on.add(v);
    for (const w of adj.get(v)!) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const c: string[] = [];
      for (let w = ''; w !== v;) {
        w = stack.pop()!;
        on.delete(w);
        c.push(w);
      }
      out.push(c.sort());
    }
  };
  for (const v of nodes) if (!idx.has(v)) strong(v);
  return out.sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
}

const graphs = fc.integer({ min: 1, max: 10 }).chain((n) => {
  const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
  return fc.record({
    nodes: fc.constant(nodes),
    edges: fc.uniqueArray(
      fc.tuple(fc.constantFrom(...nodes), fc.constantFrom(...nodes)),
      { maxLength: 24, selector: ([a, b]) => `${a} ${b}` },
    ),
  });
});

describe('strongly connected components', () => {
  it('splits CLRS’s example into its four components', () => {
    const { document, results } = runOk('strongly-connected-components', {
      graph:
        'a->b, b->c, b->e, b->f, c->d, c->g, d->c, d->h, e->a, e->f, f->g, g->f, g->h, h->h',
    });
    expect(results).toEqual([4]);
    const list = stateOf(replay(document), 'components', 'array').data.map(
      (e) => String(e.value).split(' ').sort().join(' '),
    );
    expect(list.sort()).toEqual(['a b e', 'c d', 'f g', 'h']);
  });

  it('agrees with Tarjan’s algorithm on random graphs', () => {
    fc.assert(
      fc.property(graphs, ({ nodes, edges }) => {
        const want = tarjan(nodes, edges);
        const { document, results } = runOk('strongly-connected-components', {
          graph: { directed: true, nodes, edges },
        });
        expect(results).toEqual([want.length]);
        // Drawn: every vertex coloured, one colour per component (the six
        // colours repeat after six components).
        const g = stateOf(replay(document), 'g', 'graph');
        const groupOf = new Map(Object.entries(g.marks.groups ?? {}));
        expect(groupOf.size).toBe(nodes.length);
        for (const c of want)
          expect(new Set(c.map((v) => groupOf.get(v))).size).toBe(1);
      }),
      fuzz,
    );
  });

  it('refuses a graph it cannot read', () => {
    expect(
      runError('strongly-connected-components', { graph: 'a->b, b->' }).code,
    ).toBe('INVALID_NOTATION');
  });
});
