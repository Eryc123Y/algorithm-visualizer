import { expect } from 'vitest';

import { loadTrace, type KindedState, type Trace } from '@algomotion/core';
import type {
  Diagnostic,
  StructureKindName,
  VisualizationInput,
} from '@algomotion/spec';
import { formatErrors, type Locale } from '@algomotion/spec';

import { runAlgorithm, type AlgorithmRun } from '../src/index.ts';

/** Loads a document, failing the test with readable errors if it is invalid. */
export function replay(doc: VisualizationInput): Trace {
  const result = loadTrace(doc);
  if (!result.ok) throw new Error(formatErrors(result.error));
  return result.value;
}

/** The state of structure `name` at frame `index` (default the last). */
export function stateOf<K extends StructureKindName>(
  trace: Trace,
  name: string,
  kind: K,
  index = trace.length,
): KindedState<K>['state'] {
  const entry = trace.frame(index).state[name];
  if (entry?.kind !== kind) throw new Error(`"${name}" is not a ${kind}`);
  return entry.state as KindedState<K>['state'];
}

/** Deterministic pseudo-random integers, for property tests. */
export function randomInts(seed: number, count: number, max: number): number[] {
  let x = seed;
  return Array.from({ length: count }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % (max + 1);
  });
}

/** fast-check settings: deepen with FUZZ_RUNS, replay with FUZZ_SEED. */
export const fuzz = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

/** Runs a registry module, failing the test with its errors if it fails. */
export function runOk(
  id: string,
  input: unknown,
  locale: Locale = 'en',
): AlgorithmRun {
  const result = runAlgorithm(id, input, { locale });
  if (!result.ok) throw new Error(formatErrors(result.error));
  return result.value;
}

/** The first error of a run that must fail. */
export function runError(id: string, input: unknown): Diagnostic {
  const result = runAlgorithm(id, input);
  if (result.ok) throw new Error(`${id} ran on ${JSON.stringify(input)}`);
  return result.error[0]!;
}

/**
 * The checks ADR 0018 asks of every data structure, for a run of `id`
 * from `from` through `ops`, comparing states through `view`, a drawing
 * of the structure at a frame: frame 0 draws `start`, the state `from`
 * describes; the same input gives the same run; and the first call and
 * the rest, chained through `after`, start and end where the one run
 * does, with the same results and the same `after`.
 */
export function checkOperations(
  id: string,
  from: unknown,
  ops: readonly unknown[],
  view: (trace: Trace, frame: number) => unknown,
  start: unknown,
): void {
  const whole = runOk(id, { from, ops });
  const trace = replay(whole.document);
  expect(view(trace, 0)).toEqual(start);
  expect(runOk(id, { from, ops })).toEqual(whole);
  if (ops.length < 2) return;
  const first = runOk(id, { from, ops: ops.slice(0, 1) });
  const rest = runOk(id, { from: first.after, ops: ops.slice(1) });
  const head = replay(first.document);
  const tail = replay(rest.document);
  // `after` rebuilds the state the first call ended in.
  expect(view(tail, 0)).toEqual(view(head, head.length));
  expect(view(tail, tail.length)).toEqual(view(trace, trace.length));
  expect([...first.results, ...rest.results]).toEqual(whole.results);
  expect(rest.after).toEqual(whole.after);
}
