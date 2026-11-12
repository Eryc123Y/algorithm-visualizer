/**
 * The order-statistic tree (ADR 0034): a red–black tree whose nodes keep
 * the size of their subtree, shown as the note `s=5`. `select` finds the
 * key of a given rank and `rank` the rank of a given key, both counting
 * from 1; `insert` and `delete` keep the sizes on the way, and the
 * red–black fixups' rotations keep them too.
 */
import { z } from 'zod';

import { listField } from '../../notation/schema.ts';
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
import { fieldOf, nodeOf, numberKeys, sideOf, type RbTree } from './model.ts';
import {
  DELETE_FIXUP_STANDS,
  INSERT_FIXUP_STANDS,
  OS_DELETE,
  OS_INSERT,
  OS_RANK,
  OS_SELECT,
} from './order-statistic-listings.ts';

type State = RbTree<number>;

const family: Family<number> = {
  keys: numberKeys,
  aug: {
    field: 'size',
    of: (_, left, right) => 1 + (left ?? 0) + (right ?? 0),
    down: (size) => size + 1,
    note: (size) => `s=${size}`,
  },
};

/** 1st, 2nd, 3rd, 4th, …, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const teen = Math.floor(n / 10) % 10 === 1;
  const suffix =
    !teen && n % 10 === 1
      ? 'st'
      : !teen && n % 10 === 2
        ? 'nd'
        : !teen && n % 10 === 3
          ? 'rd'
          : 'th';
  return `${n}${suffix}`;
}

const keysBelow = (n: number) => `${n} key${n === 1 ? '' : 's'}`;

/** OS-SELECT: the key of rank `i`, walking down by the sizes. */
function select(t: State, i: number, run: Run<number>): Applied<State> {
  const { on, step } = run;
  const n = t.nodes.size;
  if (n === 0)
    throw new RangeError('The tree is empty: there is nothing to select');
  if (!Number.isInteger(i) || i < 1 || i > n)
    throw new RangeError(
      `The tree holds ${keysBelow(n)}, so the rank to select is a whole number from 1 to ${n}, not ${i}`,
    );
  let x = t.root!;
  let want = i;
  for (;;) {
    const node = nodeOf(t, x);
    const left = fieldOf(t, node.left) ?? 0;
    const r = left + 1;
    const head = `At ${node.key}: ${keysBelow(left)} on its left make it the ${ordinal(r)} here`;
    if (want === r) {
      step(
        'found',
        `${head}, the one we want: ${node.key} is the ${ordinal(i)} smallest key.`,
      );
      on.pointer({ name: 'x', node: x }).settle({ node: x });
      return { state: t, result: node.key };
    }
    if (want < r) {
      step('left', `${head}; we want the ${ordinal(want)}: go left.`);
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      x = node.left!;
    } else {
      step(
        'right',
        `${head}; we want the ${ordinal(want)}, so skip ${keysBelow(r)} and look for the ${ordinal(want - r)} on the right.`,
      );
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      want -= r;
      x = node.right!;
    }
  }
}

/** OS-RANK: finds `key`, then adds up what comes before it on the way up. */
function rank(t: State, key: number, run: Run<number>): Applied<State> {
  const { on, step } = run;
  let x = t.root;
  while (x !== null) {
    const node = nodeOf(t, x);
    if (node.key === key) {
      step('find', `Found ${key}.`);
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      break;
    }
    const side = key < node.key ? 'left' : 'right';
    step(
      'find',
      `${key} ${side === 'left' ? '<' : '>'} ${node.key}: go ${side}.`,
    );
    on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
    x = node[side];
  }
  if (x === null) {
    step('missing', `${key} is not in the tree, so it has no rank.`);
    on.pointer({ name: 'x', node: null });
    return { state: t, result: null };
  }
  let r = (fieldOf(t, nodeOf(t, x).left) ?? 0) + 1;
  step(
    'start',
    `${keysBelow(r - 1)} below ${key} on its left come before it: it is the ${ordinal(r)} in its own subtree.`,
  );
  on.pointer({ name: 'y', node: x });
  for (let y = x; y !== t.root;) {
    const p = nodeOf(t, y).parent!;
    const pk = nodeOf(t, p).key;
    if (sideOf(t, y) === 'right') {
      const before = (fieldOf(t, nodeOf(t, p).left) ?? 0) + 1;
      r += before;
      step(
        'add',
        `${nodeOf(t, y).key} is a right child: ${pk} and the ${keysBelow(before - 1)} on its left come before it too, so ${key} is the ${ordinal(r)} so far.`,
      );
    } else
      step(
        'up',
        `${nodeOf(t, y).key} is a left child: nothing on ${pk}'s side comes before it. Go up to ${pk}.`,
      );
    on.pointer({ name: 'y', node: p }).highlight({ nodes: [p] });
    y = p;
  }
  step('rank', `At the root: ${key} is the ${ordinal(r)} smallest key.`);
  on.pointer({ name: 'y', node: null }).settle({ node: x });
  return { state: t, result: r };
}

const SAMPLE = [
  26, 17, 41, 14, 21, 30, 47, 10, 16, 19, 23, 28, 38, 7, 12, 20, 35, 39, 3,
];

const keyList = listField(
  z.array(z.number()).max(MAX_SIZE).describe('Keys, e.g. [26, 17, 41, 14].'),
  'number',
);
const levelList = listField(
  z.array(z.number().nullable()).max(LEVEL_ORDER_LIMIT),
  'level',
);
const Key = z.number();

const op = operationsOf<State, From<number>, 'tree'>();

/** Selection and rank in a red–black tree that keeps subtree sizes. */
export const orderStatisticTree = defineStructure<State, From<number>, 'tree'>({
  id: 'order-statistic-tree',
  title: 'Order-statistic tree',
  topic: 'trees',
  summary:
    'A red–black tree whose nodes keep their subtree sizes, so that the key of any rank, and the rank of any key, is found on one path.',
  name: 'T',
  kind: 'tree',
  from: fromSchema(
    keyList.describe(
      'Keys in insertion order that build the starting tree, e.g. [26, 17, 41, 14, 21]; a repeated key is skipped.',
    ),
    levelList,
    '{ "levelOrder": [17, 14, 26], "red": [] }',
  ),
  examples: [
    {
      from: SAMPLE,
      ops: [
        { op: 'select', i: 10 },
        { op: 'rank', key: 38 },
        { op: 'insert', key: 15 },
        { op: 'select', i: 10 },
      ],
    },
  ],
  start: (from) => startTree(from, family),
  describe: describeState,
  declare: (s) => declareTree(s, family),
  clear: clearPointers,
  operations: [
    op({
      name: 'select',
      title: 'select',
      summary:
        'Finds the key of rank i (the ith smallest, from 1), going left or right by the size of each left subtree.',
      args: {
        i: z
          .number()
          .describe('The rank to find, from 1 to the number of keys.'),
      },
      examples: [
        { from: SAMPLE, i: 10 },
        { from: SAMPLE, i: 1 },
      ],
      code: OS_SELECT,
      titleOf: ({ i }) => `select ${i}`,
      apply: (s, { i }, trace, on) =>
        select(s, i, runOf(s, trace, on, OS_SELECT, family)),
    }),
    op({
      name: 'rank',
      title: 'rank',
      summary:
        'Finds a key, then counts the keys before it, adding a parent and its left subtree whenever it climbs from a right child.',
      args: { key: Key.describe('The key whose rank to find.') },
      examples: [
        { from: SAMPLE, key: 38 },
        { from: SAMPLE, key: 11 },
      ],
      code: OS_RANK,
      titleOf: ({ key }) => `rank ${key}`,
      apply: (s, { key }, trace, on) =>
        rank(s, key, runOf(s, trace, on, OS_RANK, family)),
    }),
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a key as in a red–black tree, adding one to the size of every node on the way down; the fixup’s rotations recompute the sizes they change.',
      args: { key: Key.describe('The key to insert.') },
      examples: [{ from: SAMPLE, key: 15 }],
      code: OS_INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on) => ({
        state: insert(
          s,
          key,
          runOf(s, trace, on, OS_INSERT, family, INSERT_FIXUP_STANDS),
        ),
        result: null,
      }),
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Deletes a key as in a red–black tree, then recomputes the sizes on the path from where the removed node’s place was filled up to the root.',
      args: { key: Key.describe('The key to delete.') },
      examples: [{ from: SAMPLE, key: 17 }],
      code: OS_DELETE,
      titleOf: ({ key }) => `delete ${key}`,
      apply: (s, { key }, trace, on) => ({
        state: remove(
          s,
          key,
          runOf(s, trace, on, OS_DELETE, family, DELETE_FIXUP_STANDS),
        ),
        result: null,
      }),
    }),
  ],
});
