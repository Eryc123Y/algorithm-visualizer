/**
 * Auxiliary structures (ADR 0029): what each recipe keeps besides its main
 * structure, frame by frame, against independent references, and where it
 * is placed. Dijkstra's and Prim's queue, Kruskal's sorted edges, the heap
 * view, and call stacks for the recursive procedures.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { queueOrder, type Trace } from '@algoviz/core';

import { algorithms, runAlgorithm, type GraphInput } from '../src/index.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

const traceOf = (id: string, input: unknown) =>
  replay(runOk(id, input).document);
const example = (id: string) =>
  algorithms.find((a) => a.id === id)!.examples[0];

/** The frames after the steps named `name`, in order. */
const framesOf = (trace: Trace, ...names: string[]) =>
  trace.visualization.steps.flatMap((step, k) =>
    names.includes(step.meta?.id ?? '') ? [k + 1] : [],
  );

const queueAt = (trace: Trace, frame: number) =>
  queueOrder(stateOf(trace, 'Q', 'priorityQueue', frame).data).map(
    (item) => `${item.id}:${item.key === null ? '∞' : item.key}`,
  );

const stackAt = (trace: Trace, frame: number) =>
  stateOf(trace, 'calls', 'stack', frame).data.map((e) => String(e.value));

// ---------------------------------------------------------------------------
// Graphs

const graphArb = (weights: fc.Arbitrary<number>, directed?: boolean) =>
  fc
    .uniqueArray(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G'), {
      minLength: 1,
      maxLength: 7,
    })
    .chain((nodes) =>
      fc.record({
        nodes: fc.constant(nodes),
        edges: fc.array(
          fc.tuple(
            fc.constantFrom(...nodes),
            fc.constantFrom(...nodes),
            weights,
          ),
          { maxLength: 14 },
        ),
        directed: directed === undefined ? fc.boolean() : fc.constant(directed),
      }),
    )
    .chain((g) =>
      fc.tuple(fc.constant(g as GraphInput), fc.constantFrom(...g.nodes)),
    );

/** Arcs out of each node in listed order, both ways for undirected graphs. */
function arcs(g: GraphInput): Map<string, [string, number][]> {
  const out = new Map(
    g.nodes.map((v): [string, [string, number][]] => [v, []]),
  );
  for (const [u, v, w = 1] of g.edges) {
    out.get(u)!.push([v, w]);
    if (!g.directed) out.get(v)!.push([u, w]);
  }
  return out;
}

/**
 * What a min-priority queue keyed by `key` holds after each EXTRACT-MIN,
 * front first: least key, then the vertex listed first; ∞ last. `relax`
 * updates the keys of the vertices still in the queue after `u` leaves.
 */
function queues(
  g: GraphInput,
  start: string,
  relax: (u: string, key: Map<string, number>, inQueue: Set<string>) => void,
): string[][] {
  const key = new Map(g.nodes.map((v) => [v, v === start ? 0 : Infinity]));
  const left = [...g.nodes];
  const out: string[][] = [];
  while (left.length > 0) {
    let best = 0;
    for (let k = 1; k < left.length; k++)
      if (key.get(left[k]!)! < key.get(left[best]!)!) best = k;
    const u = left.splice(best, 1)[0]!;
    const index = new Map(g.nodes.map((v, k) => [v, k]));
    out.push(
      [...left]
        .sort(
          (a, b) =>
            (key.get(a)! === key.get(b)!
              ? 0
              : key.get(a)! < key.get(b)!
                ? -1
                : 1) || index.get(a)! - index.get(b)!,
        )
        .map((v) => `${v}:${key.get(v) === Infinity ? '∞' : key.get(v)}`),
    );
    // Dijkstra relaxes nothing from ∞ (∞ + w is no improvement); Prim
    // starts a new tree there and relaxes its edges.
    relax(u, key, new Set(left));
  }
  return out;
}

const dijkstraQueues = (g: GraphInput, s: string) =>
  queues(g, s, (u, d) => {
    for (const [v, w] of arcs(g).get(u)!)
      if (d.get(u)! + w < d.get(v)!) d.set(v, d.get(u)! + w);
  });

const primQueues = (g: GraphInput, r: string) =>
  queues({ ...g, directed: false }, r, (u, key, inQueue) => {
    for (const [v, w] of arcs({ ...g, directed: false }).get(u)!)
      if (inQueue.has(v) && w < key.get(v)!) key.set(v, w);
  });

describe.each([
  ['dijkstra', 'source', dijkstraQueues, false],
  ['prim', 'root', primQueues, true],
] as const)(
  '%s keeps its min-priority queue Q',
  (id, field, reference, undirected) => {
    const check = (graph: GraphInput, start: string) => {
      const trace = traceOf(id, { graph, [field]: start });
      const g = undirected ? { ...graph, directed: false } : graph;
      const extracts = framesOf(trace, 'extract');
      expect(extracts.map((f) => queueAt(trace, f))).toEqual(
        reference(g, start),
      );
      // Every vertex is inserted in the first step, in listed order: the
      // start with key 0 in front, the others with no key yet.
      expect(queueAt(trace, 1)).toEqual([
        `${start}:0`,
        ...g.nodes.filter((v) => v !== start).map((v) => `${v}:∞`),
      ]);
      expect(queueAt(trace, trace.length)).toEqual([]);
      // An improved key moves the vertex, highlighted.
      for (const f of framesOf(
        trace,
        id === 'dijkstra' ? 'improve' : 'lighter',
      )) {
        const q = stateOf(trace, 'Q', 'priorityQueue', f);
        expect(q.marks.highlight).toHaveLength(1);
      }
      expect(trace.visualization.structures['Q']).toMatchObject({
        kind: 'priorityQueue',
        place: 'side',
      });
    };

    it('on the example', () => {
      const input = example(id) as { graph: GraphInput } & Record<
        string,
        string
      >;
      check(input.graph, input[field]!);
    });

    it('on random graphs, against a reference', () => {
      fc.assert(
        fc.property(
          graphArb(
            fc.integer({ min: 0, max: 9 }),
            undirected ? false : undefined,
          ),
          ([graph, start]) => check(graph, start),
        ),
        fuzz,
      );
    });
  },
);

describe("kruskal's edges, sorted by weight", () => {
  const check = (graph: GraphInput) => {
    const trace = traceOf('kruskal', { graph });
    const edges = (f: number) => stateOf(trace, 'edges', 'table', f);
    const decl = trace.visualization.structures['edges'];
    const sorted = graph.edges
      .map(([u, v, w = 1], k) => ({ label: `${u}–${v}`, w, k }))
      .sort((a, b) => a.w - b.w || a.k - b.k);
    expect(decl).toMatchObject({
      kind: 'table',
      columnLabels: sorted.map((e) => e.label),
    });
    expect(edges(0).data).toEqual([sorted.map((e) => e.w)]);
    // Each edge is current in its steps; the taken ones stay settled.
    const compares = framesOf(trace, 'compare');
    expect(compares).toHaveLength(sorted.length);
    compares.forEach((f, k) =>
      expect(edges(f).marks.highlight, `edge ${k}`).toEqual([[0, k]]),
    );
    const taken = framesOf(trace, 'take').map(
      (f) => edges(f).marks.highlight[0],
    );
    expect(edges(trace.length).marks.settled).toEqual(taken);
    expect(trace.visualization.structures['sets']).toMatchObject({
      place: 'side',
    });
    expect(decl).not.toHaveProperty('place');
  };

  it('on the example', () => {
    check((example('kruskal') as { graph: GraphInput }).graph);
  });

  it('on random graphs', () => {
    fc.assert(
      fc.property(graphArb(fc.integer({ min: -5, max: 9 })), ([graph]) =>
        check(graph),
      ),
      fuzz,
    );
  });

  it('refuses more edges than a table has columns', () => {
    const nodes = ['A', 'B'];
    const edges = Array.from(
      { length: 101 },
      (_, k): [string, string, number] => ['A', 'B', k],
    );
    expect(runError('kruskal', { graph: { nodes, edges } })).toMatchObject({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message: expect.stringMatching(/at most 100 edges/) as string,
    });
  });
});

// ---------------------------------------------------------------------------
// Heaps

describe('heaps draw both views', () => {
  it.each(
    algorithms
      .filter((a) => a.id === 'heapsort' || /^(min|max)-heap\b/.test(a.id))
      .map((a) => [a.id, a.examples[0]] as const),
  )('%s', (id, input) => {
    const doc = runOk(id, input).document;
    const views = Object.values(doc.structures).map((s) =>
      s.kind === 'array' ? s.view : undefined,
    );
    expect(views).toContain('heap');
    expect(views).not.toContain('tree');
  });
});

// ---------------------------------------------------------------------------
// Call stacks

const sortValues = fc.array(fc.integer({ min: -9, max: 9 }), {
  minLength: 1,
  maxLength: 12,
});

/** MERGE-SORT's stack at its split and merged steps: calls on two or more. */
function mergeStacks(n: number): string[][] {
  const stack: string[] = [];
  const out: string[][] = [];
  const sort = (p: number, r: number) => {
    if (p >= r) return;
    const q = Math.floor((p + r) / 2);
    stack.push(`sort a[${p}..${r}]`);
    out.push([...stack]);
    sort(p, q);
    sort(q + 1, r);
    stack.pop();
    out.push([...stack]);
  };
  sort(0, n - 1);
  return out;
}

/** QUICKSORT's stack at the first step of each call on one or more values. */
function quickStacks(values: readonly number[]): string[][] {
  const a = [...values];
  const stack: string[] = [];
  const out: string[][] = [];
  const sort = (p: number, r: number) => {
    if (p > r) return;
    stack.push(`sort a[${p}..${r}]`);
    out.push([...stack]);
    if (p < r) {
      // Lomuto's partition around the last value.
      let i = p - 1;
      for (let j = p; j < r; j++)
        if (a[j]! <= a[r]!) {
          i += 1;
          [a[i], a[j]] = [a[j]!, a[i]!];
        }
      [a[i + 1], a[r]] = [a[r]!, a[i + 1]!];
      sort(p, i);
      sort(i + 2, r);
    }
    stack.pop();
  };
  sort(0, a.length - 1);
  return out;
}

describe('merge-sort keeps its call stack', () => {
  it('against the recursion, on random arrays', () => {
    fc.assert(
      fc.property(sortValues, (values) => {
        const trace = traceOf('merge-sort', { values });
        expect(
          framesOf(trace, 'split', 'merged').map((f) => stackAt(trace, f)),
        ).toEqual(mergeStacks(values.length));
        expect(stackAt(trace, trace.length)).toEqual([]);
      }),
      fuzz,
    );
  });
});

describe('quicksort keeps its call stack', () => {
  it('against the recursion, on random arrays', () => {
    fc.assert(
      fc.property(sortValues, (values) => {
        const trace = traceOf('quicksort', { values });
        const frames = framesOf(trace, 'pivot', 'single');
        // The last frame shows the finished run, with every call gone.
        const expected = quickStacks(values).map((stack, k) =>
          frames[k] === trace.length ? [] : stack,
        );
        expect(frames.map((f) => stackAt(trace, f))).toEqual(expected);
        expect(stackAt(trace, trace.length)).toEqual([]);
      }),
      fuzz,
    );
  });
});

describe('the tree walks keep their call stack', () => {
  // Level orders of random shapes: a value, or null for no node.
  const levelOrders = fc
    .array(fc.option(fc.integer({ min: 0, max: 99 }), { nil: null }), {
      minLength: 1,
      maxLength: 15,
    })
    .map((xs) => [xs[0] ?? 1, ...xs.slice(1)])
    // Only shapes the recipe accepts: every value has a parent.
    .filter(
      (levelOrder) => runAlgorithm('inorder-tree-walk', { levelOrder }).ok,
    );

  /** The walk's stack at each enter step: the path from the root. */
  function walkStacks(levelOrder: readonly (number | null)[]): string[][] {
    // Children by level order, as LeetCode reads it.
    const values = levelOrder.filter((v): v is number => v !== null);
    const kids: [number | null, number | null][] = values.map(() => [
      null,
      null,
    ]);
    let next = 1;
    for (let n = 0; n < values.length && next < levelOrder.length; n++)
      for (const side of [0, 1] as const) {
        if (next >= levelOrder.length) break;
        if (levelOrder[next] !== null)
          kids[n]![side] =
            levelOrder.slice(0, next + 1).filter((v) => v !== null).length - 1;
        next += 1;
      }
    const stack: string[] = [];
    const out: string[][] = [];
    const walk = (n: number | null) => {
      if (n === null) return;
      stack.push(`walk ${values[n]}`);
      out.push([...stack]);
      walk(kids[n]![0]);
      walk(kids[n]![1]);
      stack.pop();
    };
    walk(0);
    return out;
  }

  it.each(['inorder', 'preorder', 'postorder'])('%s', (order) => {
    fc.assert(
      fc.property(levelOrders, (levelOrder) => {
        const trace = traceOf(`${order}-tree-walk`, { levelOrder });
        expect(framesOf(trace, 'enter').map((f) => stackAt(trace, f))).toEqual(
          walkStacks(levelOrder),
        );
        // A visit happens in the call on that node, on top of the stack.
        for (const f of framesOf(trace, 'visit').filter(
          (f) => f < trace.length,
        )) {
          const narration = trace.visualization.steps[f - 1]!.meta!.narration!;
          const value = /^Visit (\S+):/.exec(narration)![1];
          expect(stackAt(trace, f).at(-1)).toBe(`walk ${value}`);
        }
        expect(stackAt(trace, trace.length)).toEqual([]);
      }),
      fuzz,
    );
  });
});

describe('topological-sort keeps its call stack', () => {
  /** The depth-first stack at each discover and finish step. */
  function dfsStacks(g: GraphInput): string[][] {
    const out: string[][] = [];
    const stack: string[] = [];
    const seen = new Set<string>();
    const visit = (u: string) => {
      seen.add(u);
      stack.push(`visit ${u}`);
      out.push([...stack]);
      for (const [v] of arcs(g).get(u)!) if (!seen.has(v)) visit(v);
      stack.pop();
      out.push([...stack]);
    };
    for (const u of g.nodes) if (!seen.has(u)) visit(u);
    return out;
  }

  // Directed acyclic: edges only from an earlier node to a later one.
  const dags = fc
    .uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), {
      minLength: 1,
      maxLength: 6,
    })
    .chain((nodes) =>
      fc.record({
        nodes: fc.constant(nodes),
        directed: fc.constant(true),
        edges: fc
          .array(fc.tuple(fc.nat(nodes.length - 1), fc.nat(nodes.length - 1)), {
            maxLength: 10,
          })
          .map((es) =>
            es
              .filter(([i, j]) => i !== j)
              .map(([i, j]): [string, string] =>
                i < j ? [nodes[i]!, nodes[j]!] : [nodes[j]!, nodes[i]!],
              ),
          ),
      }),
    );

  it('against a depth-first search, on random DAGs', () => {
    fc.assert(
      fc.property(dags, (graph: GraphInput) => {
        const trace = traceOf('topological-sort', { graph });
        expect(
          framesOf(trace, 'discover', 'finish').map((f) => stackAt(trace, f)),
        ).toEqual(dfsStacks(graph));
      }),
      fuzz,
    );
  });
});

// ---------------------------------------------------------------------------
// Placement

describe('side panels', () => {
  it.each([
    ['dijkstra', ['Q']],
    ['prim', ['Q']],
    ['kruskal', ['sets']],
    ['merge-sort', ['calls']],
    ['quicksort', ['calls']],
    ['inorder-tree-walk', ['calls']],
    ['topological-sort', ['calls']],
    ['dfs', ['calls']],
    ['bfs', ['queue']],
    ['insertion-sort', ['key']],
    ['balanced-brackets', ['stack']],
    ['floyd-warshall', ['dist']],
    ['heapsort', []],
    ['counting-sort', []],
  ])('%s puts %j on the side', (id, side) => {
    const doc = runOk(id, example(id)).document;
    const placed = Object.entries(doc.structures)
      .filter(([, s]) => s.place === 'side')
      .map(([name]) => name);
    expect(placed).toEqual(side);
    expect(doc.version).toBe('1.0');
  });
});
