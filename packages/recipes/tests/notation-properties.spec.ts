/**
 * Property tests of the input notations (ADR 0032):
 * - parsing a printed notation gives the structured value back;
 * - a notation, the main field alone and the structured form give the
 *   same document;
 * - random text either parses or fails with a `NotationError` inside it.
 *
 * Run bigger with `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/notation-properties.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { runAlgorithm } from '../src/index.ts';
import {
  NotationError,
  parseGraph,
  parseList,
  parseOperations,
  printGraph,
  printList,
  printOperations,
  type OperationShape,
  type StructuredGraph,
} from '../src/notation/index.ts';
import { fuzz } from './helpers.ts';

const LIMITS = { maxNodes: 40, maxEdges: 200, maxWeight: 1e9 };

/** Numbers as inputs hold them: integers, and finite doubles, -0 too. */
const numbers = fc.oneof(
  fc.integer({ min: -1000, max: 1000 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.constant(-0),
);

/** Same items, telling -0 from 0. */
const sameItems = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, k) => Object.is(v, b[k]));

describe('round trips', () => {
  it('lists of numbers, level orders and words', () => {
    fc.assert(
      fc.property(
        fc.array(numbers, { maxLength: 40 }),
        fc.array(fc.option(numbers, { nil: null }), { maxLength: 40 }),
        fc.array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { maxLength: 20 }),
        (values, level, words) => {
          expect(
            sameItems(parseList(printList(values)!, 'number'), values),
          ).toBe(true);
          expect(sameItems(parseList(printList(level)!, 'level'), level)).toBe(
            true,
          );
          expect(parseList(printList(words)!, 'word')).toEqual(words);
          expect(
            sameItems(parseList(`[${printList(values)!}]`, 'number'), values),
          ).toBe(true);
        },
      ),
      fuzz,
    );
  });

  it('graphs, keeping node order, edge order, weights and direction', () => {
    fc.assert(
      fc.property(graphs(), (g) => {
        const text = printGraph(g);
        if (g.directed && g.edges.length === 0) {
          expect(text).toBeUndefined();
          return;
        }
        const parsed = parseGraph(text!, LIMITS);
        expect(parsed.nodes).toEqual(g.nodes);
        expect(parsed.edges.length).toBe(g.edges.length);
        parsed.edges.forEach((e, k) => {
          const [from, to, weight] = g.edges[k]!;
          expect(e.slice(0, 2)).toEqual([from, to]);
          expect(e.length).toBe(weight === undefined ? 2 : 3);
          if (weight !== undefined) expect(Object.is(e[2], weight)).toBe(true);
        });
        expect(parsed.directed ?? false).toBe(
          g.edges.length > 0 && (g.directed ?? false),
        );
      }),
      fuzz,
    );
  });

  it('operation lists', () => {
    fc.assert(
      fc.property(fc.array(calls, { maxLength: 12 }), (list) => {
        const text = printOperations(list, OPERATIONS);
        expect(text).toBeDefined();
        expect(parseOperations(text!, OPERATIONS)).toEqual(list);
      }),
      fuzz,
    );
  });
});

describe('the same document', () => {
  const same = (id: string, structured: unknown, ...others: unknown[]) => {
    const expected = runAlgorithm(id, structured);
    for (const other of others) {
      const run = runAlgorithm(id, other);
      expect(run.ok, JSON.stringify(other)).toBe(expected.ok);
      if (run.ok && expected.ok)
        expect(run.value.document).toEqual(expected.value.document);
      if (!run.ok && !expected.ok)
        expect(run.error[0]?.code).toBe(expected.error[0]?.code);
    }
  };

  it('for sorts, written as lists or as the list alone', () => {
    const ids = ['insertion-sort', 'merge-sort', 'heapsort', 'quicksort'];
    fc.assert(
      fc.property(
        fc.constantFrom(...ids),
        fc.array(fc.integer({ min: -99, max: 99 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (id, values) => {
          const text = printList(values)!;
          same(id, { values }, { values: text }, text, values, `[${text}]`);
        },
      ),
      fuzz,
    );
  });

  it('for tree walks, from level orders', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'inorder-tree-walk',
          'preorder-tree-walk',
          'postorder-tree-walk',
        ),
        fc.array(
          fc.option(fc.integer({ min: 0, max: 99 }), { nil: null, freq: 4 }),
          {
            minLength: 1,
            maxLength: 15,
          },
        ),
        (id, levelOrder) => {
          const text = printList(levelOrder)!;
          same(id, { levelOrder }, { levelOrder: text }, text, levelOrder);
        },
      ),
      fuzz,
    );
  });

  it('for graph algorithms, written as edge lists or as the graph alone', () => {
    const ids = [
      'bfs',
      'dfs',
      'dijkstra',
      'bellman-ford',
      'prim',
      'kruskal',
      'topological-sort',
      'floyd-warshall',
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...ids),
        graphs({ maxNodes: 7, weights: 'positive' }),
        (id, g) => {
          const text = printGraph(g);
          if (text === undefined) return;
          const start = id === 'prim' ? 'root' : 'source';
          const needsStart = [
            'bfs',
            'dijkstra',
            'bellman-ford',
            'prim',
          ].includes(id);
          const graph = {
            ...g,
            directed: g.edges.length > 0 && (g.directed ?? false),
          };
          const structured = needsStart
            ? { graph, [start]: g.nodes[0] }
            : { graph };
          same(id, structured, { graph: text }, text, graph);
        },
      ),
      fuzz,
    );
  });

  it('for a BST, a min-heap, a trie and a disjoint-set forest, written as operation lists', () => {
    const keys = fc.integer({ min: 0, max: 30 });
    const bst = fc.record({
      from: fc.array(keys, { maxLength: 8 }),
      ops: fc.array(
        fc.record({
          op: fc.constantFrom('insert', 'delete', 'search'),
          key: keys,
        }),
        { minLength: 1, maxLength: 6 },
      ),
    });
    const heap = fc.record({
      from: fc.array(keys, { maxLength: 8 }),
      ops: fc.array(
        fc.oneof(
          fc.record({ op: fc.constant('push'), value: keys }),
          fc.record({ op: fc.constant('pop') }),
        ),
        { minLength: 1, maxLength: 6 },
      ),
    });
    const trie = fc.record({
      from: fc.array(fc.stringMatching(/^[a-c]{1,4}$/), { maxLength: 5 }),
      ops: fc.array(
        fc.record({
          op: fc.constantFrom('insert', 'search'),
          word: fc.stringMatching(/^[a-c]{1,4}$/),
        }),
        { minLength: 1, maxLength: 6 },
      ),
    });
    const element = fc.integer({ min: 0, max: 5 });
    const sets = fc.record({
      from: fc.record({ size: fc.constant(6) }),
      ops: fc.array(
        fc.oneof(
          fc.record({ op: fc.constant('union'), x: element, y: element }),
          fc.record({ op: fc.constant('find-set'), x: element }),
        ),
        { minLength: 1, maxLength: 6 },
      ),
    });
    /** Written by hand, independently of the printer. */
    const written = (ops: readonly Record<string, unknown>[]) =>
      ops.map((o) => Object.values(o).join(' ')).join(', ');
    fc.assert(
      fc.property(
        fc.oneof(
          bst.map((input) => ['bst', input] as const),
          heap.map((input) => ['min-heap', input] as const),
          trie.map((input) => ['trie', input] as const),
          sets.map((input) => ['disjoint-set', input] as const),
        ),
        ([id, input]) => {
          const from = Array.isArray(input.from)
            ? printList(input.from)!
            : input.from;
          same(
            id,
            input,
            { from: input.from, ops: written(input.ops) },
            { from, ops: written(input.ops) },
          );
        },
      ),
      fuzz,
    );
  });
});

describe('random text', () => {
  /** Parses, or fails with a NotationError inside the text. */
  const parsesOrPoints =
    (parse: (text: string) => unknown) => (text: string) => {
      try {
        parse(text);
      } catch (e) {
        expect(e).toBeInstanceOf(NotationError);
        const { at } = e as NotationError;
        expect(at).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThanOrEqual(text.length);
      }
    };
  const texts = fc.oneof(
    fc.string({ maxLength: 40 }),
    fc.string({
      unit: fc.constantFrom(...'AB12-> ,\n[]null.e+x'),
      maxLength: 40,
    }),
  );

  it('never breaks a parser', () => {
    fc.assert(
      fc.property(texts, (text) => {
        parsesOrPoints((t) => parseList(t, 'number'))(text);
        parsesOrPoints((t) => parseList(t, 'level', z.number().nullable()))(
          text,
        );
        parsesOrPoints((t) => parseList(t, 'word'))(text);
        parsesOrPoints((t) => parseGraph(t, LIMITS))(text);
        parsesOrPoints((t) => parseOperations(t, OPERATIONS))(text);
      }),
      fuzz,
    );
  });
});

// ---------------------------------------------------------------------------
// Generators

/** Graphs whose names the notation can write, in any node order. */
function graphs({
  maxNodes = 12,
  weights = 'any',
}: {
  maxNodes?: number;
  weights?: 'any' | 'positive';
} = {}): fc.Arbitrary<StructuredGraph> {
  const weight =
    weights === 'positive'
      ? fc.integer({ min: 1, max: 20 })
      : fc
          .oneof(numbers, fc.integer({ min: -1e9, max: 1e9 }))
          .filter((w) => Math.abs(w) <= 1e9);
  return fc
    .uniqueArray(fc.stringMatching(/^[A-Za-z0-9_]{1,6}$/), {
      minLength: 1,
      maxLength: maxNodes,
    })
    .chain((nodes) =>
      fc.record({
        nodes: fc.constant(nodes),
        edges: fc.array(
          fc.tuple(
            fc.constantFrom(...nodes),
            fc.constantFrom(...nodes),
            fc.option(weight, { nil: undefined }),
          ),
          { maxLength: 2 * nodes.length },
        ),
        directed: fc.boolean(),
      }),
    )
    .map(({ nodes, edges, directed }) => ({
      nodes,
      edges: edges.map(([from, to, w]) =>
        w === undefined ? ([from, to] as const) : ([from, to, w] as const),
      ),
      directed,
    }));
}

const OPERATIONS: readonly OperationShape[] = [
  { name: 'insert', args: { key: z.int() } },
  {
    name: 'delete',
    args: {
      key: z.int(),
      replaceWith: z.enum(['successor', 'predecessor']).optional(),
    },
  },
  { name: 'pop', args: {} },
  { name: 'set', args: { index: z.int().min(0), value: z.number() } },
  { name: 'add', args: { word: z.string().regex(/^[a-z0-9]+$/) } },
];

const calls = fc.oneof(
  fc.record({ op: fc.constant('insert'), key: fc.integer() }),
  fc.record(
    {
      op: fc.constant('delete'),
      key: fc.integer(),
      replaceWith: fc.constantFrom('successor', 'predecessor'),
    },
    { requiredKeys: ['op', 'key'] },
  ),
  fc.record({ op: fc.constant('pop') }),
  fc.record({ op: fc.constant('set'), index: fc.nat(), value: numbers }),
  // Words that read as numbers stay words: `add` takes no numbers.
  fc.record({
    op: fc.constant('add'),
    word: fc.stringMatching(/^[a-z0-9]{1,6}$/),
  }),
);
