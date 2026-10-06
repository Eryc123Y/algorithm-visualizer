/**
 * Errors found while replaying a trace. They complement the static protocol
 * errors from @algoviz/spec: an action can be well-formed yet invalid at its
 * point in the timeline, e.g. an index past the current end of an array.
 */
import type { Diagnostic } from '@algoviz/spec';

export type EngineErrorCode =
  /** An index is outside the structure's current bounds. */
  | 'OUT_OF_RANGE'
  /** An inserted element reuses an id that is already present. */
  | 'DUPLICATE_ID'
  /** An action would grow a structure past its size limit. */
  | 'LIMIT_EXCEEDED'
  /** An action needs an element but the structure is empty (e.g. pop). */
  | 'EMPTY'
  /** An action refers to a node or edge id that does not exist (now). */
  | 'NOT_FOUND'
  /** An action is well-formed but not allowed in the current state, e.g. one that would create a cycle in a tree. */
  | 'INVALID_OPERATION';

/** An error from a reducer, before the timeline adds its location. */
export interface ReduceError {
  readonly code: EngineErrorCode;
  /** Location of the fault within the action, e.g. `['j']`. */
  readonly path?: readonly PropertyKey[];
  readonly message: string;
  readonly hint?: string;
}

export type EngineError = Diagnostic<EngineErrorCode>;
