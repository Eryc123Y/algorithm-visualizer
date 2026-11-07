/**
 * Runs operations on a data structure from a given starting state
 * (ADR 0018): the start is declared, not animated, so the document's steps
 * cover only the operations asked for.
 */
import type {
  StructureDeclInput,
  StructureKindName,
  VisualizationInput,
} from '@algoviz/spec';

import { checkLength } from '../check.ts';
import { Recorder } from '../recorder.ts';
import { sectionIds } from './section-id.ts';
import { joinSnippets, type Snippet } from './snippet.ts';
import { recordingTape, type Tape } from './tape.ts';

/** What an operation returns: found or not, a popped value, or nothing. */
export type OpResult = number | boolean | null;

export interface Applied<S> {
  readonly state: S;
  readonly result: OpResult;
}

/** One data structure: its model and the operations on it. */
export interface StructureDef<
  S,
  From,
  K extends StructureKindName,
  Call extends { readonly op: string },
> {
  /** Name of the structure in the document. */
  readonly name: string;
  readonly kind: K;
  readonly title: string;
  /** The model state `from` describes; invalid input throws a RangeError. */
  start(from: From): S;
  /** The state in the form `start` takes. */
  describe(state: S): From;
  /** The declaration that shows `state`, with explicit ids. */
  declare(state: S): Extract<StructureDeclInput, { readonly kind: K }>;
  /**
   * Removes pointers an earlier operation left behind, in the first step
   * of the next operation.
   */
  clear(tape: Tape<K>): void;
  /** Checks a call's arguments; throws a RangeError for invalid ones. */
  check(call: Call): void;
  /** Lower-case title of a call, e.g. "delete 3". */
  titleOf(call: Call): string;
  code(call: Call): Snippet;
  apply(state: S, call: Call, tape: Tape<K>): Applied<S>;
}

export interface OpRun<From> {
  readonly document: VisualizationInput;
  readonly results: readonly OpResult[];
  /** The final state, in the form `from` takes, to continue from. */
  readonly after: From;
}

export const MAX_OPS = 8;

/** Most values a structure holds, so `after` can always start a new call. */
export const MAX_SIZE = 32;

/** Throws unless `op` is one of `known`, as JSON input may hold anything. */
export function checkOp(op: string, known: readonly string[]): void {
  if (known.includes(op)) return;
  const list = `${known.slice(0, -1).join(', ')} or ${known.at(-1)}`;
  throw new RangeError(`Unknown operation "${op}"; use ${list}`);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Runs `calls` in order on the state `from` describes. */
export function runOps<
  S,
  From,
  K extends StructureKindName,
  Call extends { readonly op: string },
>(
  def: StructureDef<S, From, K, Call>,
  from: From,
  calls: readonly Call[],
): OpRun<From> {
  if (calls.length === 0) throw new RangeError('Give at least one operation');
  checkLength('ops', calls, MAX_OPS);
  calls.forEach((call) => def.check(call));
  let state = def.start(from);
  const snippets = calls.map((call) => def.code(call));
  const code = joinSnippets(snippets);
  const titles = calls.map((call) => def.titleOf(call));
  const ids = sectionIds(titles);
  const recorder = new Recorder({
    title: `${def.title}: ${titles.join(', ')}`,
    source: code.source,
  });
  const on = recorder.add(def.name, def.declare(state));
  const results = calls.map((call, k) => {
    // Each operation is a section (ADR 0020).
    recorder.section(ids[k]!, capitalize(titles[k]!));
    const tape = recordingTape(
      recorder,
      on,
      code,
      snippets[k]!,
      k > 0 ? (t) => def.clear(t) : undefined,
    );
    const applied = def.apply(state, call, tape);
    state = applied.state;
    return applied.result;
  });
  return { document: recorder.build(), results, after: def.describe(state) };
}
