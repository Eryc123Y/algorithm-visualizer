/**
 * The generators and helpers the property tests of the recipes share:
 * random inputs from each recipe's domain, and independent reference
 * implementations to check their answers against. The tests are split by
 * topic into the files beside this one, so Vitest runs them in parallel.
 */
import fc from 'fast-check';
import { expect, it } from 'vitest';

import type { GraphState, Trace, TreeState } from '@algomotion/core';
import type { Locale, VisualizationInput } from '@algomotion/spec';
import {
  runAlgorithm,
  type GraphInput,
  type KnapsackItem,
} from '../../src/index.ts';
import { runOk, stateOf } from '../helpers.ts';
import { load, recipe, runs, TIMEOUT } from '../recipe-properties.ts';

// ---------------------------------------------------------------------------
// Shared generators and helpers

/** User text must not contain the words the SVG check looks for. */
export const clean = (s: string) => !/NaN|undefined|Infinity/.test(s);

export const smallInt = fc.integer({ min: -50, max: 50 });
export const ascending = (a: readonly number[]) => [...a].sort((x, y) => x - y);

/** Number arrays: random, duplicate-heavy, sorted, reversed, fractional. */
export const numberArrays = (maxLength: number): fc.Arbitrary<number[]> =>
  fc.oneof(
    fc.array(smallInt, { maxLength }),
    fc.array(fc.integer({ min: 0, max: 3 }), { maxLength }),
    fc.array(smallInt, { maxLength }).map(ascending),
    fc.array(smallInt, { maxLength }).map((a) => ascending(a).reverse()),
    fc.array(fc.integer({ min: -1e9, max: 1e9 }), {
      maxLength: Math.min(maxLength, 8),
    }),
    fc.array(
      fc
        .double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })
        // -0 and 0 are the same value to every algorithm here.
        .map((x) => x + 0),
      { maxLength: Math.min(maxLength, 8) },
    ),
    // Any finite double, e.g. 5e-324 or -1.7976931348623157e+308.
    fc.array(
      fc.double({ noNaN: true, noDefaultInfinity: true }).map((x) => x + 0),
      { maxLength: Math.min(maxLength, 6) },
    ),
  );

/** Strings: bracket soup, small alphabets, graphemes, any code point. */
export const strings = (
  alphabet: string,
  maxLength: number,
): fc.Arbitrary<string> =>
  fc
    .oneof(
      fc.string({ unit: fc.constantFrom(...alphabet), maxLength }),
      fc.string({ unit: 'grapheme', maxLength: Math.min(maxLength, 6) }),
      fc.string({ unit: 'binary', maxLength: Math.min(maxLength, 6) }),
    )
    .filter(clean);

/** Values of the array named `name` at the last frame. */
export const valuesOf = (trace: Trace, name: string) =>
  stateOf(trace, name, 'array').data.map((e) => e.value);

/** In-order values of a binary tree state. */
export function inorder(tree: TreeState): unknown[] {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const out: unknown[] = [];
  const walk = (id: string | null) => {
    if (id === null) return;
    const node = byId.get(id)!;
    walk(node.children[0] ?? null);
    out.push(node.value);
    walk(node.children[1] ?? null);
  };
  tree.data.roots.forEach(walk);
  return out;
}

/** Heights of every node of a tree state. */
export function heights(tree: TreeState): Map<string, number> {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const h = new Map<string, number>();
  const of = (id: string | null): number => {
    if (id === null) return 0;
    const node = byId.get(id)!;
    const value = 1 + Math.max(...node.children.map((c) => of(c)), 0);
    h.set(id, value);
    return value;
  };
  tree.data.roots.forEach(of);
  return h;
}

/** Parent of every non-root node of a tree state. */
export function parents(tree: TreeState): Map<string, string> {
  const parent = new Map<string, string>();
  for (const n of tree.data.nodes)
    for (const c of n.children) if (c !== null) parent.set(c, n.id);
  return parent;
}

// ---------------------------------------------------------------------------
// Sorting

/** The document of a sorting module's run. */
export const sorted =
  (id: string) => (values: readonly number[], locale: Locale) =>
    runOk(id, { values }, locale).document;

export function checkSorted(
  trace: Trace,
  input: readonly number[],
  name = 'a',
): void {
  const a = stateOf(trace, name, 'array');
  expect(a.data.map((e) => e.value)).toEqual(ascending(input));
  expect([...a.marks.settled].sort()).toEqual(a.data.map((e) => e.id).sort());
}

export const sortable = numberArrays(24).filter((a) => a.length > 0);

export const countable = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 32 }),
  fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 16 }),
  fc.array(fc.constantFrom(0, 99), { minLength: 1, maxLength: 6 }),
);

// ---------------------------------------------------------------------------
// Searching

export const searchInput = fc
  .array(smallInt, { minLength: 1, maxLength: 32 })
  .map(ascending)
  .chain((values) =>
    fc.record({
      values: fc.constant(values),
      target: fc.oneof(fc.constantFrom(...values), smallInt),
    }),
  );

export function isBalanced(text: string): boolean {
  const stack: string[] = [];
  const opener: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  for (const ch of text)
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in opener && stack.pop() !== opener[ch]) return false;
  return stack.length === 0;
}

// ---------------------------------------------------------------------------
// Trees

export const keys = (maxLength: number) =>
  fc.oneof(
    fc.array(smallInt, { maxLength }),
    fc.array(fc.integer({ min: 0, max: 3 }), { maxLength }),
    fc.array(smallInt, { maxLength }).map(ascending),
    fc.array(smallInt, { maxLength }).map((a) => ascending(a).reverse()),
  );

/** Keys to start from and up to 8 keys to insert, at most 32 in all. */
export const avlRuns = fc
  .tuple(
    keys(24),
    keys(8).filter((ks) => ks.length > 0),
  )
  .map(([from, more]) => ({
    from,
    ops: more.map((key) => ({ op: 'insert', key })),
  }));

/** Keys to start from and up to 8 insertions or deletions (ADR 0034). */
export const redBlackRuns = fc
  .tuple(
    keys(24),
    fc.array(
      fc.record({
        op: fc.constantFrom('insert', 'delete'),
        key: smallInt,
      }),
      { minLength: 1, maxLength: 8 },
    ),
  )
  .map(([from, ops]) => ({ from, ops }));

export const intervals = fc
  .tuple(fc.integer({ min: -20, max: 20 }), fc.integer({ min: 0, max: 9 }))
  .map(([low, length]): [number, number] => [low, low + length]);

/**
 * A valid LeetCode level order: the root, then for every node in order
 * its two slots, then possibly a few trailing nulls.
 */
export const levelOrders: fc.Arbitrary<(number | null)[]> = fc
  .tuple(
    smallInt,
    fc.array(fc.option(smallInt, { nil: null, freq: 3 }), { maxLength: 30 }),
    fc.nat({ max: 3 }),
  )
  .map(([root, slots, trailing]) => {
    const out: (number | null)[] = [root];
    let open = 2;
    for (const v of slots) {
      if (open === 0) break;
      out.push(v);
      open += v === null ? -1 : 1;
    }
    return [...out, ...Array<null>(trailing).fill(null)].slice(0, 31);
  });

export type Order = 'preorder' | 'inorder' | 'postorder';

/** Reference walk of a level order, built independently. */
export function traverse(levelOrder: readonly (number | null)[], order: Order) {
  interface Node {
    value: number;
    left: Node | null;
    right: Node | null;
  }
  const root: Node = { value: levelOrder[0]!, left: null, right: null };
  const queue = [root];
  let k = 1;
  while (queue.length > 0 && k < levelOrder.length) {
    const parent = queue.shift()!;
    for (const side of ['left', 'right'] as const) {
      const v = k < levelOrder.length ? levelOrder[k++] : null;
      if (v === null || v === undefined) continue;
      const child: Node = { value: v, left: null, right: null };
      parent[side] = child;
      queue.push(child);
    }
  }
  const out: number[] = [];
  const walk = (n: Node | null): void => {
    if (n === null) return;
    if (order === 'preorder') out.push(n.value);
    walk(n.left);
    if (order === 'inorder') out.push(n.value);
    walk(n.right);
    if (order === 'postorder') out.push(n.value);
  };
  walk(root);
  return out;
}

export type TrieCall = { op: 'insert' | 'search'; word: string };

/** Words to start from and up to 8 calls, with at most 8 words in all. */
export const trieRuns = fc
  .tuple(
    fc.array(
      strings('abc', 6).filter((w) => w.length > 0),
      { maxLength: 8 },
    ),
    fc.array(
      fc.record({
        op: fc.constantFrom<'insert' | 'search'>('insert', 'search'),
        word: strings('abc', 6).filter((w) => w.length > 0),
      }),
      { minLength: 1, maxLength: 8 },
    ),
  )
  .map(([words, picks]) => {
    const from = [...new Set(words)].slice(0, 4);
    const held = new Set(from);
    const ops: TrieCall[] = picks.map((c) => {
      if (c.op === 'search' || held.has(c.word)) return c;
      if (held.size >= 8) return { ...c, op: 'search' };
      held.add(c.word);
      return c;
    });
    return { from, ops };
  })
  .filter(({ from, ops }) =>
    [...from, ...ops.map((o) => o.word)].every(
      (w) => w.length <= 16 && [...w].length > 0,
    ),
  );

export const disjointRuns = fc.integer({ min: 1, max: 16 }).chain((size) =>
  fc.record({
    from: fc.record({
      size: fc.constant(size),
      unions: fc.array(fc.tuple(fc.nat(size - 1), fc.nat(size - 1)), {
        maxLength: 20,
      }),
    }),
    ops: fc.array(
      fc.oneof(
        fc.record({
          op: fc.constant('union' as const),
          x: fc.nat(size - 1),
          y: fc.nat(size - 1),
        }),
        fc.record({
          op: fc.constant('find-set' as const),
          x: fc.nat(size - 1),
        }),
      ),
      { minLength: 1, maxLength: 8 },
    ),
  }),
);

// ---------------------------------------------------------------------------
// Hashing

export const mod = (k: number, m: number) => ((k % m) + m) % m;
export const hashKeys = fc.oneof(
  fc.array(fc.integer({ min: -200, max: 200 }), { maxLength: 40 }),
  fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 10 }),
  fc.array(fc.integer({ min: -1e9, max: 1e9 }), { maxLength: 6 }),
);

export type HashCall = { op: 'insert' | 'search'; key: number };

/** A starting table and up to 8 calls that keep within `maxKeys`. */
export const hashRuns = (maxKeys: (size: number) => number) =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 16 }),
      hashKeys,
      fc.array(
        fc.record({
          op: fc.constantFrom<'insert' | 'search'>('insert', 'search'),
          key: fc.oneof(smallInt, fc.integer({ min: -1e9, max: 1e9 })),
        }),
        { minLength: 1, maxLength: 8 },
      ),
    )
    .map(([size, ks, picks]) => {
      const keys = ks.slice(0, maxKeys(size));
      let room = maxKeys(size) - keys.length;
      const ops: HashCall[] = picks.map((c) =>
        c.op === 'insert' && room-- <= 0 ? { ...c, op: 'search' } : c,
      );
      return { from: { size, keys }, ops };
    });

// ---------------------------------------------------------------------------
// Dynamic programming

export function lcsTable(
  a: readonly string[],
  b: readonly string[],
): number[][] {
  const L = a.map(() => b.map(() => 0));
  const at = (i: number, j: number) => (i < 0 || j < 0 ? 0 : L[i]![j]!);
  a.forEach((x, i) =>
    b.forEach((y, j) => {
      L[i]![j] =
        x === y ? at(i - 1, j - 1) + 1 : Math.max(at(i - 1, j), at(i, j - 1));
    }),
  );
  return L;
}
export const lcsLength = (a: readonly string[], b: readonly string[]) =>
  a.length === 0 || b.length === 0
    ? 0
    : lcsTable(a, b)[a.length - 1]![b.length - 1]!;

export function levenshtein(
  a: readonly string[],
  b: readonly string[],
): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (const [i, x] of a.entries()) {
    const next = [i + 1];
    for (const [j, y] of b.entries())
      next.push(
        Math.min(row[j + 1]! + 1, next[j]! + 1, row[j]! + (x === y ? 0 : 1)),
      );
    row = next;
  }
  return row[b.length]!;
}

/** Two strings of 1 to 16 characters, as the string tables take them. */
export const stringPairs = fc
  .tuple(strings('abN', 16), strings('abN', 16))
  .filter(([a, b]) => [a, b].every((s) => s.length >= 1 && s.length <= 16));

export const knapsackInput = fc.tuple(
  fc.array(
    fc.record({
      weight: fc.integer({ min: 1, max: 12 }),
      value: fc.oneof(
        fc.integer({ min: -5, max: 30 }),
        fc.integer({ min: -1e6, max: 1e6 }),
      ),
    }),
    { minLength: 1, maxLength: 8 },
  ),
  fc.integer({ min: 0, max: 40 }),
);

export function bestValue(
  items: readonly KnapsackItem[],
  capacity: number,
): number {
  let best = 0;
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const chosen = items.filter((_, k) => mask & (1 << k));
    if (chosen.reduce((w, i) => w + i.weight, 0) <= capacity)
      best = Math.max(
        best,
        chosen.reduce((v, i) => v + i.value, 0),
      );
  }
  return best;
}

// ---------------------------------------------------------------------------
// Graphs

/**
 * Valid node ids, including names that look like generated edge ids and
 * names of built-in object properties.
 */
export const nodeName = fc
  .oneof(
    fc.stringMatching(/^[A-Za-z0-9_.:-]{1,4}$/),
    fc.constantFrom('A', 'B', 'C', 'A-B', 'B-A', 'A-B.2', '1', '2', '1-2'),
    // Valid ids that are also properties of every object.
    fc.constantFrom('__proto__', 'constructor', 'toString', 'valueOf'),
  )
  .filter(clean);

export type Edge = GraphInput['edges'][number];

/**
 * Graphs on valid node names, with self-loops and parallel edges; half of
 * them are small and dense, to stack many edges on few nodes.
 */
export function graphs(
  weight: fc.Arbitrary<number | undefined>,
  { minNodes = 0, dag = false } = {},
): fc.Arbitrary<GraphInput> {
  return fc.oneof(
    graphsOf(weight, { minNodes, dag, maxNodes: 10, maxEdges: 24 }),
    graphsOf(weight, { minNodes, dag, maxNodes: 3, maxEdges: 16 }),
  );
}

export function graphsOf(
  weight: fc.Arbitrary<number | undefined>,
  {
    minNodes,
    dag,
    maxNodes,
    maxEdges,
  }: { minNodes: number; dag: boolean; maxNodes: number; maxEdges: number },
): fc.Arbitrary<GraphInput> {
  return fc
    .uniqueArray(nodeName, { minLength: minNodes, maxLength: maxNodes })
    .chain((nodes) =>
      fc.record({
        nodes: fc.constant(nodes),
        edges:
          nodes.length === 0
            ? fc.constant<Edge[]>([])
            : fc
                .array(
                  fc.tuple(
                    fc.nat(nodes.length - 1),
                    fc.nat(nodes.length - 1),
                    weight,
                  ),
                  { maxLength: maxEdges },
                )
                .map((es) =>
                  es
                    .filter(([u, v]) => !dag || u !== v)
                    .map(([u, v, w]): Edge => {
                      const [x, y] = dag && u > v ? [v, u] : [u, v];
                      return w === undefined
                        ? [nodes[x]!, nodes[y]!]
                        : [nodes[x]!, nodes[y]!, w];
                    }),
                ),
        directed: dag ? fc.constant(true) : fc.boolean(),
      }),
    );
}

export const withStart = (arb: fc.Arbitrary<GraphInput>) =>
  arb.chain((g) => fc.tuple(fc.constant(g), fc.constantFrom(...g.nodes)));

export const optional = (w: fc.Arbitrary<number>) =>
  fc.option(w, { nil: undefined, freq: 4 });
export const nonNegative = optional(
  fc.oneof(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 1e6 }),
    fc.integer({ min: 0, max: 40 }).map((k) => k / 2),
  ),
);
export const anyWeight = optional(
  fc.oneof(
    fc.integer({ min: -6, max: 20 }),
    fc.integer({ min: -1e6, max: 1e6 }),
    fc.integer({ min: -10, max: 40 }).map((k) => k / 2),
  ),
);

/** Arcs of a graph, both ways for undirected edges. */
export function arcs(g: GraphInput, directed = g.directed ?? false) {
  return g.edges.flatMap(([u, v, w = 1]) =>
    directed || u === v
      ? [{ u, v, w }]
      : [
          { u, v, w },
          { u: v, v: u, w },
        ],
  );
}

/** Shortest distances by |V| rounds of relaxation, and whether a negative cycle is reachable. */
export function shortest(g: GraphInput, s: string, directed?: boolean) {
  const as = arcs(g, directed);
  const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
  for (let k = 1; k < g.nodes.length; k++)
    for (const { u, v, w } of as)
      if (d.get(u)! + w < d.get(v)!) d.set(v, d.get(u)! + w);
  const negativeCycle = as.some(({ u, v, w }) => d.get(u)! + w < d.get(v)!);
  return { d, negativeCycle };
}

export function reachable(
  g: GraphInput,
  s: string,
  directed?: boolean,
): Set<string> {
  const seen = new Set([s]);
  const as = arcs(g, directed);
  for (let grew = true; grew;) {
    grew = false;
    for (const { u, v } of as)
      if (seen.has(u) && !seen.has(v)) {
        seen.add(v);
        grew = true;
      }
  }
  return seen;
}

/** A record's own entry: node ids such as "__proto__" are valid. */
export const own = <V>(record: Readonly<Record<string, V>>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

export const selected = (g: GraphState) =>
  g.data.edges.filter((e) => own(g.marks.edgeMarks, e.id) === 'selected');
export const weightOf = (edges: GraphState['data']['edges']) =>
  edges.reduce((sum, e) => sum + Number(e.weight ?? 1), 0);

/** Whether some edges contain no cycle (as undirected edges). */
export function isForest(edges: GraphState['data']['edges']): boolean {
  const parent = new Map<string, string>();
  const find = (v: string): string =>
    parent.has(v) ? find(parent.get(v)!) : v;
  for (const { from, to } of edges) {
    const [a, b] = [find(from), find(to)];
    if (a === b) return false;
    parent.set(a, b);
  }
  return true;
}

/** Minimum spanning forest weight of the edges among `nodes`. */
export function msfWeight(g: GraphInput, nodes: ReadonlySet<string>): number {
  const parent = new Map<string, string>();
  const find = (v: string): string =>
    parent.has(v) ? find(parent.get(v)!) : v;
  let total = 0;
  for (const [u, v, w = 1] of [...g.edges]
    .filter(([u]) => nodes.has(u))
    .sort((a, b) => (a[2] ?? 1) - (b[2] ?? 1))) {
    const [a, b] = [find(u), find(v)];
    if (a !== b) {
      parent.set(a, b);
      total += w;
    }
  }
  return total;
}

/** Notes of a node as Dijkstra and Bellman–Ford show distances. */
export const shown = (d: number) => (d === Infinity ? '∞' : String(d));
export const steps = (trace: Trace, id: string) =>
  trace.visualization.steps.filter((s) => s.meta?.id === id).length;

/** The number of connected components, edges taken both ways. */
export const componentCount = (g: GraphInput) =>
  new Set(g.nodes.map((v) => [...reachable(g, v, false)].sort().join('\u0000')))
    .size;

// ---------------------------------------------------------------------------
// Well-typed inputs outside what the recipes check. A recipe should reject
// them with a RangeError, as it does for the inputs it checks, or still give
// a document that loads; not crash with another error, hang, or give a
// document the engine rejects.

/** Either a RangeError or a document that loads. */
export function total<T>(
  name: string,
  arb: fc.Arbitrary<T>,
  build: (input: T) => VisualizationInput | readonly VisualizationInput[],
): void {
  it(
    `${name}: rejects with a RangeError or gives a document that loads`,
    () => {
      fc.assert(
        fc.property(arb, (input) => {
          let docs: VisualizationInput | readonly VisualizationInput[];
          try {
            docs = build(input);
          } catch (error) {
            if (error instanceof RangeError) return;
            throw error;
          }
          for (const doc of [docs].flat()) load(doc);
        }),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
}

/**
 * Every graph module, starting from the first node: the documents of the
 * runs that succeed. A run may refuse the input, but not fail otherwise.
 */
export const allGraphModules = (graph: GraphInput): VisualizationInput[] => {
  const start = graph.nodes[0]!;
  return (
    [
      ['bfs', { graph, source: start }],
      ['dfs', { graph }],
      ['dijkstra', { graph, source: start }],
      ['bellman-ford', { graph, source: start }],
      ['prim', { graph, root: start }],
      ['kruskal', { graph }],
      ['topological-sort', { graph }],
      ['floyd-warshall', { graph }],
    ] as const
  ).flatMap(([id, input]) => {
    const run = runAlgorithm(id, input);
    if (run.ok) return [run.value.document];
    const [error] = run.error;
    if (error!.code !== 'INVALID_ARGUMENT' && error!.code !== 'INVALID_SHAPE')
      throw new Error(`${id}: ${JSON.stringify(run.error)}`);
    return [];
  });
};

// String matching (ADR 0037): texts over a few letters, so that matches,
// overlaps and spurious hits happen; every matcher finds every shift.

export const matchInput = fc
  .tuple(
    fc.string({ unit: fc.constantFrom('a', 'b'), minLength: 1, maxLength: 24 }),
    fc.string({ unit: fc.constantFrom('a', 'b'), minLength: 1, maxLength: 10 }),
  )
  .filter(([text, pattern]) => pattern.length <= text.length)
  .map(([text, pattern]) => ({ text, pattern }));

// Computational geometry (ADR 0038): points on a small grid, so that
// collinear points and equal x happen.

export const gridPoints = (min: number, max: number) =>
  fc
    .uniqueArray(
      fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 })),
      { minLength: min, maxLength: max, selector: (p) => p.join() },
    )
    .filter((ps) =>
      ps.some(
        (p) =>
          (ps[1]![0] - ps[0]![0]) * (p[1] - ps[0]![1]) -
            (ps[1]![1] - ps[0]![1]) * (p[0] - ps[0]![0]) !==
          0,
      ),
    );

// Euclid and extended Euclid: pairs of whole numbers, not both 0.
export const euclidPairs = fc
  .tuple(fc.nat(100_000), fc.nat(100_000))
  .filter(([a, b]) => a > 0 || b > 0)
  .map(([a, b]) => ({ a, b }));

/**
 * The properties of a comparison sort, with what each one keeps besides
 * the array: heapsort's heap before the first extraction, merge sort's
 * buffer and insertion sort's key, cleared at the end.
 */
export function comparisonSort(id: string): void {
  recipe(id, sortable, sorted(id), (trace, input) => {
    checkSorted(trace, input);
    const ids = trace.visualization.steps.map((step) => step.meta?.id);
    if (id === 'heapsort' && input.length > 1) {
      // Before the first maximum moves to the end, the array is a max-heap.
      const heap = stateOf(
        trace,
        'a',
        'array',
        ids.indexOf('extract'),
      ).data.map((e) => e.value as number);
      heap.forEach((x, i) =>
        expect(i === 0 || heap[(i - 1) >> 1]! >= x).toBe(true),
      );
    }
    if (id === 'merge-sort')
      expect(valuesOf(trace, 'aux')).toEqual(input.map(() => ''));
    if (id === 'insertion-sort') expect(valuesOf(trace, 'key')).toEqual(['']);
  });
}
