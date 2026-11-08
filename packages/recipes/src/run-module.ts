/**
 * Runs one module on an input (ADR 0019): checks the input with the
 * module's schema, records the run, and checks the document by replaying
 * it through the engine. A page that imports a single module runs it with
 * `runModule`, without loading the registry.
 */
import { loadTrace } from '@algoviz/core';
import {
  err,
  ok,
  type Diagnostic,
  type Result,
  type VisualizationInput,
} from '@algoviz/spec';

import { sourcesOf, type Algorithm, type OpResult } from './algorithm.ts';
import { inputDiagnostics } from './notation/issues.ts';
import { Recorder } from './recorder.ts';
import { recordingTrace } from './trace.ts';

/** A run's document, and what the run returned. */
export interface AlgorithmRun {
  readonly document: VisualizationInput;
  /** One result per operation run; empty for an algorithm. */
  readonly results: readonly OpResult[];
  /** A data structure's final state, in the form its `from` takes. */
  readonly after?: unknown;
}

/**
 * Runs `algorithm` on `input`, or on its first example if `input` is
 * undefined (ADR 0032). Errors are diagnostics:
 * - `INVALID_SHAPE` for an input its schema rejects, at a path under
 *   `$.input`, and `INVALID_NOTATION` for a notation it cannot read;
 * - `INVALID_ARGUMENT` at `$.input` for an input it cannot show, such as a
 *   pop from an empty heap;
 * - the engine's errors if the document does not replay.
 */
export function runModule<I>(
  algorithm: Algorithm<I>,
  input?: unknown,
): Result<AlgorithmRun, readonly Diagnostic[]> {
  const parsed = algorithm.input.safeParse(
    input === undefined ? algorithm.examples[0] : input,
  );
  if (!parsed.success) return err(inputDiagnostics(parsed.error.issues));
  let run: AlgorithmRun;
  try {
    run = record(algorithm, parsed.data);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    return err([
      { code: 'INVALID_ARGUMENT', path: '$.input', message: e.message },
    ]);
  }
  const loaded = loadTrace(run.document);
  return loaded.ok ? ok(run) : loaded;
}

function record<I>(algorithm: Algorithm<I>, input: I): AlgorithmRun {
  const { title, sources } = algorithm.present?.(input) ?? {
    title: algorithm.title,
    sources: sourcesOf(algorithm.code),
  };
  const anchors = new Set(sources.flatMap((s) => Object.keys(s.anchors)));
  const recorder = new Recorder({ title, sources });
  const { results = [], after } =
    algorithm.run(input, recordingTrace(recorder, anchors)) ?? {};
  return {
    document: recorder.build(),
    results,
    ...(after === undefined ? {} : { after }),
  };
}
