/**
 * Property tests of the recipes (recipe-properties.ts): Graphs: search, shortest paths and spanning trees.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/graphs.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runError, runOk, stateOf } from '../helpers.ts';
import { recipe, runs, TIMEOUT } from '../recipe-properties.ts';
import {
  parents,
  graphs,
  withStart,
  nonNegative,
  anyWeight,
  shortest,
  reachable,
  own,
  selected,
  weightOf,
  isForest,
  msfWeight,
  shown,
  steps,
  componentCount,
} from './shared.ts';

recipe(
  'bfs',
  withStart(graphs(nonNegative, { minNodes: 1 })),
  ([graph, source], locale) => runOk('bfs', { graph, source }, locale).document,
  (trace, [g, start]) => {
    const state = stateOf(trace, 'g', 'graph');
    const hops = shortest(
      { ...g, edges: g.edges.map(([u, v]) => [u, v]) },
      start,
    );
    for (const v of g.nodes)
      expect(own(state.marks.notes, v)).toBe(
        hops.d.get(v) === Infinity ? undefined : String(hops.d.get(v)),
      );
    const reached = reachable(g, start);
    expect([...state.marks.settled].sort()).toEqual([...reached].sort());
    expect(selected(state)).toHaveLength(reached.size - 1);
    // Tree edges go from one layer to the next.
    for (const e of selected(state)) {
      const [a, b] = [hops.d.get(e.from)!, hops.d.get(e.to)!];
      expect(g.directed ? b - a : Math.abs(b - a), e.id).toBe(1);
    }
    expect(stateOf(trace, 'queue', 'queue').data).toEqual([]);
  },
);

recipe(
  'dfs',
  graphs(nonNegative, { minNodes: 1 }),
  (graph, locale) => runOk('dfs', { graph }, locale).document,
  (trace, g) => {
    const state = stateOf(trace, 'g', 'graph');
    const times = Object.entries(state.marks.notes).map(([v, t]) => {
      const [d, f] = t.split('/').map(Number);
      return { v, d: d!, f: f! };
    });
    // Every vertex gets two distinct times, 1 to 2n.
    expect(times.map((t) => t.v).sort()).toEqual([...g.nodes].sort());
    expect(times.flatMap((t) => [t.d, t.f]).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 2 * g.nodes.length }, (_, k) => k + 1),
    );
    for (const a of times)
      for (const b of times)
        expect(a.f < b.d || b.f < a.d || a.d < b.d === b.f < a.f).toBe(true);
    // One tree per root step: n - roots tree edges.
    const tree = selected(state);
    expect(tree).toHaveLength(g.nodes.length - steps(trace, 'root'));
    expect(isForest(tree)).toBe(true);
    // A tree edge joins a parent to a child discovered and finished inside
    // the parent's interval; in directed graphs it points to the child.
    const time = new Map(times.map((t) => [t.v, t]));
    for (const e of tree) {
      const [from, to] = [time.get(e.from)!, time.get(e.to)!];
      const [p, c] = g.directed || from.d < to.d ? [from, to] : [to, from];
      expect(p.d < c.d && c.f < p.f, e.id).toBe(true);
    }
    // A root is never reachable from an earlier root.
    expect(state.marks.settled).toHaveLength(g.nodes.length);
    expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
  },
);

recipe(
  'dijkstra',
  withStart(graphs(nonNegative, { minNodes: 1 })),
  ([graph, source], locale) =>
    runOk('dijkstra', { graph, source }, locale).document,
  (trace, [g, start]) => {
    const state = stateOf(trace, 'g', 'graph');
    const { d } = shortest(g, start);
    for (const v of g.nodes)
      expect(own(state.marks.notes, v)).toBe(shown(d.get(v)!));
    // Selected edges form a shortest-path tree.
    const reached = g.nodes.filter((v) => d.get(v) !== Infinity);
    const tree = selected(state);
    expect(tree).toHaveLength(reached.length - 1);
    for (const e of tree) {
      const w = Number(e.weight ?? 1);
      const ok =
        d.get(e.from)! + w === d.get(e.to) ||
        (!g.directed && d.get(e.to)! + w === d.get(e.from));
      expect(ok, `edge ${e.id} is on a shortest path`).toBe(true);
    }
    expect([...state.marks.settled].sort()).toEqual([...reached].sort());
    // Every vertex leaves the queue once.
    expect(steps(trace, 'extract')).toBe(g.nodes.length);
  },
);

describe('dijkstra input checks', () => {
  it(
    'refuses a negative weight',
    () => {
      fc.assert(
        fc.property(
          withStart(graphs(anyWeight, { minNodes: 1 })),
          fc.integer({ min: -100, max: -1 }),
          fc.nat(),
          ([g, source], w, at) => {
            const graph = {
              ...g,
              edges: g.edges.toSpliced(at % (g.edges.length + 1), 0, [
                g.nodes[at % g.nodes.length]!,
                source,
                w,
              ]),
            };
            expect(runError('dijkstra', { graph, source }).code).toBe(
              'INVALID_ARGUMENT',
            );
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

recipe(
  'bellman-ford',
  withStart(graphs(anyWeight, { minNodes: 1 })),
  ([graph, source], locale) =>
    runOk('bellman-ford', { graph, source }, locale).document,
  (trace, [g, start]) => {
    const state = stateOf(trace, 'g', 'graph');
    const { d, negativeCycle } = shortest(g, start, true);
    const rejected = Object.values(state.marks.edgeMarks).filter(
      (m) => m === 'rejected',
    );
    const last = trace.visualization.steps.at(-1)?.meta?.narration ?? '';
    // Every one of the |V| - 1 rounds is shown.
    expect(steps(trace, 'round')).toBe(g.nodes.length - 1);
    if (negativeCycle) {
      expect(rejected).toHaveLength(1);
      expect(last).toContain('negative-weight cycle');
    } else {
      expect(rejected).toEqual([]);
      for (const v of g.nodes)
        expect(own(state.marks.notes, v)).toBe(shown(d.get(v)!));
      expect([...state.marks.settled].sort()).toEqual(
        g.nodes.filter((v) => d.get(v) !== Infinity).sort(),
      );
      const tree = selected(state);
      expect(tree).toHaveLength(
        g.nodes.filter((v) => v !== start && d.get(v) !== Infinity).length,
      );
      for (const e of tree)
        expect(d.get(e.from)! + Number(e.weight ?? 1)).toBe(d.get(e.to));
    }
  },
);

recipe(
  'prim',
  withStart(graphs(anyWeight, { minNodes: 1 })),
  ([graph, root], locale) => runOk('prim', { graph, root }, locale).document,
  (trace, g) => {
    const graph = g[0];
    const state = stateOf(trace, 'g', 'graph');
    const tree = selected(state);
    // A spanning forest: one tree per component.
    expect(tree).toHaveLength(graph.nodes.length - componentCount(graph));
    expect(isForest(tree)).toBe(true);
    expect(weightOf(tree)).toBe(msfWeight(graph, new Set(graph.nodes)));
    expect([...state.marks.settled].sort()).toEqual([...graph.nodes].sort());
  },
);

recipe(
  'kruskal',
  graphs(anyWeight, { minNodes: 1 }),
  (graph, locale) => runOk('kruskal', { graph }, locale).document,
  (trace, g) => {
    const state = stateOf(trace, 'g', 'graph');
    const tree = selected(state);
    expect(tree).toHaveLength(g.nodes.length - componentCount(g));
    expect(isForest(tree)).toBe(true);
    expect(weightOf(tree)).toBe(msfWeight(g, new Set(g.nodes)));
    // Every other edge was considered and rejected.
    expect(Object.keys(state.marks.edgeMarks)).toHaveLength(g.edges.length);
    // The disjoint-set forest has one tree per component.
    const sets = stateOf(trace, 'sets', 'tree');
    const parent = parents(sets);
    const root = (id: string): string =>
      parent.has(id) ? root(parent.get(id)!) : id;
    for (const u of g.nodes) {
      const component = reachable(g, u, false);
      for (const v of g.nodes)
        expect(root(u) === root(v), `${u} and ${v}`).toBe(component.has(v));
    }
  },
);
