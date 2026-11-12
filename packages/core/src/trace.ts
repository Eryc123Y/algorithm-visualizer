/**
 * The timeline engine (ADR 0001): a trace is replayed once up front, which
 * checks every action against the state it applies to, and then serves any
 * frame by replaying from the nearest cached checkpoint.
 */
import {
  err,
  formatPath,
  ok,
  parseVisualization,
  type Diagnostic,
  type Result,
  type Step,
  type Visualization,
} from '@algomotion/spec';

import type { EngineError, ReduceError } from './errors.ts';
import {
  applyAction,
  beginStructureStep,
  initStructure,
  type KindedState,
  type VisualizationState,
} from './kinds/index.ts';

/** What a player shows at one point of the timeline. */
export interface Frame {
  /** 0 is the initial state; frame `n` is the state after step `n`. */
  readonly index: number;
  readonly state: VisualizationState;
  /** The step that produced this frame, or undefined for frame 0. */
  readonly step: Step | undefined;
}

export interface Trace {
  readonly visualization: Visualization;
  /** Number of steps. Frames are numbered 0 to `length` inclusive. */
  readonly length: number;
  /** @throws RangeError if `index` is not an integer in `[0, length]`. */
  frame(index: number): Frame;
}

export interface CompileOptions {
  /** Cache the state every this many steps. Default 32. */
  readonly checkpointInterval?: number;
}

type StepFailure = { readonly action: number; readonly error: ReduceError };

function applyStep(
  state: VisualizationState,
  step: Step,
): Result<VisualizationState, StepFailure> {
  const next: Record<string, KindedState> = {};
  for (const [name, entry] of Object.entries(state))
    next[name] = beginStructureStep(entry);

  for (const [index, action] of step.actions.entries()) {
    // The parser guarantees every target exists.
    const result = applyAction(next[action.target]!, action);
    if (!result.ok) return err({ action: index, error: result.error });
    next[action.target] = result.value;
  }
  return ok(next);
}

function initialState(vis: Visualization): VisualizationState {
  const state: Record<string, KindedState> = {};
  for (const [name, decl] of Object.entries(vis.structures))
    state[name] = initStructure(decl);
  return state;
}

/**
 * Replays a parsed visualization and returns a trace whose frames can be
 * read in any order. Stops at the first invalid action, because later
 * errors would describe a state that should never have existed.
 */
export function compileTrace(
  vis: Visualization,
  { checkpointInterval = 32 }: CompileOptions = {},
): Result<Trace, readonly EngineError[]> {
  if (!Number.isInteger(checkpointInterval) || checkpointInterval < 1)
    throw new RangeError('checkpointInterval must be a positive integer');

  const checkpoints: VisualizationState[] = [];
  let state = initialState(vis);
  checkpoints.push(state);

  for (const [s, step] of vis.steps.entries()) {
    const result = applyStep(state, step);
    if (!result.ok) {
      const { action, error } = result.error;
      const path = ['steps', s, 'actions', action, ...(error.path ?? [])];
      return err([
        {
          code: error.code,
          path: formatPath(path),
          message: error.message,
          ...(error.hint === undefined ? {} : { hint: error.hint }),
        },
      ]);
    }
    state = result.value;
    if ((s + 1) % checkpointInterval === 0) checkpoints.push(state);
  }

  const length = vis.steps.length;
  return ok({
    visualization: vis,
    length,
    frame(index) {
      if (!Number.isInteger(index) || index < 0 || index > length)
        throw new RangeError(`Frame ${index} is outside [0, ${length}]`);
      const base = Math.floor(index / checkpointInterval);
      let current = checkpoints[base]!;
      for (let s = base * checkpointInterval; s < index; s++) {
        const result = applyStep(current, vis.steps[s]!);
        // Every step was validated by the replay above.
        if (!result.ok) throw new Error('Unreachable: replay failed');
        current = result.value;
      }
      return { index, state: current, step: vis.steps[index - 1] };
    },
  });
}

/**
 * Parses and compiles untrusted input in one call: the entry point for
 * documents written by people or LLMs.
 */
export function loadTrace(
  input: unknown,
  options?: CompileOptions,
): Result<Trace, readonly Diagnostic[]> {
  const parsed = parseVisualization(input);
  return parsed.ok ? compileTrace(parsed.value, options) : parsed;
}
