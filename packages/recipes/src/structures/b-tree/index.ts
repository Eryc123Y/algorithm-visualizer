/**
 * B-trees (ADR 0035): `b-tree.search`, `b-tree.insert`, `b-tree.delete`
 * and the sequence `b-tree`, drawn with the `btree` kind. A tree of
 * minimum degree `t` (2 to 5, default 3) starts from keys inserted one by
 * one or from the notation `[G M] ([A C] [H K] [N R])`; `after` is
 * `{ t, tree }` in that notation.
 */
import { z } from 'zod';

import { parseIn } from '../../notation/error.ts';
import { parseList } from '../../notation/list.ts';
import { defineStructure, MAX_SIZE, operationsOf } from '../../structure.ts';
import { silentHandle } from '../../trace.ts';
import { stepsOf } from '../red-black/engine.ts';
import { BT_DELETE, BT_INSERT, BT_SEARCH } from './listings.ts';
import {
  buildTree,
  emptyTree,
  isLeaf,
  nodeOf,
  printTree,
  type BTree,
  type KeyValue,
} from './model.ts';
import { keyValues, parseTree, TREE_FORM } from './notation.ts';
import { insert, remove, search, type BRun } from './operations.ts';

/** A starting tree: its minimum degree and its keys or shape. */
export interface From {
  readonly t: number;
  /** Keys inserted one by one. */
  readonly keys?: readonly KeyValue[];
  /** A tree in the notation. */
  readonly tree?: string;
}

const T = z.int().min(2).max(5);

const KEYS_FORM =
  'keys separated by spaces or commas, e.g. "F S Q K C L H T V W M"';

/** Keys as text: numbers, or words of letters and digits. */
const keysText = z
  .string()
  .transform((s, ctx) =>
    parseIn(
      s,
      ctx,
      (text) => keyValues(parseList(text, 'word')),
      `Write ${KEYS_FORM}.`,
    ),
  );
// Words that all read as numbers are numbers, however they are given.
const keysArray = z
  .array(z.union([z.number(), z.string().regex(/^[A-Za-z0-9]{1,8}$/)]))
  .transform((ks) =>
    ks.every((k) => typeof k === 'string') ? keyValues(ks) : ks,
  );
const Keys = z
  .union([keysText, keysArray])
  .pipe(z.array(z.union([z.number(), z.string()])).max(MAX_SIZE));

/** A tree in the notation, checked as text here and as a B-tree at start. */
const TreeText = z.string().superRefine((s, ctx) => {
  parseIn(s, ctx, parseTree, `Write ${TREE_FORM}.`);
});

const FromSchema = z
  .union([
    // A string with parentheses is a tree; any other string is keys, so
    // "[B A]" is the keys B and A, not a one-node tree.
    z
      .string()
      .refine((s) => s.includes('('))
      .pipe(TreeText)
      .transform((tree): From => ({ t: 3, tree })),
    Keys.transform((keys): From => ({ t: 3, keys })),
    z.strictObject({
      t: T.default(3).describe('The minimum degree t, from 2 to 5.'),
      keys: Keys.optional().describe(`Keys inserted one by one: ${KEYS_FORM}.`),
      tree: TreeText.optional().describe(`A tree: ${TREE_FORM}.`),
    }),
  ])
  .describe(
    `The starting tree: keys inserted one by one into a tree with t = 3 (${KEYS_FORM}), a tree in the notation (${TREE_FORM}), or { "t", "keys" | "tree" } for another minimum degree. \`after\` is { "t", "tree" }.`,
  ) as unknown as z.ZodType<From, unknown>;

const silent: BRun = { step: () => undefined, on: silentHandle('btree') };

function start(from: From): BTree {
  if (from.keys !== undefined && from.tree !== undefined)
    throw new RangeError('Give `keys` or `tree`, not both');
  if (from.tree !== undefined) {
    const tree = buildTree(parseTree(from.tree), from.t);
    if (
      [...tree.nodes.values()].reduce((s, n) => s + n.keys.length, 0) > MAX_SIZE
    )
      throw new RangeError(`A tree holds at most ${MAX_SIZE} keys`);
    return tree;
  }
  const keys = from.keys ?? [];
  const numeric = keys.every((k) => typeof k === 'number');
  if (!numeric && keys.some((k) => typeof k === 'number'))
    throw new RangeError('Keys are all numbers or all words, not both');
  return keys.reduce((b, k) => insert(b, k, silent), emptyTree(from.t));
}

function declare(b: BTree) {
  const order: string[] = [];
  const walk = (id: string) => {
    order.push(id);
    nodeOf(b, id).children.forEach(walk);
  };
  walk(b.root);
  return {
    kind: 'btree' as const,
    nodes: order.map((id) => {
      const n = nodeOf(b, id);
      return {
        id,
        keys: n.keys.map((k) => ({ id: k.id, value: k.value })),
        ...(isLeaf(n) ? {} : { children: [...n.children] }),
      };
    }),
    root: b.root,
  };
}

const runOf = (
  trace: Parameters<typeof stepsOf>[0],
  on: BRun['on'],
  listing: Parameters<typeof stepsOf>[1],
): BRun => ({ step: stepsOf(trace, listing), on });

/** A key: a number, or a word of letters and digits. */
const Key = z.union([z.number(), z.string().regex(/^[A-Za-z0-9]{1,8}$/)]);

/** Keys must be of the tree's type: numbers or words. */
function checkKind(b: BTree, k: KeyValue): void {
  const first = [...b.nodes.values()].find((n) => n.keys.length > 0)?.keys[0];
  if (first !== undefined && typeof first.value !== typeof k)
    throw new RangeError(
      `The tree's keys are ${typeof first.value === 'number' ? 'numbers' : 'words'}, so ${JSON.stringify(k)} cannot be compared with them`,
    );
}

const SAMPLE: From = {
  t: 3,
  keys: 'F S Q K C L H T V W M R N P A B X Y D Z E'.split(' '),
};
const CLRS_DELETE: From = {
  t: 3,
  tree: '[P] ([C G M] ([A B] [D E F] [J K L] [N O]) [T X] ([Q R S] [U V] [Y Z]))',
};

const op = operationsOf<BTree, From, 'btree'>();

/** B-trees: search, and CLRS's one-pass insertion and deletion. */
export const bTree = defineStructure<BTree, From, 'btree'>({
  id: 'b-tree',
  title: 'B-tree',
  topic: 'trees',
  summary:
    'A balanced search tree whose nodes hold between t − 1 and 2t − 1 keys: insertion splits full nodes on the way down, and deletion makes sure each node it enters has a key to spare.',
  name: 'T',
  kind: 'btree',
  from: FromSchema,
  examples: [
    {
      from: CLRS_DELETE,
      ops: [
        { op: 'delete', key: 'F' },
        { op: 'delete', key: 'M' },
        { op: 'delete', key: 'G' },
        { op: 'delete', key: 'D' },
        { op: 'delete', key: 'B' },
      ],
    },
    {
      from: { t: 3, keys: [] },
      ops: 'G M P X A C D E'.split(' ').map((key) => ({ op: 'insert', key })),
    },
  ],
  start,
  describe: (b) => ({ t: b.t, tree: printTree(b) }),
  declare,
  clear(on) {
    on.pointer({ name: 'x', node: null });
  },
  operations: [
    op({
      name: 'search',
      title: 'search',
      summary:
        'Walks down from the root, comparing the key with each node’s keys left to right, to the key or to a leaf.',
      args: { key: Key.describe('The key to find.') },
      examples: [
        { from: SAMPLE, key: 'R' },
        { from: SAMPLE, key: 'G' },
      ],
      code: BT_SEARCH,
      titleOf: ({ key }) => `search ${key}`,
      apply: (s, { key }, trace, on) => {
        checkKind(s, key);
        return {
          state: s,
          result: search(s, key, runOf(trace, on, BT_SEARCH)),
        };
      },
    }),
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a key into a leaf in one pass down, splitting every full node first; a full root splits under a new root, which is how the tree grows.',
      args: { key: Key.describe('The key to insert.') },
      examples: [
        { from: CLRS_DELETE, key: 'H' },
        { from: { t: 2, keys: [10, 20, 30] }, key: 40 },
      ],
      code: BT_INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on) => {
        checkKind(s, key);
        return {
          state: insert(s, key, runOf(trace, on, BT_INSERT)),
          result: null,
        };
      },
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Deletes a key in one pass down, merging or borrowing so that every node it enters has at least t keys, as in CLRS’s cases 1 to 3.',
      args: { key: Key.describe('The key to delete.') },
      examples: [
        { from: CLRS_DELETE, key: 'M' },
        { from: CLRS_DELETE, key: 'D' },
      ],
      code: BT_DELETE,
      titleOf: ({ key }) => `delete ${key}`,
      apply: (s, { key }, trace, on) => {
        checkKind(s, key);
        return {
          state: remove(s, key, runOf(trace, on, BT_DELETE)),
          result: null,
        };
      },
    }),
  ],
});
