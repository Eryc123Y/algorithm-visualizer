/**
 * Reading documents that tools receive: either a JSON value or the JSON
 * text of one, as models pass both.
 */
import {
  loadTrace,
  selectFrame,
  selectFrames,
  type FrameRange,
  type Trace,
} from '@algoviz/core';
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';

/** Parses JSON text; any other value is returned as it is. */
export function readDocument(input: unknown): Result<unknown, Diagnostic[]> {
  if (typeof input !== 'string') return ok(input);
  try {
    return ok(JSON.parse(input) as unknown);
  } catch (e) {
    return err([
      {
        code: 'INVALID_JSON',
        path: '$',
        message: e instanceof Error ? e.message : String(e),
        hint: 'Pass the document as a JSON object, or as valid JSON text.',
      },
    ]);
  }
}

/** Parses, validates and replays a document. */
export function loadDocument(
  input: unknown,
): Result<Trace, readonly Diagnostic[]> {
  const read = readDocument(input);
  return read.ok ? loadTrace(read.value) : read;
}

/**
 * A selector, a number or text (ADR 0020), shared by the tools that take
 * frames.
 */
export type FrameSelector = number | string;

/**
 * The one frame a selector names: a frame number (negative counts from the
 * end, so -1 is the last), a step such as "relax#2" or "insert-5/go".
 */
export function resolveFrame(
  trace: Trace,
  frame: FrameSelector,
): Result<number, Diagnostic[]> {
  const result = selectFrame(trace.visualization, frame);
  return result.ok ? result : err([result.error]);
}

/** The frames a selector names, `from` to `to`; a section or `a..b` names several. */
export function resolveFrames(
  trace: Trace,
  frames: FrameSelector,
): Result<FrameRange, Diagnostic[]> {
  const result = selectFrames(trace.visualization, frames);
  return result.ok ? result : err([result.error]);
}
