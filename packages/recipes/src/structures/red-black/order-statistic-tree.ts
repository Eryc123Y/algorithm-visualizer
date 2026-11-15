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
    fieldZh: '大小',
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
    const headZh = `在 ${node.key}：它左边有 ${left} 个关键字，所以它在这里排第 ${r}`;
    if (want === r) {
      step('found', {
        en: `${head}, the one we want: ${node.key} is the ${ordinal(i)} smallest key.`,
        zh: `${headZh}，正是要找的：${node.key} 是第 ${i} 小的关键字。`,
      });
      on.pointer({ name: 'x', node: x }).settle({ node: x });
      return { state: t, result: node.key };
    }
    if (want < r) {
      step('left', {
        en: `${head}; we want the ${ordinal(want)}: go left.`,
        zh: `${headZh}；要找的是第 ${want} 个：往左走。`,
      });
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      x = node.left!;
    } else {
      step('right', {
        en: `${head}; we want the ${ordinal(want)}, so skip ${keysBelow(r)} and look for the ${ordinal(want - r)} on the right.`,
        zh: `${headZh}；要找的是第 ${want} 个，所以跳过这 ${r} 个关键字，在右边找第 ${want - r} 个。`,
      });
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
      step('find', { en: `Found ${key}.`, zh: `找到 ${key}。` });
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      break;
    }
    const side = key < node.key ? 'left' : 'right';
    step('find', {
      en: `${key} ${side === 'left' ? '<' : '>'} ${node.key}: go ${side}.`,
      zh: `${key} ${side === 'left' ? '<' : '>'} ${node.key}：往${side === 'left' ? '左' : '右'}走。`,
    });
    on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
    x = node[side];
  }
  if (x === null) {
    step('missing', {
      en: `${key} is not in the tree, so it has no rank.`,
      zh: `${key} 不在树中，所以没有秩。`,
    });
    on.pointer({ name: 'x', node: null });
    return { state: t, result: null };
  }
  let r = (fieldOf(t, nodeOf(t, x).left) ?? 0) + 1;
  step('start', {
    en: `${key} has ${keysBelow(r - 1)} on its left, so it is the ${ordinal(r)} in its own subtree.`,
    zh: `${key} 左边有 ${r - 1} 个关键字，所以它在自己的子树中排第 ${r}。`,
  });
  on.pointer({ name: 'y', node: x });
  for (let y = x; y !== t.root;) {
    const p = nodeOf(t, y).parent!;
    const [yk, pk] = [nodeOf(t, y).key, nodeOf(t, p).key];
    if (sideOf(t, y) === 'right') {
      const left = fieldOf(t, nodeOf(t, p).left) ?? 0;
      r += left + 1;
      step('add', {
        en: `${yk} is a right child, so its parent ${pk} and the ${keysBelow(left)} on ${pk}'s left come before ${key} too: ${key} is the ${ordinal(r)} so far.`,
        zh: `${yk} 是右孩子，所以它的父节点 ${pk} 和 ${pk} 左边的 ${left} 个关键字也排在 ${key} 前面：${key} 目前排第 ${r}。`,
      });
      on.highlight({ nodes: [p] });
      step('up', { en: `Go up to ${pk}.`, zh: `往上走到 ${pk}。` });
    } else
      step('up', {
        en: `${yk} is a left child, so ${pk} and its right subtree come after ${key}: nothing to add. Go up to ${pk}.`,
        zh: `${yk} 是左孩子，所以 ${pk} 和它的右子树都排在 ${key} 后面：不用加。往上走到 ${pk}。`,
      });
    on.pointer({ name: 'y', node: p }).highlight({ nodes: [p] });
    y = p;
  }
  step('rank', {
    en: `At the root: ${key} is the ${ordinal(r)} smallest key.`,
    zh: `到达根：${key} 是第 ${r} 小的关键字。`,
  });
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
  title: { en: 'Order-statistic tree', zh: '顺序统计树' },
  topic: 'trees',
  summary: {
    en: 'A red–black tree whose nodes keep their subtree sizes, so that the key of any rank, and the rank of any key, is found on one path.',
    zh: '节点记录子树大小的红黑树，这样任意秩的关键字和任意关键字的秩，都能沿一条路径找到。',
  },
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
      title: { en: 'select', zh: '选择' },
      summary: {
        en: 'Finds the key of rank i (the ith smallest, from 1), going left or right by the size of each left subtree.',
        zh: '找出秩为 i 的关键字（第 i 小，从 1 算起），根据每个左子树的大小决定往左还是往右。',
      },
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
      titleOf: ({ i }) => ({ en: `select ${i}`, zh: `选择第 ${i} 小` }),
      apply: (s, { i }, trace, on) =>
        select(s, i, runOf(s, trace, on, OS_SELECT, family)),
    }),
    op({
      name: 'rank',
      title: { en: 'rank', zh: '求秩' },
      summary: {
        en: 'Finds a key, then counts the keys before it, adding a parent and its left subtree whenever it climbs from a right child.',
        zh: '找到一个关键字，再数出排在它前面的关键字：每次从右孩子往上走时，加上父节点和它的左子树。',
      },
      args: { key: Key.describe('The key whose rank to find.') },
      examples: [
        { from: SAMPLE, key: 38 },
        { from: SAMPLE, key: 11 },
      ],
      code: OS_RANK,
      titleOf: ({ key }) => ({ en: `rank ${key}`, zh: `求 ${key} 的秩` }),
      apply: (s, { key }, trace, on) =>
        rank(s, key, runOf(s, trace, on, OS_RANK, family)),
    }),
    op({
      name: 'insert',
      title: { en: 'insert', zh: '插入' },
      summary: {
        en: 'Inserts a key as in a red–black tree, adding one to the size of every node on the way down; the fixup’s rotations recompute the sizes they change.',
        zh: '像在红黑树中一样插入关键字，向下走时给路上每个节点的大小加一；修复时的旋转会重新计算它们改变的大小。',
      },
      args: { key: Key.describe('The key to insert.') },
      examples: [{ from: SAMPLE, key: 15 }],
      code: OS_INSERT,
      titleOf: ({ key }) => ({ en: `insert ${key}`, zh: `插入 ${key}` }),
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
      title: { en: 'delete', zh: '删除' },
      summary: {
        en: 'Deletes a key as in a red–black tree, then recomputes the sizes on the path from where the removed node’s place was filled up to the root.',
        zh: '像在红黑树中一样删除关键字，再从被删节点的位置被填补的地方往上走到根，重新计算路径上的大小。',
      },
      args: { key: Key.describe('The key to delete.') },
      examples: [{ from: SAMPLE, key: 17 }],
      code: OS_DELETE,
      titleOf: ({ key }) => ({ en: `delete ${key}`, zh: `删除 ${key}` }),
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
