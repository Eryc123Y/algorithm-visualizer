/**
 * The interval tree (ADR 0034): a red–black tree of closed intervals
 * `[low, high]`, ordered by low endpoint and then by high, whose nodes
 * keep the greatest high endpoint in their subtree, shown as the note
 * `max=30`. `search` finds an interval that overlaps a given one, going
 * down one path by the maxima; `insert` and `delete` keep the maxima.
 */
import { z } from 'zod';

import { NotationError, parseIn, quoted } from '../../notation/error.ts';
import { numberAt } from '../../notation/list.ts';
import {
  defineStructure,
  MAX_SIZE,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import { insert, remove, type Family, type Run } from './engine.ts';
import {
  clearPointers,
  declareTree,
  describeState,
  fromSchema,
  LEVEL_ORDER_LIMIT,
  runOf,
  startTree,
  type From,
} from './family.ts';
import {
  INTERVAL_DELETE,
  INTERVAL_INSERT,
  INTERVAL_SEARCH,
} from './interval-listings.ts';
import { fieldOf, nodeOf, type Keys, type RbTree } from './model.ts';
import {
  DELETE_FIXUP_STANDS,
  INSERT_FIXUP_STANDS,
} from './order-statistic-listings.ts';

export type Interval = readonly [number, number];
type State = RbTree<Interval>;

const show = ([low, high]: Interval) => `[${low}, ${high}]`;

const keys: Keys<Interval> = {
  compare: (a, b) => a[0] - b[0] || a[1] - b[1],
  text: show,
  value: ([low, high]) => `[${low},${high}]`,
};

const family: Family<Interval> = {
  keys,
  aug: {
    field: 'max',
    of: ([, high], left, right) =>
      Math.max(high, left ?? -Infinity, right ?? -Infinity),
    down: (max, [, high]) => Math.max(max, high),
    note: (max) => `max=${max}`,
  },
};

const overlaps = (a: Interval, b: Interval) => a[0] <= b[1] && b[0] <= a[1];

/** INTERVAL-SEARCH: down one path, left whenever the left subtree can hold an overlap. */
function search(t: State, i: Interval, run: Run<Interval>): Applied<State> {
  const { on, step } = run;
  const it = show(i);
  let x = t.root;
  let parent: string | null = null;
  let side: 'left' | 'right' = 'left';
  while (x !== null) {
    const node = nodeOf(t, x);
    const at = show(node.key);
    if (overlaps(i, node.key)) {
      step('found', `${at} overlaps ${it}: found.`);
      on.pointer({ name: 'x', node: x }).settle({ node: x });
      return { state: t, result: true };
    }
    const leftMax = fieldOf(t, node.left);
    if (leftMax !== null && leftMax >= i[0]) {
      step(
        'left',
        `${at} does not overlap ${it}. The left subtree reaches up to ${leftMax}, at least ${it}'s low end ${i[0]}, so if any interval overlaps ${it}, one on the left does: go left.`,
      );
      side = 'left';
    } else {
      step(
        'right',
        `${at} does not overlap ${it}, and ${leftMax === null ? 'there is nothing on the left' : `the left subtree reaches only up to ${leftMax}, below ${it}'s low end ${i[0]}`}: go right.`,
      );
      side = 'right';
    }
    on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
    parent = x;
    x = node[side];
  }
  step(
    'none',
    `Reached an empty leaf: no interval in the tree overlaps ${it}.`,
  );
  on.pointer({
    name: 'x',
    node: parent === null ? null : { parent, slot: side === 'left' ? 0 : 1 },
  });
  return { state: t, result: false };
}

const IntervalCore = z
  .tuple([z.number(), z.number()])
  .refine(([low, high]) => low <= high, {
    message: 'An interval is [low, high] with low ≤ high',
  })
  .describe('A closed interval [low, high], e.g. [16, 21].');
const IntervalSchema = IntervalCore as unknown as z.ZodType<Interval, unknown>;

const INTERVALS_FORM =
  'intervals in square brackets, separated by commas or spaces, e.g. "[16,21] [8,9] [25,30]"';

/** Reads `[a, b] [c, d] …`, throwing a NotationError at a bad token. */
export function parseIntervals(text: string): [number, number][] {
  const out: [number, number][] = [];
  const pattern = /\[([^\]]*)\]|\[[^\]]*$|[^\s,[]+/g;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    const token = match[0];
    if (token.startsWith('[') && !token.endsWith(']'))
      throw new NotationError(
        `Expected "]" to end the interval ${quoted(token)}`,
        at + token.length,
      );
    if (match[1] === undefined)
      throw new NotationError(
        `Expected an interval in brackets, not ${quoted(token)}`,
        at,
      );
    // Two endpoints, apart by spaces or one comma.
    const inner = match[1];
    const parts = [...inner.matchAll(/[^\s,]+/g)];
    const commas = inner.split(',').length - 1;
    if (parts.length !== 2 || commas > 1 || /^\s*,|,\s*$/.test(inner))
      throw new NotationError(
        `An interval is two endpoints, such as [16, 21], not ${quoted(token)}`,
        at,
      );
    out.push(
      parts.map((part) =>
        numberAt(part[0], at + 1 + part.index, 'an endpoint'),
      ) as [number, number],
    );
  }
  return out;
}

const intervalArray = z.array(IntervalCore).max(MAX_SIZE);
const intervalList = z.union([
  z
    .string()
    .transform((s, ctx) =>
      parseIn(s, ctx, parseIntervals, `Write ${INTERVALS_FORM}.`),
    )
    .pipe(intervalArray)
    .describe(`The intervals as text: ${INTERVALS_FORM}.`),
  intervalArray,
]) as unknown as z.ZodType<readonly Interval[], unknown>;
const levelList = z
  .array(IntervalSchema.nullable())
  .max(LEVEL_ORDER_LIMIT) as unknown as z.ZodType<
  readonly (Interval | null)[],
  unknown
>;

/** CLRS's example: ten intervals, inserted in this order. */
const SAMPLE: Interval[] = [
  [16, 21],
  [8, 9],
  [25, 30],
  [5, 8],
  [15, 23],
  [17, 19],
  [26, 26],
  [0, 3],
  [6, 10],
  [19, 20],
];

const op = operationsOf<State, From<Interval>, 'tree'>();

/** Overlap search in a red–black tree of intervals that keeps maxima. */
export const intervalTree = defineStructure<State, From<Interval>, 'tree'>({
  id: 'interval-tree',
  title: 'Interval tree',
  topic: 'trees',
  summary:
    'A red–black tree of intervals by low endpoint whose nodes keep the greatest high endpoint below them, so that an overlapping interval is found on one path.',
  name: 'T',
  kind: 'tree',
  from: fromSchema(
    intervalList,
    levelList,
    '{ "levelOrder": [[16, 21], [8, 9], [25, 30]], "red": [] }',
  ),
  examples: [
    {
      from: SAMPLE,
      ops: [
        { op: 'search', interval: [22, 25] },
        { op: 'search', interval: [11, 14] },
        { op: 'insert', interval: [12, 13] },
        { op: 'search', interval: [11, 14] },
      ],
    },
  ],
  start: (from) => startTree(from, family),
  describe: describeState,
  declare: (s) => declareTree(s, family),
  clear: clearPointers,
  operations: [
    op({
      name: 'search',
      title: 'search',
      summary:
        'Finds an interval that overlaps the given one, or none: it goes left whenever the left subtree reaches the low end, since an overlap is then on the left if anywhere.',
      args: { interval: IntervalSchema.describe('The interval to overlap.') },
      examples: [
        { from: SAMPLE, interval: [22, 25] },
        { from: SAMPLE, interval: [11, 14] },
      ],
      code: INTERVAL_SEARCH,
      titleOf: ({ interval }) => `search ${show(interval)}`,
      apply: (s, { interval }, trace, on) =>
        search(
          s,
          interval,
          runOf(s, trace, on, INTERVAL_SEARCH, family, { none: 'found' }),
        ),
    }),
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts an interval as in a red–black tree, raising the max of every node on the way down to its high end where it is higher.',
      args: { interval: IntervalSchema.describe('The interval to insert.') },
      examples: [{ from: SAMPLE, interval: [12, 13] }],
      code: INTERVAL_INSERT,
      titleOf: ({ interval }) => `insert ${show(interval)}`,
      apply: (s, { interval }, trace, on) => ({
        state: insert(
          s,
          interval,
          runOf(s, trace, on, INTERVAL_INSERT, family, INSERT_FIXUP_STANDS),
        ),
        result: null,
      }),
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Deletes an interval as in a red–black tree, then recomputes the maxima from where the removed node’s place was filled up to the root.',
      args: { interval: IntervalSchema.describe('The interval to delete.') },
      examples: [{ from: SAMPLE, interval: [16, 21] }],
      code: INTERVAL_DELETE,
      titleOf: ({ interval }) => `delete ${show(interval)}`,
      apply: (s, { interval }, trace, on) => ({
        state: remove(
          s,
          interval,
          runOf(s, trace, on, INTERVAL_DELETE, family, DELETE_FIXUP_STANDS),
        ),
        result: null,
      }),
    }),
  ],
});
