/**
 * The interface every structure kind implements (ADR 0002).
 *
 * A kind is a small state machine: `init` builds the state from a declaration
 * and `reduce` is its pure transition function. The state is split into
 * `data` (the structure's contents) and `marks` (annotations that only
 * affect how it is drawn).
 */
import type { Result } from '@algoviz/spec';

import type { ReduceError } from './errors.ts';

export interface StructureState<Data, Marks> {
  readonly data: Data;
  readonly marks: Marks;
}

export interface StructureKind<
  Decl,
  Data,
  Marks,
  Action extends { readonly type: string },
> {
  readonly kind: string;
  /** Builds the initial state from a canonical declaration. */
  init(decl: Decl): StructureState<Data, Marks>;
  /**
   * Clears marks that last for a single step. Called once at the start of
   * every step, before its actions are applied.
   */
  beginStep(state: StructureState<Data, Marks>): StructureState<Data, Marks>;
  /** Applies one action. Must be pure and must not mutate `state`. */
  reduce(
    state: StructureState<Data, Marks>,
    action: Action,
  ): Result<StructureState<Data, Marks>, ReduceError>;
}
