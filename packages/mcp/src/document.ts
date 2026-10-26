/**
 * Reading documents that tools receive: either a JSON value or the JSON
 * text of one, as models pass both.
 */
import { loadTrace, type Trace } from '@algoviz/core';
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
 * Resolves a frame number: negative numbers count from the end, so -1 is
 * the last frame.
 */
export function resolveFrame(
  trace: Trace,
  frame: number,
): Result<number, Diagnostic[]> {
  const index = frame < 0 ? trace.length + 1 + frame : frame;
  if (Number.isInteger(index) && index >= 0 && index <= trace.length)
    return ok(index);
  return err([
    {
      code: 'OUT_OF_RANGE',
      path: '$',
      message: `Frame ${frame} does not exist`,
      hint: `Frames go from 0 (before the first step) to ${trace.length} (after the last); -1 is the last.`,
    },
  ]);
}
