/**
 * Built-in kinds and type-safe dispatch on a structure's kind.
 */
import {
  ok,
  type Result,
  type StructureDecl,
  type StructureKindName,
  type TargetedAction,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import { arrayKind, type ArrayState } from './array.ts';

export * from './array.ts';

/** State type of each built-in kind. Must cover every kind in the protocol. */
interface KindStates {
  array: ArrayState;
}

// Fails to compile if the protocol gains a kind that has no state type here.
type _AssertAllKinds = [StructureKindName] extends [keyof KindStates]
  ? true
  : never;
const _assertAllKinds: _AssertAllKinds = true;
void _assertAllKinds;

/** A structure's state tagged with its kind, so renderers can switch on it. */
export type KindedState = {
  [K in keyof KindStates]: { readonly kind: K; readonly state: KindStates[K] };
}[keyof KindStates];

/** The state of every structure in a visualization, keyed by name. */
export type VisualizationState = Readonly<Record<string, KindedState>>;

export function initStructure(decl: StructureDecl): KindedState {
  switch (decl.kind) {
    case 'array':
      return { kind: 'array', state: arrayKind.init(decl) };
    default: {
      const unreachable: never = decl.kind;
      return unreachable;
    }
  }
}

export function beginStructureStep(entry: KindedState): KindedState {
  switch (entry.kind) {
    case 'array': {
      const state = arrayKind.beginStep(entry.state);
      return state === entry.state ? entry : { kind: 'array', state };
    }
    default: {
      const unreachable: never = entry.kind;
      return unreachable;
    }
  }
}

/**
 * Applies an action to the structure it targets. The parser guarantees that
 * the action belongs to the target's kind. Once several kinds share action
 * names, narrowing the action here will need that guarantee made explicit.
 */
export function applyAction(
  entry: KindedState,
  action: TargetedAction,
): Result<KindedState, ReduceError> {
  switch (entry.kind) {
    case 'array': {
      const result = arrayKind.reduce(entry.state, action);
      return result.ok ? ok({ kind: 'array', state: result.value }) : result;
    }
    default: {
      const unreachable: never = entry.kind;
      return unreachable;
    }
  }
}
