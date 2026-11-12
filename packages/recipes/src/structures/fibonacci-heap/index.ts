/**
 * The Fibonacci heap (ADR 0034): `fibonacci-heap.insert`, `.union`,
 * `.extract-min`, `.decrease-key`, `.delete` and the sequence. The heap is
 * a forest with a circular root list and `min` above its root; a run that
 * extracts also draws CONSOLIDATE's array `A` beside it, and one that
 * unites draws the second heap `H2` under it (both declared from the
 * run's calls, since every structure is declared before the first step).
 * Keys are distinct; `from` and `after` are the forest notation.
 */
import type { StructureDeclInput, TreeNode } from '@algomotion/spec';
import { z } from 'zod';

import { parseIn } from '../../notation/error.ts';
import type { Handle } from '../../recorder.ts';
import {
  defineStructure,
  MAX_SIZE,
  operationsOf,
  type Call,
  type Sides,
} from '../../structure.ts';
import { afterFirstStep, silentHandle, type Trace } from '../../trace.ts';
import { stepsOf } from '../red-black/engine.ts';
import {
  DELETE_STANDS,
  FIB_DECREASE_KEY,
  FIB_DELETE,
  FIB_EXTRACT_MIN,
  FIB_INSERT,
  FIB_UNION,
} from './listings.ts';
import {
  buildHeap,
  maxDegree,
  nodeOf,
  printHeap,
  valueOf,
  type Entry,
  type FibHeap,
} from './model.ts';
import { FOREST_FORM, parseForest } from './notation.ts';
import {
  decreaseKey,
  deleteKey,
  extractMin,
  insert,
  secondHeap,
  showHeap,
  union,
  type FibRun,
  type FibState,
} from './operations.ts';

/** A tree of the JSON form: a key, or a key with a mark and children. */
const EntrySchema: z.ZodType<Entry | number> = z.lazy(
  (): z.ZodType<Entry | number> =>
    z.union([
      z.number(),
      z.strictObject({
        key: z.number(),
        marked: z.boolean().optional(),
        children: z.array(EntrySchema).optional(),
      }),
    ]) as unknown as z.ZodType<Entry | number>,
);

const Forest = z
  .union([
    z
      .string()
      .transform((s, ctx) =>
        parseIn(s, ctx, parseForest, `Write ${FOREST_FORM}.`),
      )
      .describe(`The forest as text: ${FOREST_FORM}.`),
    z
      .array(EntrySchema)
      .describe(
        'Trees left to right: a key, or { "key", "marked"?, "children"? }; a list of keys is a root list of one-node trees.',
      ),
  ])
  .describe(`A Fibonacci heap: ${FOREST_FORM}.`) as z.ZodType<From, unknown>;

/**
 * A forest: parsed trees, or the notation, which `after` is and which the
 * schema reads into trees (ADR 0034).
 */
type From = string | readonly (Entry | number)[];

const treesOf = (from: From) =>
  typeof from === 'string' ? parseForest(from) : from;

/** The heap a forest describes, checked; at most 32 keys. */
function heapOf(from: From, prefix = 'n'): FibHeap {
  const h = buildHeap(treesOf(from), prefix);
  if (h.nodes.size > MAX_SIZE)
    throw new RangeError(
      `A heap holds at most ${MAX_SIZE} keys, not ${h.nodes.size}`,
    );
  return h;
}

/** A heap's declaration: a forest with a circular root list. */
function declareHeap(h: FibHeap): StructureDeclInput & { kind: 'tree' } {
  const nodes = h.roots
    .flatMap(function walk(id): string[] {
      return [id, ...nodeOf(h, id).children.flatMap(walk)];
    })
    .map((id): TreeNode => {
      const n = nodeOf(h, id);
      return n.children.length === 0
        ? { id, value: valueOf(n.key) }
        : { id, value: valueOf(n.key), children: [...n.children] };
    });
  return { kind: 'tree', rootList: 'circular', nodes, roots: [...h.roots] };
}

const sidesOf = (sides: Sides) => ({
  ...(sides['A'] === undefined ? {} : { A: sides['A'] as Handle<'array'> }),
  ...(sides['H2'] === undefined ? {} : { H2: sides['H2'] as Handle<'tree'> }),
});

/**
 * The run of one operation, with the heap's marks shown from its first
 * step, which also blanks the cells of A an earlier CONSOLIDATE left.
 */
function runOf(
  s: FibState,
  trace: Trace,
  on: Handle<'tree'>,
  sides: Sides,
  listing: Parameters<typeof stepsOf>[1],
  stands: Readonly<Record<string, string>> = {},
): FibRun {
  const { A, H2 } = sidesOf(sides);
  const shown = afterFirstStep(trace, () => {
    showHeap(on, s.heap);
    for (let d = 0; d < s.aCells; d++) A?.set({ index: d, value: '' });
  });
  return {
    step: stepsOf(shown, listing, stands),
    on,
    ...(A === undefined ? {} : { A }),
    ...(H2 === undefined ? {} : { H2 }),
  };
}

/** The state an operation starts from: A's old cells are blanked by then. */
const fresh = (s: FibState): FibState => ({ ...s, aCells: 0 });

const silentRun = (): FibRun => ({
  step: () => undefined,
  on: silentHandle('tree'),
  A: silentHandle('array'),
  H2: silentHandle('tree'),
});

/**
 * How many cells A needs for the calls a run makes, applied silently:
 * D(n) + 1 for the largest heap the run reaches, or more when a
 * hand-written forest has a root of greater degree than D(n).
 */
function cellsOfA(from: From, calls: readonly Call[]): number {
  let s: FibState = { heap: heapOf(from), unions: 0, aCells: 0 };
  let most = s.heap.nodes.size;
  const reach = { cells: 0 };
  const run = { ...silentRun(), reach };
  for (const call of calls) {
    try {
      s = apply(s, call, run);
    } catch (e) {
      // A refused call: the real run reports it, and stops there too.
      if (!(e instanceof RangeError)) throw e;
      break;
    }
    most = Math.max(most, s.heap.nodes.size);
  }
  return Math.max(maxDegree(most) + 1, reach.cells);
}

function apply(s: FibState, call: Call, run: FibRun): FibState {
  const args = call as Record<string, unknown>;
  switch (call.op) {
    case 'insert':
      return insert(s, args['key'] as number, run);
    case 'union':
      return union(s, treesOf(args['with'] as From), run);
    case 'extract-min':
      return extractMin(s, run).state;
    case 'decrease-key':
      return decreaseKey(s, args['key'] as number, args['to'] as number, run);
    default:
      return deleteKey(s, args['key'] as number, run);
  }
}

const SAMPLE = '23 7 3(18*(39*) 52 38(41)) 17(30) 24(26*(35) 46)';
const Key = z.number();

const op = operationsOf<FibState, From, 'tree'>();

/** A Fibonacci heap, one operation at a time. */
export const fibonacciHeap = defineStructure<FibState, From, 'tree'>({
  id: 'fibonacci-heap',
  title: 'Fibonacci heap',
  topic: 'heaps',
  summary:
    'A forest of min-heap-ordered trees in a circular root list: insert and union are lazy, extract-min consolidates roots of equal degree, and decrease-key cuts, with cascading cuts of marked nodes.',
  name: 'H',
  kind: 'tree',
  from: Forest,
  examples: [
    {
      from: parseForest(SAMPLE),
      ops: [
        { op: 'insert', key: 21 },
        { op: 'extract-min' },
        { op: 'decrease-key', key: 46, to: 15 },
        { op: 'decrease-key', key: 35, to: 5 },
      ],
    },
  ],
  start: (from) => ({ heap: heapOf(from), unions: 0, aCells: 0 }),
  describe: (s) => printHeap(s.heap),
  declare: (s) => declareHeap(s.heap),
  auxiliary(from, calls) {
    const sides: Record<string, StructureDeclInput> = {};
    const first = calls.find((c) => c.op === 'union');
    if (first !== undefined)
      sides['H2'] = declareHeap(secondHeap(treesOf(first['with'] as From), 0));
    if (calls.some((c) => c.op === 'extract-min' || c.op === 'delete')) {
      sides['A'] = {
        kind: 'array',
        place: 'side',
        initial: Array.from({ length: cellsOfA(from, calls) }, () => ''),
      };
    }
    return sides;
  },
  clear(on) {
    on.pointer({ name: 'x', node: null });
  },
  operations: [
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Puts a new one-node tree in the root list, just left of the minimum, and makes it the minimum if its key is less.',
      args: { key: Key.describe('The key to insert.') },
      examples: [{ from: parseForest(SAMPLE), key: 21 }],
      code: FIB_INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on, sides) => ({
        state: insert(fresh(s), key, runOf(s, trace, on, sides, FIB_INSERT)),
        result: null,
      }),
    }),
    op({
      name: 'union',
      title: 'union',
      summary:
        'Joins the root list of a second heap to this one’s and keeps the lesser minimum; nothing else moves.',
      args: {
        with: Forest.describe('The second heap, in the forms of `from`.'),
      },
      examples: [
        {
          from: parseForest('3(18 52) 17(30) 24'),
          with: parseForest('5(8) 21 14(19)'),
        },
      ],
      code: FIB_UNION,
      titleOf: () => 'union',
      apply: (s, args, trace, on, sides) => ({
        state: union(
          fresh(s),
          treesOf(args.with),
          runOf(s, trace, on, sides, FIB_UNION),
        ),
        result: null,
      }),
    }),
    op({
      name: 'extract-min',
      title: 'extract-min',
      summary:
        'Removes the minimum, moves its children to the root list, then consolidates: roots of equal degree are linked until every degree is different.',
      args: {},
      examples: [
        {
          from: parseForest(
            '23 7 21 3(18*(39*) 52 38(41)) 17(30) 24(26*(35) 46)',
          ),
        },
      ],
      code: FIB_EXTRACT_MIN,
      titleOf: () => 'extract-min',
      apply: (s, _, trace, on, sides) => {
        const { state, key } = extractMin(
          fresh(s),
          runOf(s, trace, on, sides, FIB_EXTRACT_MIN),
        );
        return { state, result: key };
      },
    }),
    op({
      name: 'decrease-key',
      title: 'decrease key',
      summary:
        'Lowers a key; if it falls below its parent’s, the node is cut to the root list, and marked ancestors are cut too, up to the first unmarked one, which is marked.',
      args: {
        key: Key.describe('The key of the node to decrease.'),
        to: Key.describe('Its new key, smaller than the old one.'),
      },
      examples: [
        {
          from: parseForest('7(24(26*(35) 46) 17(30) 23) 18*(39*) 38(41)'),
          key: 46,
          to: 15,
        },
        {
          from: parseForest('15 7(24*(26*(35)) 17(30) 23) 18*(39*) 38(41)'),
          key: 35,
          to: 5,
        },
      ],
      code: FIB_DECREASE_KEY,
      titleOf: ({ key, to }) => `decrease ${key} to ${to}`,
      apply: (s, { key, to }, trace, on, sides) => ({
        state: decreaseKey(
          fresh(s),
          key,
          to,
          runOf(s, trace, on, sides, FIB_DECREASE_KEY),
        ),
        result: null,
      }),
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Deletes a key by decreasing it to −∞, which makes it the minimum, and extracting the minimum.',
      args: { key: Key.describe('The key to delete.') },
      examples: [{ from: parseForest(SAMPLE), key: 26 }],
      code: FIB_DELETE,
      titleOf: ({ key }) => `delete ${key}`,
      apply: (s, { key }, trace, on, sides) => ({
        state: deleteKey(
          fresh(s),
          key,
          runOf(s, trace, on, sides, FIB_DELETE, DELETE_STANDS),
        ),
        result: null,
      }),
    }),
  ],
});
