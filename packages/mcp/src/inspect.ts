/**
 * The state of each structure at chosen frames, so an author can check that
 * a document does what they meant without looking at pictures.
 */
import {
  sectionAt,
  selectorOf,
  stepNameAt,
  type FrameRange,
  type Trace,
} from '@algoviz/core';
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';

import { loadDocument, resolveFrames, type FrameSelector } from './document.ts';

/** At most this many frames are described per call. */
export const MAX_FRAMES = 20;

export interface FrameReport {
  readonly frame: number;
  /** The name of the step that produced the frame (ADR 0020). */
  readonly step?: string;
  /** The id and title of that step's section. */
  readonly section?: string;
  readonly sectionTitle?: string;
  /** The most specific selector of the frame, e.g. "insert-5/go#2". */
  readonly selector?: string;
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
  const vis = trace.visualization;
  const name = stepNameAt(vis, index);
  const section = sectionAt(vis, index);
  const selector = selectorOf(vis, index);
  return {
    frame: index,
    ...(name === undefined ? {} : { step: name }),
    ...(section === undefined
      ? {}
      : { section: section.id, sectionTitle: section.title }),
    ...(selector === String(index) ? {} : { selector }),
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

/**
 * Describes the frames that `selectors` name (default: the last). Each is
 * a frame number, negative from the end, or a selector such as "relax#2",
 * a section, or a range "a..b" (ADR 0020).
 */
export function inspect(
  input: unknown,
  selectors: readonly FrameSelector[] = [-1],
): Result<InspectReport, readonly Diagnostic[]> {
  const loaded = loadDocument(input);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  const ranges: FrameRange[] = [];
  for (const selector of selectors) {
    const range = resolveFrames(trace, selector);
    if (!range.ok) return range;
    ranges.push(range.value);
  }
  // Counted before the frames are listed, as a range may be long.
  const count = ranges.reduce((n, r) => n + r.to - r.from + 1, 0);
  if (count > MAX_FRAMES)
    return err([
      {
        code: 'LIMIT_EXCEEDED',
        path: '$',
        message: `The selectors name ${count} frames, but at most ${MAX_FRAMES} can be inspected at once`,
        hint: 'Ask for fewer frames, e.g. the steps where something should have changed, such as "insert-5/go#2".',
      },
    ]);
  const indices = ranges.flatMap(({ from, to }) =>
    Array.from({ length: to - from + 1 }, (_, k) => from + k),
  );
  return ok({
    frames: trace.length + 1,
    described: indices.map((index) => describeFrame(trace, index)),
  });
}

/** The report as text for a model to read: one block per frame. */
export function formatInspect(report: InspectReport): string {
  return report.described
    .map((f) => {
      const head = [`Frame ${f.frame} of 0–${report.frames - 1}`];
      if (f.selector !== undefined) head.push(f.selector);
      if (f.sectionTitle !== undefined)
        head.push(`section ${JSON.stringify(f.sectionTitle)}`);
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
