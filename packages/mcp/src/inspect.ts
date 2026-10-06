/**
 * The state of each structure at chosen frames, so an author can check that
 * a document does what they meant without looking at pictures.
 */
import type { Trace } from '@algoviz/core';
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';

import { loadDocument, resolveFrame } from './document.ts';

/** At most this many frames are described per call. */
export const MAX_FRAMES = 20;

export interface FrameReport {
  readonly frame: number;
  readonly line?: number;
  readonly narration?: string;
  readonly vars?: Readonly<Record<string, unknown>>;
  /** Each structure's state: its data, its marks, and settings. */
  readonly structures: Readonly<Record<string, unknown>>;
}

const isEmpty = (value: unknown) =>
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 0);

/**
 * A structure's state without marks that are unset, which are most of them
 * in most frames.
 */
function compact(state: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key === 'marks' && typeof value === 'object' && value !== null) {
      const marks = Object.fromEntries(
        Object.entries(value).filter(([, mark]) => !isEmpty(mark)),
      );
      if (Object.keys(marks).length > 0) out[key] = marks;
    } else out[key] = value;
  }
  return out;
}

export function describeFrame(trace: Trace, index: number): FrameReport {
  const { state, step } = trace.frame(index);
  const meta = step?.meta;
  return {
    frame: index,
    ...(meta?.line === undefined ? {} : { line: meta.line }),
    ...(meta?.narration === undefined ? {} : { narration: meta.narration }),
    ...(meta?.vars === undefined ? {} : { vars: meta.vars }),
    structures: Object.fromEntries(
      Object.entries(state).map(([name, entry]) => [
        name,
        { kind: entry.kind, ...compact(entry.state) },
      ]),
    ),
  };
}

export interface InspectReport {
  readonly frames: number;
  readonly described: readonly FrameReport[];
}

/** Describes `frames` (default: the last); negative numbers count from the end. */
export function inspect(
  input: unknown,
  frames: readonly number[] = [-1],
): Result<InspectReport, readonly Diagnostic[]> {
  const loaded = loadDocument(input);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  if (frames.length > MAX_FRAMES)
    return err([
      {
        code: 'LIMIT_EXCEEDED',
        path: '$',
        message: `At most ${MAX_FRAMES} frames can be inspected at once`,
        hint: 'Ask for fewer frames, e.g. the ones where something should have changed.',
      },
    ]);
  const described: FrameReport[] = [];
  for (const frame of frames) {
    const index = resolveFrame(trace, frame);
    if (!index.ok) return index;
    described.push(describeFrame(trace, index.value));
  }
  return ok({ frames: trace.length + 1, described });
}

/** The report as text for a model to read: one block per frame. */
export function formatInspect(report: InspectReport): string {
  return report.described
    .map((f) => {
      const head = [`Frame ${f.frame} of 0–${report.frames - 1}`];
      if (f.line !== undefined) head.push(`line ${f.line}`);
      const lines = [head.join(' · ')];
      if (f.narration !== undefined) lines.push(`narration: ${f.narration}`);
      if (f.vars !== undefined) lines.push(`vars: ${JSON.stringify(f.vars)}`);
      for (const [name, state] of Object.entries(f.structures))
        lines.push(`${name}: ${JSON.stringify(state)}`);
      return lines.join('\n');
    })
    .join('\n\n');
}
