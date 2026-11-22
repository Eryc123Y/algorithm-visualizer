/**
 * Property tests of the recipes (recipe-properties.ts): Graphs: components, closure, flow, matching and all pairs.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/graphs-more.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runAlgorithm } from '../../src/index.ts';
import { runError, runOk, stateOf } from '../helpers.ts';
import { recipe, runs, TIMEOUT } from '../recipe-properties.ts';
import {
  valuesOf,
  nodeName,
  graphs,
  withStart,
  nonNegative,
  anyWeight,
  shortest,
  steps,
} from './shared.ts';

recipe(
  'topological-sort',
  graphs(nonNegative, { minNodes: 1, dag: true }),
  (graph, locale) => runOk('topological-sort', { graph }, locale).document,
  (trace, g) => {
    const order = valuesOf(trace, 'order').map(String);
    expect([...order].sort()).toEqual([...g.nodes].sort());
    for (const [u, v] of g.edges)
      expect(order.indexOf(u), `${u}→${v}`).toBeLessThan(order.indexOf(v));
    // Each vertex goes to the front as it finishes.
    expect(steps(trace, 'finish')).toBe(g.nodes.length);
  },
);

recipe(
  'dag-shortest-paths',
  withStart(graphs(anyWeight, { minNodes: 1, dag: true })),
  ([graph, source], locale) =>
    runOk('dag-shortest-paths', { graph, source }, locale).document,
  (trace, [g, s]) => {
    // Each reachable vertex has its turn once, and its distance is
    // annotated; the source's is 0.
    expect(steps(trace, 'vertex')).toBe(g.nodes.length);
    expect(stateOf(trace, 'g', 'graph').marks.notes[s]).toBe('0');
  },
);

recipe(
  'strongly-connected-components',
  graphs(nonNegative, { minNodes: 1 }),
  (graph, locale) =>
    runOk('strongly-connected-components', { graph }, locale).document,
  (trace, g) => {
    // Every vertex is in exactly one listed component.
    const listed = valuesOf(trace, 'components').map(String);
    const counted = listed.reduce(
      (n, c) =>
        n +
        (c.includes('…')
          ? Number(/\((\d+)\)/.exec(c)![1])
          : c.split(' ').length),
      0,
    );
    expect(counted).toBe(g.nodes.length);
    expect(steps(trace, 'assign')).toBe(g.nodes.length);
    expect(steps(trace, 'finish')).toBe(g.nodes.length);
  },
);

recipe(
  'johnson',
  fc
    .tuple(
      fc.integer({ min: 1, max: 8 }),
      fc.array(
        fc.tuple(fc.nat(7), fc.nat(7), fc.integer({ min: -3, max: 9 })),
        { maxLength: 16 },
      ),
    )
    .map(([n, raw]) => {
      const nodes = Array.from({ length: n }, (_, k) => `v${k}`);
      const seen = new Set<string>();
      const edges = raw.flatMap(([a, b, w]): [string, string, number][] => {
        const key = `${a % n} ${b % n}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [[nodes[a % n]!, nodes[b % n]!, w]];
      });
      return { directed: true, nodes, edges };
    }),
  (graph, locale) => runOk('johnson', { graph }, locale).document,
  (trace, g) => {
    // Either a negative cycle is reported, or every row of D is filled
    // with 0 on its diagonal.
    const rows = steps(trace, 'row');
    if (rows === 0) expect(steps(trace, 'cycle')).toBe(1);
    else {
      expect(rows).toBe(g.nodes.length);
      const D = stateOf(trace, 'D', 'table').data;
      g.nodes.forEach((_, i) => expect(D[i]![i]).toBe('0'));
    }
  },
);

recipe(
  'transitive-closure',
  graphs(nonNegative, { minNodes: 1 }),
  (graph, locale) => runOk('transitive-closure', { graph }, locale).document,
  (trace, g) => {
    // The diagonal is 1, and every edge's entry is 1.
    const t = stateOf(trace, 't', 'table').data;
    g.nodes.forEach((_, i) => expect(t[i]![i]).toBe(1));
    for (const [u, v] of g.edges)
      expect(t[g.nodes.indexOf(u)]![g.nodes.indexOf(v)]).toBe(1);
  },
);

recipe(
  'edmonds-karp',
  graphs(
    fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined, freq: 4 }),
    { minNodes: 2 },
  ),
  (graph, locale) => runOk('edmonds-karp', { graph }, locale).document,
  (trace) => {
    // Every edge ends with a flow within its capacity.
    for (const e of stateOf(trace, 'g', 'graph').data.edges) {
      const [f, c] = String(e.weight).split('/').map(Number);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(c!);
    }
  },
);

recipe(
  'bipartite-matching',
  fc
    .tuple(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
      fc.array(fc.tuple(fc.nat(7), fc.nat(7), fc.boolean()), {
        maxLength: 20,
      }),
      fc.nat(),
    )
    .map(([l, r, raw, turn]) => {
      // Nodes rotated, so a right vertex may come first; edges either way
      // round, parallel ones kept.
      const listed = [
        ...Array.from({ length: l }, (_, k) => `l${k}`),
        ...Array.from({ length: r }, (_, k) => `r${k}`),
      ];
      const t = turn % listed.length;
      const nodes = [...listed.slice(t), ...listed.slice(0, t)];
      const edges = raw.map(([a, b, flip]): [string, string] =>
        flip ? [`r${b % r}`, `l${a % l}`] : [`l${a % l}`, `r${b % r}`],
      );
      return { nodes, edges };
    }),
  (graph, locale) => runOk('bipartite-matching', { graph }, locale).document,
  (trace) => {
    // The marked edges share no vertex.
    const g = stateOf(trace, 'g', 'graph');
    const ends = g.data.edges
      .filter((e) => g.marks.edgeMarks[e.id] === 'selected')
      .flatMap((e) => [e.from, e.to]);
    expect(new Set(ends).size).toBe(ends.length);
  },
);

// The same graphs as bipartite matching.
recipe(
  'hopcroft-karp',
  fc
    .tuple(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
      fc.array(fc.tuple(fc.nat(7), fc.nat(7), fc.boolean()), {
        maxLength: 20,
      }),
      fc.nat(),
    )
    .map(([l, r, raw, turn]) => {
      // Nodes rotated, so a right vertex may come first; edges either way
      // round, parallel ones kept.
      const listed = [
        ...Array.from({ length: l }, (_, k) => `l${k}`),
        ...Array.from({ length: r }, (_, k) => `r${k}`),
      ];
      const t = turn % listed.length;
      const nodes = [...listed.slice(t), ...listed.slice(0, t)];
      const edges = raw.map(([a, b, flip]): [string, string] =>
        flip ? [`r${b % r}`, `l${a % l}`] : [`l${a % l}`, `r${b % r}`],
      );
      return { nodes, edges };
    }),
  (graph, locale) => runOk('hopcroft-karp', { graph }, locale).document,
  (trace) => {
    // The marked edges share no vertex, and no note is left at the end.
    const g = stateOf(trace, 'g', 'graph');
    const ends = g.data.edges
      .filter((e) => g.marks.edgeMarks[e.id] === 'selected')
      .flatMap((e) => [e.from, e.to]);
    expect(new Set(ends).size).toBe(ends.length);
    expect(Object.keys(g.marks.notes)).toEqual([]);
  },
);

recipe(
  'gale-shapley',
  fc.integer({ min: 1, max: 6 }).chain((n) => {
    const ps = Array.from({ length: n }, (_, k) => `p${k}`);
    const rs = Array.from({ length: n }, (_, k) => `r${k}`);
    const ranking = (names: string[]) =>
      fc.shuffledSubarray(names, { minLength: n });
    return fc.record({
      proposers: fc
        .tuple(...ps.map(() => ranking(rs)))
        .map((ls) => ps.map((p, k): [string, string[]] => [p, ls[k]!])),
      receivers: fc
        .tuple(...rs.map(() => ranking(ps)))
        .map((ls) => rs.map((r, k): [string, string[]] => [r, ls[k]!])),
    });
  }),
  (input, locale) => runOk('gale-shapley', input, locale).document,
  (trace, input) => {
    // Everyone ends engaged, once, and only engagements are drawn.
    const g = stateOf(trace, 'g', 'graph');
    const ends = g.data.edges.flatMap((e) => {
      expect(g.marks.edgeMarks[e.id]).toBe('selected');
      return [e.from, e.to];
    });
    expect(new Set(ends).size).toBe(2 * input.proposers.length);
  },
);

recipe(
  'hungarian',
  fc.integer({ min: 1, max: 6 }).chain((n) =>
    fc.array(
      fc.array(fc.integer({ min: -30, max: 30 }), {
        minLength: n,
        maxLength: n,
      }),
      { minLength: n, maxLength: n },
    ),
  ),
  (weights, locale) => runOk('hungarian', { weights }, locale).document,
  (trace, weights) => {
    // A perfect matching, weighing as much as the labels add up to.
    const g = stateOf(trace, 'g', 'graph');
    const matched = g.data.edges.filter(
      (e) => g.marks.edgeMarks[e.id] === 'selected',
    );
    expect(matched).toHaveLength(weights.length);
    const at = (v: string) => 'abcdefpqrstu'.indexOf(v) % 6;
    const weight = matched.reduce(
      (s, e) => s + weights[at(e.from)]![at(e.to)]!,
      0,
    );
    const labels = Object.values(g.marks.notes).reduce(
      (s, x) => s + Number(x.replace('−', '-')),
      0,
    );
    expect(weight).toBe(labels);
  },
);

describe('topological-sort input checks', () => {
  it(
    'refuses a graph with a cycle, and only such a graph',
    () => {
      fc.assert(
        fc.property(graphs(nonNegative, { minNodes: 1 }), (g) => {
          // Reference: Kahn's algorithm places every vertex iff acyclic.
          const indeg = new Map(g.nodes.map((v) => [v, 0]));
          for (const [, v] of g.edges) indeg.set(v, indeg.get(v)! + 1);
          const placed = new Set<string>();
          for (let grew = true; grew;) {
            grew = false;
            for (const v of g.nodes)
              if (!placed.has(v) && indeg.get(v) === 0) {
                placed.add(v);
                for (const [u, w] of g.edges)
                  if (u === v) indeg.set(w, indeg.get(w)! - 1);
                grew = true;
              }
          }
          const run = runAlgorithm('topological-sort', { graph: g });
          expect(run.ok).toBe(placed.size === g.nodes.length);
          if (!run.ok)
            expect(run.error[0]!.message).toMatch(/^The graph has a cycle, /);
        }),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

recipe(
  'floyd-warshall',
  graphs(anyWeight, { minNodes: 1 }),
  (graph, locale) => runOk('floyd-warshall', { graph }, locale).document,
  (trace, g) => {
    const table = stateOf(trace, 'dist', 'table');
    const n = g.nodes.length;
    const last = trace.visualization.steps.at(-1)?.meta?.narration ?? '';
    // Any negative cycle, reachable from anywhere.
    const negative = g.nodes.some((s) => shortest(g, s).negativeCycle);
    const diagonal = g.nodes.map((_, i) => table.data[i]![i] as number);
    // The entries it skips cannot change: the table is what the plain
    // triple loop, updating in place, gives.
    const index = new Map(g.nodes.map((v, k) => [v, k]));
    const plain = g.nodes.map((_, i) =>
      g.nodes.map((_, j) => (i === j ? 0 : Infinity)),
    );
    for (const [u, v, w = 1] of g.edges) {
      const [i, j] = [index.get(u)!, index.get(v)!];
      plain[i]![j] = Math.min(plain[i]![j]!, w);
      if (!g.directed) plain[j]![i] = Math.min(plain[j]![i]!, w);
    }
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (plain[i]![k]! + plain[k]![j]! < plain[i]![j]!)
            plain[i]![j] = plain[i]![k]! + plain[k]![j]!;
    expect(table.data).toEqual(
      plain.map((row) => row.map((x) => (x === Infinity ? '∞' : x))),
    );
    if (negative) {
      expect(diagonal.some((x) => x < 0)).toBe(true);
      expect(last).toContain('negative-weight cycle');
    } else {
      expect(diagonal).toEqual(Array<number>(n).fill(0));
      g.nodes.forEach((s, i) => {
        const { d } = shortest(g, s);
        g.nodes.forEach((t, j) =>
          expect(table.data[i]![j], `${s}→${t}`).toBe(
            d.get(t) === Infinity ? '∞' : d.get(t),
          ),
        );
      });
    }
  },
);

describe('graph input checks', () => {
  const missing = graphs(nonNegative, { minNodes: 1 }).chain((g) =>
    fc.tuple(
      fc.constant(g),
      nodeName.filter((v) => !g.nodes.includes(v)),
    ),
  );
  for (const [id, key] of [
    ['bfs', 'source'],
    ['dijkstra', 'source'],
    ['bellman-ford', 'source'],
    ['prim', 'root'],
  ] as const)
    it(
      `${id} refuses a ${key} that is not a node`,
      () => {
        fc.assert(
          fc.property(missing, ([graph, start]) => {
            expect(runError(id, { graph, [key]: start })).toMatchObject({
              code: 'INVALID_ARGUMENT',
              message: `"${start}" is not a node of the graph`,
            });
          }),
          { numRuns: runs },
        );
      },
      TIMEOUT,
    );
});
