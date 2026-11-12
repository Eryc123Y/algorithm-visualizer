/**
 * Property-based tests for every recipe: random inputs from each recipe's
 * domain must give a document that loads, ends with the right answer
 * (checked against independent reference implementations), lays out inside
 * a fixed-size scene in every frame, and renders to clean SVG.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { GraphState, Trace, TreeState } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import {
  runAlgorithm,
  type GraphInput,
  type KnapsackItem,
} from '../src/index.ts';
import { runError, runOk, stateOf } from './helpers.ts';
import { load, recipe, runs, TIMEOUT } from './recipe-properties.ts';
import {
  drawnShape,
  RefTree,
  redBlackProblems,
} from './red-black-reference.ts';

// ---------------------------------------------------------------------------
// Shared generators and helpers

/** User text must not contain the words the SVG check looks for. */
const clean = (s: string) => !/NaN|undefined|Infinity/.test(s);

const smallInt = fc.integer({ min: -50, max: 50 });
const ascending = (a: readonly number[]) => [...a].sort((x, y) => x - y);

/** Number arrays: random, duplicate-heavy, sorted, reversed, fractional. */
const numberArrays = (maxLength: number): fc.Arbitrary<number[]> =>
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
const strings = (alphabet: string, maxLength: number): fc.Arbitrary<string> =>
  fc
    .oneof(
      fc.string({ unit: fc.constantFrom(...alphabet), maxLength }),
      fc.string({ unit: 'grapheme', maxLength: Math.min(maxLength, 6) }),
      fc.string({ unit: 'binary', maxLength: Math.min(maxLength, 6) }),
    )
    .filter(clean);

/** Values of the array named `name` at the last frame. */
const valuesOf = (trace: Trace, name: string) =>
  stateOf(trace, name, 'array').data.map((e) => e.value);

/** In-order values of a binary tree state. */
function inorder(tree: TreeState): unknown[] {
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
function heights(tree: TreeState): Map<string, number> {
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
function parents(tree: TreeState): Map<string, string> {
  const parent = new Map<string, string>();
  for (const n of tree.data.nodes)
    for (const c of n.children) if (c !== null) parent.set(c, n.id);
  return parent;
}

// ---------------------------------------------------------------------------
// Sorting

/** The document of a sorting module's run. */
const sorted = (id: string) => (values: readonly number[]) =>
  runOk(id, { values }).document;

function checkSorted(trace: Trace, input: readonly number[], name = 'a'): void {
  const a = stateOf(trace, name, 'array');
  expect(a.data.map((e) => e.value)).toEqual(ascending(input));
  expect([...a.marks.settled].sort()).toEqual(a.data.map((e) => e.id).sort());
}

const sortable = numberArrays(24).filter((a) => a.length > 0);

for (const id of [
  'insertion-sort',
  'merge-sort',
  'heapsort',
  'quicksort',
  'bubble-sort',
  'selection-sort',
])
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

const countable = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 32 }),
  fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 16 }),
  fc.array(fc.constantFrom(0, 99), { minLength: 1, maxLength: 6 }),
);
recipe('counting-sort', countable, sorted('counting-sort'), (trace, input) => {
  checkSorted(trace, input, 'b');
  expect(valuesOf(trace, 'a')).toEqual(input);
  const count = valuesOf(trace, 'c');
  expect(count).toHaveLength(Math.max(...input) + 1);
  // After placing, c[v] is how many values are smaller than v.
  count.forEach((c, v) => expect(c).toBe(input.filter((x) => x < v).length));
});

describe('counting-sort input checks', () => {
  const bad = fc.oneof(
    fc.integer({ min: 100, max: 10_000 }),
    fc.integer({ min: -10_000, max: -1 }),
    fc.double({ min: 0, max: 99 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity, 99.5, -0.5),
  );
  it(
    'rejects values outside the integers 0..99, at their index',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 99 }), { maxLength: 6 }),
          bad,
          fc.nat(),
          (good, x, at) => {
            const k = at % (good.length + 1);
            const values = good.toSpliced(k, 0, x);
            expect(runError('counting-sort', { values })).toMatchObject({
              code: 'INVALID_SHAPE',
              path: `$.input.values[${k}]`,
            });
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Searching

const searchInput = fc
  .array(smallInt, { minLength: 1, maxLength: 32 })
  .map(ascending)
  .chain((values) =>
    fc.record({
      values: fc.constant(values),
      target: fc.oneof(fc.constantFrom(...values), smallInt),
    }),
  );

recipe(
  'binary-search',
  searchInput,
  (input) => runOk('binary-search', input).document,
  (trace, { values, target }) => {
    const a = stateOf(trace, 'a', 'array');
    const settled = a.marks.settled;
    if (values.includes(target)) {
      expect(settled).toHaveLength(1);
      expect(a.data.find((e) => e.id === settled[0])?.value).toBe(target);
    } else expect(settled).toEqual([]);
    // The start, a look and a move per halving, and the outcome.
    expect(trace.length).toBeLessThanOrEqual(
      2 + 2 * Math.ceil(Math.log2(values.length + 1)),
    );
  },
);

describe('binary-search input checks', () => {
  it(
    'refuses values that are not sorted',
    () => {
      fc.assert(
        fc.property(
          fc
            .array(smallInt, { minLength: 2, maxLength: 32 })
            .filter((a) => a.some((x, i) => i > 0 && a[i - 1]! > x)),
          smallInt,
          (values, target) => {
            expect(runError('binary-search', { values, target })).toMatchObject(
              { code: 'INVALID_ARGUMENT', path: '$.input' },
            );
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Linear structures

recipe(
  'reverse-linked-list',
  numberArrays(12).filter((a) => a.length > 0),
  (values) => runOk('reverse-linked-list', { values }).document,
  (trace, values) => {
    const list = stateOf(trace, 'list', 'linkedList');
    const byId = new Map(list.data.map((n) => [n.id, n]));
    const walked: unknown[] = [];
    let at: string | null = list.marks.pointers['head'] ?? null;
    while (at !== null && walked.length <= values.length) {
      const node = byId.get(at)!;
      walked.push(node.value);
      at = node.next;
    }
    expect(walked).toEqual([...values].reverse());
  },
);

recipe(
  'move-to-front',
  fc
    .tuple(
      fc.uniqueArray(fc.integer({ min: 0, max: 30 }), {
        minLength: 1,
        maxLength: 12,
      }),
      fc.array(fc.nat(), { minLength: 1, maxLength: 32 }),
    )
    .map(([list, picks]) => ({
      list,
      requests: picks.map((p) => list[p % list.length]!),
    })),
  (input) => runOk('move-to-front', input).document,
  (trace, { list, requests }) => {
    // Each request ends at the front, so the last requests, most recent
    // first, lead the list, and the keys never requested keep their order.
    const recent = [...new Set([...requests].reverse())];
    const rest = list.filter((k) => !recent.includes(k));
    const drawn = stateOf(trace, 'L', 'linkedList').data.map((n) => n.value);
    expect(drawn).toEqual([...recent, ...rest]);
  },
);

function isBalanced(text: string): boolean {
  const stack: string[] = [];
  const opener: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  for (const ch of text)
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in opener && stack.pop() !== opener[ch]) return false;
  return stack.length === 0;
}

recipe(
  'balanced-brackets',
  strings('()[]{}a ', 32).filter((t) => t.length >= 1 && t.length <= 32),
  (text) => runOk('balanced-brackets', { text }).document,
  (trace, text) => {
    const last = trace.visualization.steps.at(-1)?.meta?.narration ?? '';
    const balanced = isBalanced(text);
    expect(last.endsWith(': balanced.')).toBe(balanced);
    if (balanced) expect(stateOf(trace, 'stack', 'stack').data).toEqual([]);
  },
);

// ---------------------------------------------------------------------------
// Trees

const keys = (maxLength: number) =>
  fc.oneof(
    fc.array(smallInt, { maxLength }),
    fc.array(fc.integer({ min: 0, max: 3 }), { maxLength }),
    fc.array(smallInt, { maxLength }).map(ascending),
    fc.array(smallInt, { maxLength }).map((a) => ascending(a).reverse()),
  );

/** Keys to start from and up to 8 keys to insert, at most 32 in all. */
const avlRuns = fc
  .tuple(
    keys(24),
    keys(8).filter((ks) => ks.length > 0),
  )
  .map(([from, more]) => ({
    from,
    ops: more.map((key) => ({ op: 'insert', key })),
  }));

recipe(
  'avl',
  avlRuns,
  (input) => runOk('avl', input).document,
  (trace, { from, ops }) => {
    const tree = stateOf(trace, 'avl', 'tree');
    const all = [...from, ...ops.map((o) => o.key)];
    expect(inorder(tree)).toEqual(ascending([...new Set(all)]));
    expect(tree.data.roots).toHaveLength(1);
    const h = heights(tree);
    for (const node of tree.data.nodes) {
      const [l, r] = [0, 1].map((k) => {
        const c = node.children[k] ?? null;
        return c === null ? 0 : h.get(c)!;
      });
      expect(Math.abs(l! - r!)).toBeLessThanOrEqual(1);
      expect(tree.marks.notes[node.id]).toBe(`h=${h.get(node.id)}`);
    }
  },
);

/** Keys to start from and up to 8 insertions or deletions (ADR 0034). */
const redBlackRuns = fc
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

recipe(
  'red-black-tree',
  redBlackRuns,
  (input) => runOk('red-black-tree', input).document,
  (trace, { from, ops }) => {
    const ref = new RefTree<number>((a, b) => a < b);
    for (const key of from) ref.insert(key);
    for (const { op, key } of ops)
      if (op === 'insert') ref.insert(key);
      else ref.delete(key);
    const tree = stateOf(trace, 'T', 'tree');
    expect(drawnShape(tree)).toEqual(ref.shape());
    expect(
      redBlackProblems(tree, (a, b) => (a as number) < (b as number)),
    ).toEqual([]);
    // Each operation ends with a red–black tree and no pointer left over.
    const sections = trace.visualization.sections ?? [];
    for (const { start } of sections.slice(1)) {
      const before = stateOf(trace, 'T', 'tree', start);
      expect(
        redBlackProblems(before, (a, b) => (a as number) < (b as number)),
      ).toEqual([]);
    }
    // The successor's pointer goes once it has moved up.
    expect(Object.keys(tree.marks.pointers)).not.toContain('y');
    // Every frame, also in the middle of a deletion, draws one search
    // tree: the moves of a step leave no stray root behind.
    for (let k = 0; k <= trace.length; k++) {
      const at = stateOf(trace, 'T', 'tree', k);
      expect(at.data.roots.length, `frame ${k}`).toBeLessThanOrEqual(1);
      const keys = inorder(at) as number[];
      expect(keys, `frame ${k}`).toEqual(ascending(keys));
    }
  },
);

recipe(
  'order-statistic-tree',
  fc
    .tuple(
      fc.uniqueArray(smallInt, { minLength: 1, maxLength: 24 }),
      fc.array(
        fc.oneof(
          fc.record({
            op: fc.constantFrom('insert', 'delete', 'rank'),
            key: smallInt,
          }),
          fc.record({ op: fc.constant('select'), i: fc.constant(1) }),
        ),
        { minLength: 1, maxLength: 8 },
      ),
    )
    // Keep the first key, so that every select of rank 1 has one to find.
    .map(([from, ops]) => ({
      from,
      ops: ops.map((o) =>
        o.op === 'delete' && o.key === from[0] ? { ...o, key: o.key + 101 } : o,
      ),
    })),
  (input) => runOk('order-statistic-tree', input).document,
  (trace, { from, ops }) => {
    const keys = new Set(from);
    for (const o of ops)
      if (o.op === 'insert') keys.add(o.key);
      else if (o.op === 'delete') keys.delete(o.key);
    expect(inorder(stateOf(trace, 'T', 'tree'))).toEqual(ascending([...keys]));
  },
);

const intervals = fc
  .tuple(fc.integer({ min: -20, max: 20 }), fc.integer({ min: 0, max: 9 }))
  .map(([low, length]): [number, number] => [low, low + length]);

recipe(
  'interval-tree',
  fc
    .tuple(
      fc.uniqueArray(intervals, { maxLength: 24, selector: (i) => i.join() }),
      fc.array(
        fc.record({
          op: fc.constantFrom('insert', 'delete', 'search'),
          interval: intervals,
        }),
        { minLength: 1, maxLength: 8 },
      ),
    )
    .map(([from, ops]) => ({ from, ops })),
  (input) => runOk('interval-tree', input).document,
  (trace, { from, ops }) => {
    const keys = new Map(from.map((i) => [i.join(), i]));
    for (const { op, interval } of ops)
      if (op === 'insert') keys.set(interval.join(), interval);
      else if (op === 'delete') keys.delete(interval.join());
    const sorted = [...keys.values()]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([a, b]) => `[${a},${b}]`);
    expect(inorder(stateOf(trace, 'T', 'tree'))).toEqual(sorted);
  },
);

recipe(
  'b-tree',
  fc.record({
    from: fc.record({
      t: fc.integer({ min: 2, max: 4 }),
      keys: fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 24 }),
    }),
    ops: fc.array(
      fc.record({
        op: fc.constantFrom('insert', 'delete', 'search'),
        key: fc.integer({ min: 0, max: 60 }),
      }),
      { minLength: 1, maxLength: 8 },
    ),
  }),
  (input) => runOk('b-tree', input).document,
  (trace, { from, ops }) => {
    const keys = new Set(from.keys);
    for (const { op, key } of ops)
      if (op === 'insert') keys.add(key);
      else if (op === 'delete') keys.delete(key);
    // An inorder walk of the drawn B-tree gives the keys in order.
    const s = stateOf(trace, 'T', 'btree');
    const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
    const walk = (id: string): unknown[] => {
      const n = byId.get(id)!;
      if (n.children.length === 0) return n.keys.map((k) => k.value);
      return n.children.flatMap((c, i) => [
        ...walk(c),
        ...(i < n.keys.length ? [n.keys[i]!.value] : []),
      ]);
    };
    expect(walk(s.data.root)).toEqual(ascending([...keys]));
  },
);

recipe(
  'fibonacci-heap',
  fc
    .tuple(
      fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 16 }),
      fc.array(
        fc.oneof(
          fc.record({
            op: fc.constant('insert'),
            key: fc.integer({ min: 61, max: 99 }),
          }),
          fc.record({ op: fc.constant('extract-min') }),
        ),
        { minLength: 1, maxLength: 8 },
      ),
    )
    // Distinct inserted keys, and no more extractions than keys.
    .map(([keys, raw]) => {
      let size = keys.length;
      const seen = new Set(keys);
      const ops = raw.filter((o) => {
        if (o.op === 'insert') {
          if (seen.has(o.key)) return false;
          seen.add(o.key);
          size++;
          return true;
        }
        if (size === 0) return false;
        size--;
        return true;
      });
      return {
        from: keys,
        ops: ops.length > 0 ? ops : [{ op: 'insert', key: 100 }],
      };
    }),
  (input) => runOk('fibonacci-heap', input).document,
  (trace, { from, ops }) => {
    const keys = new Set(from);
    for (const o of ops)
      if (o.op === 'insert') keys.add(o.key);
      else keys.delete(Math.min(...keys));
    const tree = stateOf(trace, 'H', 'tree');
    expect(
      tree.data.nodes.map((n) => n.value).sort((a, b) => Number(a) - Number(b)),
    ).toEqual([...keys].sort((a, b) => a - b));
  },
);

recipe(
  'huffman',
  fc
    .tuple(
      fc.uniqueArray(fc.constantFrom(...'abcdefghijklmnop'), {
        minLength: 2,
        maxLength: 16,
      }),
      fc.array(fc.integer({ min: 1, max: 99 }), {
        minLength: 16,
        maxLength: 16,
      }),
    )
    .map(([chars, freqs]) => ({
      frequencies: chars.map((c, k): [string, number] => [c, freqs[k]!]),
    })),
  (input) => runOk('huffman', input).document,
  (trace, { frequencies }) => {
    const codes = stateOf(trace, 'codes', 'table').data.map((row) => row[1]);
    expect(codes.every((c) => typeof c === 'string' && c.length > 0)).toBe(
      true,
    );
    expect(new Set(codes).size).toBe(frequencies.length);
  },
);

/**
 * A valid LeetCode level order: the root, then for every node in order
 * its two slots, then possibly a few trailing nulls.
 */
const levelOrders: fc.Arbitrary<(number | null)[]> = fc
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

type Order = 'preorder' | 'inorder' | 'postorder';

/** Reference walk of a level order, built independently. */
function traverse(levelOrder: readonly (number | null)[], order: Order) {
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

for (const order of ['preorder', 'inorder', 'postorder'] as const)
  recipe(
    `${order}-tree-walk`,
    levelOrders,
    (levelOrder) => runOk(`${order}-tree-walk`, { levelOrder }).document,
    (trace, levelOrder) => {
      const expected = traverse(levelOrder, order);
      expect(valuesOf(trace, 'out')).toEqual(expected);
      const tree = stateOf(trace, 'tree', 'tree');
      expect(tree.marks.visited).toHaveLength(expected.length);
      expect(tree.marks.pointers).toEqual({});
    },
  );

type TrieCall = { op: 'insert' | 'search'; word: string };

/** Words to start from and up to 8 calls, with at most 8 words in all. */
const trieRuns = fc
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

recipe(
  'trie',
  trieRuns,
  (input) => runOk('trie', input).document,
  (trace, { from, ops }) => {
    const words = new Set(from);
    for (const { op, word } of ops) if (op === 'insert') words.add(word);
    const trie = stateOf(trace, 'trie', 'tree');
    const byId = new Map(trie.data.nodes.map((n) => [n.id, n]));
    const prefixes = new Set(
      [...words].flatMap((w) =>
        [...w].map((_, k) => [...w].slice(0, k + 1).join('\u0000')),
      ),
    );
    expect(trie.data.nodes).toHaveLength(prefixes.size + 1);
    expect(trie.data.roots).toEqual(['root']);
    const ends = new Set<string>();
    for (const word of words) {
      let at = 'root';
      for (const ch of word) {
        const next = byId
          .get(at)!
          .children.filter((c) => c !== null && byId.get(c)!.value === ch);
        expect(next, `child "${ch}" on the path of "${word}"`).toHaveLength(1);
        at = next[0]!;
      }
      ends.add(at);
    }
    expect([...trie.marks.settled].sort()).toEqual([...ends].sort());
    for (const node of trie.data.nodes) {
      const letters = node.children.map((c) => String(byId.get(c!)!.value));
      expect(letters).toEqual([...letters].sort());
    }
  },
);

const disjointRuns = fc.integer({ min: 1, max: 16 }).chain((size) =>
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

recipe(
  'disjoint-set',
  disjointRuns,
  (input) => runOk('disjoint-set', input).document,
  (trace, { from: { size, unions }, ops }) => {
    const forest = stateOf(trace, 'sets', 'tree');
    const parent = parents(forest);
    const root = (id: string): string =>
      parent.has(id) ? root(parent.get(id)!) : id;
    // Reference: label propagation until nothing changes.
    const pairs = [
      ...unions,
      ...ops.flatMap((o) => (o.op === 'union' ? [[o.x, o.y] as const] : [])),
    ];
    const label = Array.from({ length: size }, (_, k) => k);
    for (let changed = true; changed;) {
      changed = false;
      for (const [a, b] of pairs) {
        const m = Math.min(label[a]!, label[b]!);
        for (const x of [a, b])
          if (label[x] !== m) {
            const old = label[x]!;
            for (let k = 0; k < size; k++) if (label[k] === old) label[k] = m;
            changed = true;
          }
      }
    }
    for (let a = 0; a < size; a++)
      for (let b = 0; b < size; b++)
        expect(root(String(a)) === root(String(b))).toBe(label[a] === label[b]);
    expect(forest.data.nodes).toHaveLength(size);
    // Union by rank: a node's rank bounds its height, and a root of rank r
    // has at least 2^r nodes.
    const rank = (id: string) =>
      Number(/^rank (\d+)$/.exec(forest.marks.notes[id] ?? '')?.[1] ?? 0);
    const h = heights(forest);
    const below = new Map<string, number>();
    for (const n of forest.data.nodes)
      below.set(root(n.id), (below.get(root(n.id)) ?? 0) + 1);
    for (const n of forest.data.nodes) {
      expect(h.get(n.id)! - 1, `height of ${n.id}`).toBeLessThanOrEqual(
        rank(n.id),
      );
      if (!parent.has(n.id))
        expect(below.get(n.id)!).toBeGreaterThanOrEqual(2 ** rank(n.id));
    }
  },
);

// ---------------------------------------------------------------------------
// Hashing

const mod = (k: number, m: number) => ((k % m) + m) % m;
const hashKeys = fc.oneof(
  fc.array(fc.integer({ min: -200, max: 200 }), { maxLength: 40 }),
  fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 10 }),
  fc.array(fc.integer({ min: -1e9, max: 1e9 }), { maxLength: 6 }),
);

type HashCall = { op: 'insert' | 'search'; key: number };

/** A starting table and up to 8 calls that keep within `maxKeys`. */
const hashRuns = (maxKeys: (size: number) => number) =>
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

recipe(
  'hash-chaining',
  hashRuns(() => 24),
  (input) => runOk('hash-chaining', input).document,
  (trace, { from: { size, keys }, ops }) => {
    const chains: number[][] = Array.from({ length: size }, () => []);
    for (const k of keys) chains[mod(k, size)]!.unshift(k);
    for (const { op, key } of ops)
      if (op === 'insert') chains[mod(key, size)]!.unshift(key);
    const t = stateOf(trace, 't', 'hashTable');
    expect(t.data.map((chain) => chain.map((e) => e.value))).toEqual(chains);
  },
);

recipe(
  'linear-probing',
  hashRuns((size) => size),
  (input) => runOk('linear-probing', input).document,
  (trace, { from: { size, keys }, ops }) => {
    const slots = Array<number | string>(size).fill('');
    const insert = (key: number) => {
      let i = mod(key, size);
      while (slots[i] !== '') i = (i + 1) % size;
      slots[i] = key;
    };
    keys.forEach(insert);
    for (const { op, key } of ops) if (op === 'insert') insert(key);
    expect(valuesOf(trace, 't')).toEqual(slots);
  },
);

describe('hashing input checks', () => {
  const bad = fc.record({
    size: fc.oneof(
      fc.integer({ min: 17, max: 1000 }),
      fc.integer({ min: -10, max: 0 }),
      fc.double({ min: 1, max: 16 }).filter((x) => !Number.isInteger(x)),
      fc.integer({ min: 1, max: 16 }),
    ),
    keys: fc.array(
      fc.oneof(
        smallInt,
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.constantFrom(NaN, Infinity, 2 ** 60),
      ),
      { maxLength: 30 },
    ),
  });
  for (const id of ['hash-chaining', 'linear-probing'])
    it(
      `${id} reports a table it cannot hold, or runs`,
      () => {
        fc.assert(
          fc.property(bad, smallInt, (from, key) => {
            const run = runAlgorithm(`${id}.insert`, { from, key });
            if (!run.ok)
              expect(['INVALID_SHAPE', 'INVALID_ARGUMENT']).toContain(
                run.error[0]!.code,
              );
          }),
          { numRuns: runs },
        );
      },
      TIMEOUT,
    );
});

// ---------------------------------------------------------------------------
// Dynamic programming

function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
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
const lcsLength = (a: readonly string[], b: readonly string[]) =>
  a.length === 0 || b.length === 0
    ? 0
    : lcsTable(a, b)[a.length - 1]![b.length - 1]!;

function levenshtein(a: readonly string[], b: readonly string[]): number {
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
const stringPairs = fc
  .tuple(strings('abN', 16), strings('abN', 16))
  .filter(([a, b]) => [a, b].every((s) => s.length >= 1 && s.length <= 16));

recipe(
  'lcs',
  stringPairs,
  ([first, second]) => runOk('lcs', { first, second }).document,
  (trace, [first, second]) => {
    const [a, b] = [[...first], [...second]];
    const table = stateOf(trace, 'c', 'table');
    const length = lcsLength(a, b);
    expect(table.data[a.length]![b.length]).toBe(length);
    // Settled cells are matches, strictly increasing in both strings.
    const cells = [...table.marks.settled].sort((x, y) => x[0] - y[0]);
    expect(cells).toHaveLength(length);
    cells.forEach(([i, j], k) => {
      expect(a[i - 1]).toBe(b[j - 1]);
      if (k > 0) {
        expect(i).toBeGreaterThan(cells[k - 1]![0]);
        expect(j).toBeGreaterThan(cells[k - 1]![1]);
      }
    });
  },
);

recipe(
  'edit-distance',
  stringPairs,
  ([first, second]) => runOk('edit-distance', { first, second }).document,
  (trace, [first, second]) => {
    const [a, b] = [[...first], [...second]];
    const table = stateOf(trace, 'D', 'table');
    const D = table.data as readonly (readonly number[])[];
    expect(D[a.length]![b.length]).toBe(levenshtein(a, b));
    // The settled path walks from the corner to the origin, each move
    // accounting for the difference between the cells.
    const path = table.marks.settled;
    expect(path[0]).toEqual([a.length, b.length]);
    expect(path.at(-1)).toEqual([0, 0]);
    for (let k = 1; k < path.length; k++) {
      const [[i, j], [p, q]] = [path[k - 1]!, path[k]!];
      expect([
        [i - 1, j - 1],
        [i - 1, j],
        [i, j - 1],
      ]).toContainEqual([p, q]);
      const cost = p === i - 1 && q === j - 1 && a[p] === b[q] ? 0 : 1;
      expect(D[i]![j]).toBe(D[p]![q]! + cost);
    }
  },
);

const knapsackInput = fc.tuple(
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

function bestValue(items: readonly KnapsackItem[], capacity: number): number {
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

recipe(
  'knapsack',
  knapsackInput,
  ([items, capacity]) => runOk('knapsack', { items, capacity }).document,
  (trace, [items, capacity]) => {
    const table = stateOf(trace, 'K', 'table');
    const best = bestValue(items, capacity);
    expect(table.data[items.length]![capacity]).toBe(best);
    const rows = table.marks.settled.map(([i]) => i);
    expect(new Set(rows).size).toBe(rows.length);
    const taken = rows.map((i) => items[i - 1]!);
    expect(taken.reduce((w, i) => w + i.weight, 0)).toBeLessThanOrEqual(
      capacity,
    );
    expect(taken.reduce((v, i) => v + i.value, 0)).toBe(best);
  },
);

describe('knapsack input checks', () => {
  const badCapacity = fc.oneof(
    fc.integer({ min: 41, max: 1000 }),
    fc.integer({ min: -1000, max: -1 }),
    fc.double({ min: 0, max: 40 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity),
  );
  const badWeight = fc.oneof(
    fc.integer({ min: -100, max: 0 }),
    fc.double({ min: -10, max: 10 }).filter((x) => !Number.isInteger(x)),
    fc.constantFrom(NaN, Infinity, -Infinity),
  );
  it(
    'rejects a capacity that is not an integer from 0 to 40',
    () => {
      fc.assert(
        fc.property(knapsackInput, badCapacity, ([items], capacity) => {
          expect(runError('knapsack', { items, capacity })).toMatchObject({
            code: 'INVALID_SHAPE',
            path: '$.input.capacity',
          });
        }),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
  it(
    'rejects an item weight that is not a positive integer, at its index',
    () => {
      fc.assert(
        fc.property(
          knapsackInput.filter(([items]) => items.length < 8),
          badWeight,
          fc.nat(),
          smallInt,
          ([items, capacity], weight, at, value) => {
            const k = at % (items.length + 1);
            const bad = items.toSpliced(k, 0, { weight, value });
            expect(
              runError('knapsack', { items: bad, capacity }),
            ).toMatchObject({
              code: 'INVALID_SHAPE',
              path: `$.input.items[${k}].weight`,
            });
          },
        ),
        { numRuns: runs },
      );
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Graphs

/**
 * Valid node ids, including names that look like generated edge ids and
 * names of built-in object properties.
 */
const nodeName = fc
  .oneof(
    fc.stringMatching(/^[A-Za-z0-9_.:-]{1,4}$/),
    fc.constantFrom('A', 'B', 'C', 'A-B', 'B-A', 'A-B.2', '1', '2', '1-2'),
    // Valid ids that are also properties of every object.
    fc.constantFrom('__proto__', 'constructor', 'toString', 'valueOf'),
  )
  .filter(clean);

type Edge = GraphInput['edges'][number];

/**
 * Graphs on valid node names, with self-loops and parallel edges; half of
 * them are small and dense, to stack many edges on few nodes.
 */
function graphs(
  weight: fc.Arbitrary<number | undefined>,
  { minNodes = 0, dag = false } = {},
): fc.Arbitrary<GraphInput> {
  return fc.oneof(
    graphsOf(weight, { minNodes, dag, maxNodes: 10, maxEdges: 24 }),
    graphsOf(weight, { minNodes, dag, maxNodes: 3, maxEdges: 16 }),
  );
}

function graphsOf(
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

const withStart = (arb: fc.Arbitrary<GraphInput>) =>
  arb.chain((g) => fc.tuple(fc.constant(g), fc.constantFrom(...g.nodes)));

const optional = (w: fc.Arbitrary<number>) =>
  fc.option(w, { nil: undefined, freq: 4 });
const nonNegative = optional(
  fc.oneof(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 1e6 }),
    fc.integer({ min: 0, max: 40 }).map((k) => k / 2),
  ),
);
const anyWeight = optional(
  fc.oneof(
    fc.integer({ min: -6, max: 20 }),
    fc.integer({ min: -1e6, max: 1e6 }),
    fc.integer({ min: -10, max: 40 }).map((k) => k / 2),
  ),
);

/** Arcs of a graph, both ways for undirected edges. */
function arcs(g: GraphInput, directed = g.directed ?? false) {
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
function shortest(g: GraphInput, s: string, directed?: boolean) {
  const as = arcs(g, directed);
  const d = new Map(g.nodes.map((v) => [v, v === s ? 0 : Infinity]));
  for (let k = 1; k < g.nodes.length; k++)
    for (const { u, v, w } of as)
      if (d.get(u)! + w < d.get(v)!) d.set(v, d.get(u)! + w);
  const negativeCycle = as.some(({ u, v, w }) => d.get(u)! + w < d.get(v)!);
  return { d, negativeCycle };
}

function reachable(g: GraphInput, s: string, directed?: boolean): Set<string> {
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
const own = <V>(record: Readonly<Record<string, V>>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

const selected = (g: GraphState) =>
  g.data.edges.filter((e) => own(g.marks.edgeMarks, e.id) === 'selected');
const weightOf = (edges: GraphState['data']['edges']) =>
  edges.reduce((sum, e) => sum + Number(e.weight ?? 1), 0);

/** Whether some edges contain no cycle (as undirected edges). */
function isForest(edges: GraphState['data']['edges']): boolean {
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
function msfWeight(g: GraphInput, nodes: ReadonlySet<string>): number {
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
const shown = (d: number) => (d === Infinity ? '∞' : String(d));
const steps = (trace: Trace, id: string) =>
  trace.visualization.steps.filter((s) => s.meta?.id === id).length;

recipe(
  'bfs',
  withStart(graphs(nonNegative, { minNodes: 1 })),
  ([graph, source]) => runOk('bfs', { graph, source }).document,
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
  (graph) => runOk('dfs', { graph }).document,
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
  ([graph, source]) => runOk('dijkstra', { graph, source }).document,
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
  ([graph, source]) => runOk('bellman-ford', { graph, source }).document,
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

/** The number of connected components, edges taken both ways. */
const componentCount = (g: GraphInput) =>
  new Set(g.nodes.map((v) => [...reachable(g, v, false)].sort().join('\u0000')))
    .size;

recipe(
  'prim',
  withStart(graphs(anyWeight, { minNodes: 1 })),
  ([graph, root]) => runOk('prim', { graph, root }).document,
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
  (graph) => runOk('kruskal', { graph }).document,
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

recipe(
  'topological-sort',
  graphs(nonNegative, { minNodes: 1, dag: true }),
  (graph) => runOk('topological-sort', { graph }).document,
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
  ([graph, source]) => runOk('dag-shortest-paths', { graph, source }).document,
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
  (graph) => runOk('strongly-connected-components', { graph }).document,
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
  (graph) => runOk('johnson', { graph }).document,
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
  (graph) => runOk('transitive-closure', { graph }).document,
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
  (graph) => runOk('edmonds-karp', { graph }).document,
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
  (graph) => runOk('bipartite-matching', { graph }).document,
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
  (graph) => runOk('hopcroft-karp', { graph }).document,
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
  (input) => runOk('gale-shapley', input).document,
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
  (weights) => runOk('hungarian', { weights }).document,
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
  (graph) => runOk('floyd-warshall', { graph }).document,
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

// ---------------------------------------------------------------------------
// Well-typed inputs outside what the recipes check. A recipe should reject
// them with a RangeError, as it does for the inputs it checks, or still give
// a document that loads; not crash with another error, hang, or give a
// document the engine rejects.

/** Either a RangeError or a document that loads. */
function total<T>(
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
const allGraphModules = (graph: GraphInput): VisualizationInput[] => {
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

describe('inputs outside the checked domain', () => {
  // Any valid node id is up to 64 characters long; "from-to" edge ids of
  // two such names are not.
  total(
    'graph recipes with long node names',
    fc
      .uniqueArray(fc.stringMatching(/^[A-Za-z0-9_]{1,64}$/), {
        minLength: 1,
        maxLength: 4,
      })
      .filter((nodes) => nodes.every(clean))
      .chain((nodes) =>
        fc.record({
          nodes: fc.constant(nodes),
          edges: fc.array(
            fc
              .tuple(fc.constantFrom(...nodes), fc.constantFrom(...nodes))
              .map(([u, v]): Edge => [u, v, 1]),
            { maxLength: 4 },
          ),
        }),
      ),
    allGraphModules,
  );

  total(
    'graph recipes with an edge to a node that is not in the graph',
    graphs(nonNegative, { minNodes: 1 }).chain((g) =>
      fc
        .tuple(
          nodeName.filter((v) => !g.nodes.includes(v)),
          fc.constantFrom(...g.nodes),
          fc.boolean(),
        )
        .map(([stranger, v, out]): GraphInput => ({
          ...g,
          edges: [...g.edges, out ? [v, stranger] : [stranger, v]],
        })),
    ),
    allGraphModules,
  );

  // Strings longer than 16 characters and more than 8 items are refused
  // at their paths rather than drawn as huge tables.
  it(
    'string tables and knapsack refuse inputs over their limits',
    () => {
      fc.assert(
        fc.property(
          fc.string({
            unit: fc.constantFrom('a', 'b'),
            minLength: 17,
            maxLength: 140,
          }),
          fc.string({ minLength: 1, maxLength: 3 }).filter(clean),
          (long, short) => {
            for (const id of ['lcs', 'edit-distance'])
              expect(runError(id, { first: long, second: short }).path).toBe(
                '$.input.first',
              );
          },
        ),
        { numRuns: runs },
      );
      const items = Array.from({ length: 9 }, () => ({ weight: 1, value: 1 }));
      expect(runError('knapsack', { items, capacity: 3 }).path).toBe(
        '$.input.items',
      );
    },
    TIMEOUT,
  );
});

// String matching (ADR 0037): texts over a few letters, so that matches,
// overlaps and spurious hits happen; every matcher finds every shift.

const matchInput = fc
  .tuple(
    fc.string({ unit: fc.constantFrom('a', 'b'), minLength: 1, maxLength: 24 }),
    fc.string({ unit: fc.constantFrom('a', 'b'), minLength: 1, maxLength: 10 }),
  )
  .filter(([text, pattern]) => pattern.length <= text.length)
  .map(([text, pattern]) => ({ text, pattern }));

for (const id of [
  'naive-string-matcher',
  'rabin-karp',
  'finite-automaton-matcher',
  'kmp',
])
  recipe(
    id,
    matchInput,
    (input) => runOk(id, input).document,
    (trace, { text, pattern }) => {
      const want: number[] = [];
      for (let s = 0; s + pattern.length <= text.length; s++)
        if (text.startsWith(pattern, s)) want.push(s);
      const shifts = stateOf(trace, 'shifts', 'array').data.map((e) => e.value);
      expect(shifts).toEqual(want);
    },
  );

// Computational geometry (ADR 0038): points on a small grid, so that
// collinear points and equal x happen.

const gridPoints = (min: number, max: number) =>
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

for (const id of ['graham-scan', 'jarvis-march'])
  recipe(
    id,
    gridPoints(3, 24),
    (points) => runOk(id, { points }).document,
    (trace) => {
      const P = stateOf(trace, 'P', 'plane');
      // As many hull edges chosen as hull vertices settled.
      expect(P.marks.selected.length).toBe(P.marks.settled.length);
    },
  );

recipe(
  'closest-pair',
  gridPoints(2, 16),
  (points) => runOk('closest-pair', { points }).document,
  (trace) => {
    const P = stateOf(trace, 'P', 'plane');
    expect(P.marks.selected).toHaveLength(1);
  },
);

recipe(
  'any-segments-intersect',
  fc.uniqueArray(
    fc
      .tuple(
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
        ),
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
        ),
      )
      .filter(([a, b]) => a[0] !== b[0]),
    {
      minLength: 1,
      maxLength: 12,
      selector: ([a, b]) => [a.join(), b.join()].sort().join(' '),
    },
  ),
  (segments) => runOk('any-segments-intersect', { segments }).document,
  (trace) => {
    const P = stateOf(trace, 'P', 'plane');
    // Either two segments are chosen, as the pair found, or none.
    expect([0, 2]).toContain(P.marks.selected.length);
  },
);

// LUP decomposition: small integer matrices, singular ones included.
recipe(
  'lup-decomposition',
  fc.integer({ min: 1, max: 4 }).chain((n) =>
    fc.array(
      fc.array(fc.integer({ min: -5, max: 5 }), {
        minLength: n,
        maxLength: n,
      }),
      { minLength: n, maxLength: n },
    ),
  ),
  (a) => runOk('lup-decomposition', { a }).document,
  (trace, a) => {
    // π stays a permutation of the rows.
    const pi = stateOf(trace, 'pi', 'table').data[0]!.map(Number);
    expect([...pi].sort((x, y) => x - y)).toEqual(
      Array.from({ length: a.length }, (_, i) => i + 1),
    );
  },
);

// FFT: coefficients of every allowed length.
recipe(
  'fft',
  fc.constantFrom(1, 2, 4, 8, 16).chain((n) =>
    fc.array(fc.integer({ min: -99, max: 99 }), {
      minLength: n,
      maxLength: n,
    }),
  ),
  (coefficients) => runOk('fft', { coefficients }).document,
  (trace, coefficients) => {
    // y_0 is the sum of the coefficients, a real number.
    const y0 = stateOf(trace, 'T', 'table').data[0]![1];
    const sum = coefficients.reduce((s, x) => s + x, 0);
    expect(String(y0).replace('−', '-')).toBe(String(sum));
  },
);

// Suffix array: texts over a few letters, so suffixes share prefixes.
recipe(
  'suffix-array',
  fc.string({
    unit: fc.constantFrom('a', 'b', 'n'),
    minLength: 1,
    maxLength: 16,
  }),
  (text) => runOk('suffix-array', { text }).document,
  (trace, text) => {
    // The suffix column is in increasing order.
    const suffixes = stateOf(trace, 'S', 'table').data.map((r) => String(r[1]));
    expect(suffixes).toEqual([...suffixes].sort());
    expect(suffixes).toHaveLength(text.length);
  },
);
