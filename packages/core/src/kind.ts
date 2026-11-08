/**
 * The interface every structure kind implements in the engine (ADR 0002,
 * 0012).
 *
 * A kind is a small state machine plus its layout: `init` builds the state
 * from a declaration, `reduce` is its pure transition function, and
 * `measure` / `layout` turn states into scene items. States are split into
 * `data` (the structure's contents) and `marks` (annotations that only
 * affect how it is drawn).
 */
import type { Result } from '@algoviz/spec';

import type { ReduceError } from './errors.ts';
import type { LayoutFonts, LayoutOptions, Region } from './layout/options.ts';
import type { SceneItem } from './layout/scene.ts';

export interface StructureState<Data, Marks> {
  readonly data: Data;
  readonly marks: Marks;
}

/** Scene items of one structure, with the size they occupy. */
export interface Block {
  readonly items: readonly SceneItem[];
  readonly width: number;
  readonly height: number;
}

export interface LayoutInput<Decl, State, Metrics> {
  /** Structure name; prefix of every scene key. */
  readonly name: string;
  /** Text to show as the structure's title. */
  readonly title: string;
  readonly decl: Decl;
  readonly state: State;
  /** Measured over the whole trace (ADR 0008). */
  readonly metrics: Metrics;
  /** Top-left corner of the structure's block. */
  readonly origin: { readonly x: number; readonly y: number };
  /** The column the structure is drawn in (ADR 0029). */
  readonly region: Region;
  readonly options: LayoutOptions;
}

export interface KindRuntime<Decl, State, Action, Metrics> {
  /** Builds the initial state from a canonical declaration. */
  init(decl: Decl): State;
  /**
   * Clears marks that last for a single step. Called once at the start of
   * every step, before its actions are applied.
   */
  beginStep(state: State): State;
  /** Applies one action. Must be pure and must not mutate `state`. */
  reduce(state: State, action: Action): Result<State, ReduceError>;
  /**
   * Sizes a state needs, with text widths in em of `fonts`; merged over
   * all frames (ADR 0008, 0024).
   */
  measure(state: State, decl: Decl, fonts: LayoutFonts): Metrics;
  mergeMetrics(a: Metrics, b: Metrics): Metrics;
  /** Pure, DOM-free layout of one state (ADR 0003). */
  layout(input: LayoutInput<Decl, State, Metrics>): Block;
}

/**
 * The reducer half of a runtime; kept as its own type so reducers and
 * layouts can live in separate modules.
 */
export type StructureKind<Decl, State, Action> = Pick<
  KindRuntime<Decl, State, Action, unknown>,
  'init' | 'beginStep' | 'reduce'
>;
