/**
 * Red–black trees (ADR 0034): `red-black-tree.insert` and
 * `red-black-tree.delete`, each from a tree given as keys in insertion
 * order or as `{ levelOrder, red }`, and the sequence `red-black-tree`.
 * Keys are distinct. Deletion moves nodes as RB-DELETE does, so the `x`
 * of its fixup may be NIL, drawn as a pointer at an empty slot.
 */
import { z } from 'zod';

import { listField } from '../../notation/schema.ts';
import { defineStructure, MAX_SIZE, operationsOf } from '../../structure.ts';
import { insert, remove, type Family } from './engine.ts';
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
import { RB_DELETE, RB_INSERT } from './listings.ts';
import { numberKeys, type RbTree } from './model.ts';

const family: Family<number> = { keys: numberKeys };

type State = RbTree<number>;

const keyList = listField(
  z
    .array(z.number())
    .max(MAX_SIZE)
    .describe('Keys, e.g. [41, 38, 31, 12, 19, 8].'),
  'number',
);
const levelList = listField(
  z.array(z.number().nullable()).max(LEVEL_ORDER_LIMIT),
  'level',
);

/** CLRS's figure for insertion: 11 2 14 1 7 15 5 8, coloured as built. */
const SAMPLE = [11, 2, 14, 1, 7, 15, 5, 8];

const op = operationsOf<State, From<number>, 'tree'>();
const Key = z.number();

/** Insertion and deletion in a red–black tree of distinct keys. */
export const redBlackTree = defineStructure<State, From<number>, 'tree'>({
  id: 'red-black-tree',
  title: 'Red–black tree',
  topic: 'trees',
  summary:
    'Inserts and deletes keys in a red–black tree, recolouring and rotating so that no red node has a red child and every path has as many black nodes.',
  name: 'T',
  kind: 'tree',
  from: fromSchema(
    keyList.describe(
      'Keys in insertion order that build the starting tree, e.g. [41, 38, 31, 12, 19, 8]; a repeated key is skipped.',
    ),
    levelList,
    '{ "levelOrder": [11, 2, 14], "red": [2, 14] }',
  ),
  examples: [
    {
      from: [41, 38, 31, 12, 19, 8],
      ops: [8, 12, 19, 31, 38, 41].map((key) => ({ op: 'delete', key })),
    },
    {
      from: [],
      ops: [41, 38, 31, 12, 19, 8].map((key) => ({ op: 'insert', key })),
    },
  ],
  start: (from) => startTree(from, family),
  describe: describeState,
  declare: (s) => declareTree(s, family),
  clear: clearPointers,
  operations: [
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a key as a red leaf, then recolours and rotates up the tree (RB-INSERT-FIXUP) until no red node has a red child.',
      args: { key: Key.describe('The key to insert.') },
      examples: [
        { from: SAMPLE, key: 4 },
        { from: [], key: 7 },
      ],
      code: RB_INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on) => ({
        state: insert(s, key, runOf(s, trace, on, RB_INSERT, family)),
        result: null,
      }),
    }),
    op({
      name: 'delete',
      title: 'delete',
      summary:
        'Deletes a key: its child or its successor takes its place, and if a black node left its place, RB-DELETE-FIXUP restores the black heights.',
      args: { key: Key.describe('The key to delete.') },
      examples: [
        { from: SAMPLE, key: 1 },
        { from: SAMPLE, key: 11 },
      ],
      code: RB_DELETE,
      titleOf: ({ key }) => `delete ${key}`,
      apply: (s, { key }, trace, on) => ({
        state: remove(s, key, runOf(s, trace, on, RB_DELETE, family)),
        result: null,
      }),
    }),
  ],
});
