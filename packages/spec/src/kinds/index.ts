/**
 * Registry of built-in structure kinds (ADR 0012). Adding a kind means
 * writing its module and adding one entry here and in `visualization.ts`.
 */
import { arraySpec } from './array.ts';
import { btreeSpec } from './btree.ts';
import { graphSpec } from './graph.ts';
import { hashTableSpec } from './hash-table.ts';
import type { KindSpec, KindTypes } from './kind.ts';
import { linkedListSpec } from './linked-list.ts';
import { planeSpec } from './plane.ts';
import { priorityQueueSpec } from './priority-queue.ts';
import { queueSpec } from './queue.ts';
import { stackSpec } from './stack.ts';
import { tableSpec } from './table.ts';
import { treeSpec } from './tree.ts';

export * from './array.ts';
export * from './btree.ts';
export * from './graph.ts';
export * from './hash-table.ts';
export * from './kind.ts';
export * from './linked-list.ts';
export * from './plane.ts';
export * from './priority-queue.ts';
export * from './queue.ts';
export * from './stack.ts';
export * from './table.ts';
export * from './tree.ts';

const registry = {
  array: arraySpec,
  stack: stackSpec,
  queue: queueSpec,
  linkedList: linkedListSpec,
  tree: treeSpec,
  graph: graphSpec,
  table: tableSpec,
  hashTable: hashTableSpec,
  priorityQueue: priorityQueueSpec,
  btree: btreeSpec,
  plane: planeSpec,
};

export type StructureKindName = keyof typeof registry;

/** The types of each kind, keyed by kind name. */
export type KindTypeMap = {
  [K in StructureKindName]: (typeof registry)[K] extends KindSpec<infer T>
    ? T
    : never;
};

/**
 * The registry, typed so that `kinds[k]` for a generic `K` is
 * `KindSpec<KindTypeMap[K]>`; that lets callers dispatch on a kind name
 * without a switch (TypeScript's "correlated union" pattern).
 */
export const kinds: {
  readonly [K in StructureKindName]: KindSpec<KindTypeMap[K]>;
} = registry;

export const kindNames = Object.keys(registry) as StructureKindName[];

/** The action `type` values defined for a kind, e.g. `['set', 'swap', …]`. */
export const actionTypesOf = (kind: StructureKindName): readonly string[] =>
  kinds[kind].actionTypes;

// Every entry must satisfy the generic contract.
const _check: Record<string, KindSpec<KindTypes>> = registry;
void _check;
