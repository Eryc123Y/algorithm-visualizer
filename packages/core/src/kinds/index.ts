/**
 * Built-in kinds and dispatch on a structure's kind through the registry.
 */
import {
  ok,
  type Result,
  type StructureDecl,
  type StructureKindName,
  type TargetedAction,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import { runtimes, type CoreTypeMap } from '../registry.ts';

export * from './array.ts';
export * from './btree.ts';
export * from './graph.ts';
export * from './hash-table.ts';
export * from './table.ts';
export * from './linked-list.ts';
export * from './priority-queue.ts';
export * from './queue.ts';
export * from './stack.ts';
export * from './tree.ts';

/** A structure's state tagged with its kind, so renderers can switch on it. */
export type KindedState<K extends StructureKindName = StructureKindName> = {
  [P in K]: { readonly kind: P; readonly state: CoreTypeMap[P]['state'] };
}[K];

/** The state of every structure in a visualization, keyed by name. */
export type VisualizationState = Readonly<Record<string, KindedState>>;

// Dispatch helpers are generic in the kind K, so `runtimes[kind]` is the
// runtime for K and accepts K's declaration, state and action (TypeScript's
// "correlated union" pattern). Callers pass a value whose kind they read from
// the same object, so K and the value always agree.

function initOf<K extends StructureKindName>(
  kind: K,
  decl: CoreTypeMap[K]['decl'],
) {
  return runtimes[kind].init(decl);
}

function beginOf<K extends StructureKindName>(
  kind: K,
  state: CoreTypeMap[K]['state'],
) {
  return runtimes[kind].beginStep(state);
}

function reduceOf<K extends StructureKindName>(
  kind: K,
  state: CoreTypeMap[K]['state'],
  action: CoreTypeMap[K]['action'],
) {
  return runtimes[kind].reduce(state, action);
}

export function initStructure(decl: StructureDecl): KindedState {
  return { kind: decl.kind, state: initOf(decl.kind, decl) } as KindedState;
}

export function beginStructureStep(entry: KindedState): KindedState {
  const state = beginOf(entry.kind, entry.state);
  return state === entry.state
    ? entry
    : ({ kind: entry.kind, state } as KindedState);
}

/**
 * Applies an action to the structure it targets. The parser guarantees that
 * the action belongs to the target's kind, which the cast restates.
 */
export function applyAction(
  entry: KindedState,
  action: TargetedAction,
): Result<KindedState, ReduceError> {
  const result = reduceOf(
    entry.kind,
    entry.state,
    action as CoreTypeMap[typeof entry.kind]['action'],
  );
  return result.ok
    ? ok({ kind: entry.kind, state: result.value } as KindedState)
    : result;
}
