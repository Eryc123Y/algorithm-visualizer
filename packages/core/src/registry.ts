/**
 * Registry of the engine side of every structure kind (ADR 0012): each
 * entry combines a kind's reducer with its layout.
 */
import type { KindTypeMap, StructureKindName } from '@algoviz/spec';

import type { KindRuntime } from './kind.ts';
import { arrayKind } from './kinds/array.ts';
import { graphKind } from './kinds/graph.ts';
import { linkedListKind } from './kinds/linked-list.ts';
import { queueKind } from './kinds/queue.ts';
import { stackKind } from './kinds/stack.ts';
import { treeKind } from './kinds/tree.ts';
import {
  layoutArray,
  measureArray,
  mergeArrayMetrics,
} from './layout/array.ts';
import {
  layoutLinkedList,
  measureLinkedList,
  mergeLinkedListMetrics,
} from './layout/linked-list.ts';
import {
  layoutQueue,
  measureQueue,
  mergeQueueMetrics,
} from './layout/queue.ts';
import {
  layoutStack,
  measureStack,
  mergeStackMetrics,
} from './layout/stack.ts';
import {
  layoutGraph,
  measureGraph,
  mergeGraphMetrics,
} from './layout/graph.ts';
import { layoutTree, measureTree, mergeTreeMetrics } from './layout/tree.ts';

const registry = {
  array: {
    ...arrayKind,
    measure: measureArray,
    mergeMetrics: mergeArrayMetrics,
    layout: layoutArray,
  },
  stack: {
    ...stackKind,
    measure: measureStack,
    mergeMetrics: mergeStackMetrics,
    layout: layoutStack,
  },
  queue: {
    ...queueKind,
    measure: measureQueue,
    mergeMetrics: mergeQueueMetrics,
    layout: layoutQueue,
  },
  linkedList: {
    ...linkedListKind,
    measure: measureLinkedList,
    mergeMetrics: mergeLinkedListMetrics,
    layout: layoutLinkedList,
  },
  tree: {
    ...treeKind,
    measure: measureTree,
    mergeMetrics: mergeTreeMetrics,
    layout: layoutTree,
  },
  graph: {
    ...graphKind,
    measure: measureGraph,
    mergeMetrics: mergeGraphMetrics,
    layout: layoutGraph,
  },
} satisfies {
  // Fails to compile if the protocol has a kind without a runtime, or if a
  // runtime's declaration or action type differs from the protocol's.
  [K in StructureKindName]: KindRuntime<
    KindTypeMap[K]['decl'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inferred below
    any,
    KindTypeMap[K]['action'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inferred below
    any
  >;
};

type Runtime<K extends StructureKindName> = (typeof registry)[K];

/** The engine types of each kind, keyed by kind name. */
export type CoreTypeMap = {
  [K in StructureKindName]: {
    decl: KindTypeMap[K]['decl'];
    action: KindTypeMap[K]['action'];
    state: ReturnType<Runtime<K>['init']>;
    metrics: ReturnType<Runtime<K>['measure']>;
  };
};

/** The registry, typed for dispatch on a generic kind name. */
export const runtimes: {
  readonly [K in StructureKindName]: KindRuntime<
    CoreTypeMap[K]['decl'],
    CoreTypeMap[K]['state'],
    CoreTypeMap[K]['action'],
    CoreTypeMap[K]['metrics']
  >;
} = registry;
