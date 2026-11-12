/**
 * What the red–black, order-statistic and interval trees share besides
 * the engine (ADR 0034): their starting state, which is keys in insertion
 * order or `{ levelOrder, red }`, its description `after`, the
 * declaration of a state, and the run of one operation.
 */
import type { TreeDeclInput, TreeNode } from '@algomotion/spec';
import { z } from 'zod';

import type { Listing } from '../../snippet.ts';
import { MAX_SIZE } from '../../structure.ts';
import {
  afterFirstStep,
  silentHandle,
  silentTrace,
  type Trace,
} from '../../trace.ts';
import {
  clearPointers,
  insert,
  showFields,
  stepsOf,
  type Family,
  type On,
  type Run,
} from './engine.ts';
import {
  buildTree,
  describeTree,
  EMPTY,
  nodeOf,
  preorder,
  type Described,
  type RbTree,
} from './model.ts';

/** Keys in insertion order, or a tree in level order with its red keys. */
export type From<K> = readonly K[] | Described<K>;

/**
 * A tree of 32 keys is at most 10 levels deep (2 log2 33), so its level
 * order, gaps included, has at most 1,023 entries.
 */
export const LEVEL_ORDER_LIMIT = 1023;

/** The schema of `from`, given the schemas of a key and of a key list. */
export function fromSchema<K>(
  keyList: z.ZodType<readonly K[], unknown>,
  levelList: z.ZodType<readonly (K | null)[], unknown>,
  example: string,
): z.ZodType<From<K>, unknown> {
  return z.union([
    keyList,
    z
      .strictObject({
        levelOrder: levelList,
        red: keyList,
      })
      .describe(
        `A tree in level order, null for a gap, as LeetCode writes one, and its red keys; the others are black. This is the form of \`after\`, e.g. ${example}.`,
      ),
  ]);
}

/** The state `from` describes: keys inserted one by one, or the tree. */
export function startTree<K>(from: From<K>, family: Family<K>): RbTree<K> {
  if (!Array.isArray(from)) {
    const t = buildTree(from as Described<K>, family.keys, family.aug);
    if (t.nodes.size > MAX_SIZE)
      throw new RangeError(
        `A tree holds at most ${MAX_SIZE} keys, not ${t.nodes.size}`,
      );
    return t;
  }
  const run: Run<K> = {
    family,
    step: () => undefined,
    on: silentHandle('tree'),
  };
  if (from.length > MAX_SIZE)
    throw new RangeError(`A tree holds at most ${MAX_SIZE} keys`);
  return (from as readonly K[]).reduce(
    (t, key) => insert(t, key, run),
    EMPTY as RbTree<K>,
  );
}

/** The declaration of a state: a binary tree with colours and ids. */
export function declareTree<K>(
  t: RbTree<K>,
  family: Family<K>,
): TreeDeclInput & { kind: 'tree' } {
  const nodes = preorder(t).map((id): TreeNode => {
    const { key, left, right, color } = nodeOf(t, id);
    const value = family.keys.value(key);
    return left === null && right === null
      ? { id, value, color }
      : { id, value, color, children: [left, right] };
  });
  return {
    kind: 'tree',
    binary: true,
    nodes,
    roots: t.root === null ? [] : [t.root],
  };
}

export const describeState = <K>(t: RbTree<K>): Described<K> => describeTree(t);

/**
 * The run of one operation on `t`: its steps at the markers of `listing`
 * (or those `stands` names for code the listing only calls), with every
 * field shown from its first step, since a declaration cannot show notes.
 */
export function runOf<K>(
  t: RbTree<K>,
  trace: Trace,
  on: On,
  listing: Listing,
  family: Family<K>,
  stands: Readonly<Record<string, string>> = {},
): Run<K> {
  const run: Run<K> = { family, on, step: () => undefined };
  const shown =
    family.aug === undefined
      ? trace
      : afterFirstStep(trace, () => showFields(run, t));
  return { ...run, step: stepsOf(shown, listing, stands) };
}

export { clearPointers };

/** A silent run, to build states without recording them. */
export const silentRun = <K>(family: Family<K>): Run<K> => ({
  family,
  step: () => undefined,
  on: silentHandle('tree'),
});

export const silent = silentTrace;
