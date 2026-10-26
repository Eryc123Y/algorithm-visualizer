import { loadTrace, type KindedState, type Trace } from '@algoviz/core';
import type { StructureKindName, VisualizationInput } from '@algoviz/spec';
import { formatErrors } from '@algoviz/spec';

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
