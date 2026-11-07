/**
 * Where an algorithm records its run (ADR 0019): it declares structures,
 * starts steps at anchors of its code and starts sections. A recording
 * trace writes them into a document; a silent trace drops them, so the
 * same code builds a starting state without animating it (ADR 0018).
 */
import {
  actionTypesOf,
  type StepMeta,
  type StructureDeclInput,
  type StructureKindName,
} from '@algoviz/spec';

import type { Handle, Recorder } from './recorder.ts';
import type { JoinedCode, Listing } from './snippet.ts';

export interface StepOptions {
  /** The step's name (ADR 0020); by default its anchor. */
  readonly id?: string;
  /** Variables to show with the step. */
  readonly vars?: StepMeta['vars'];
}

export interface Trace {
  /** Declares a structure and returns the handle that records its actions. */
  add<const D extends StructureDeclInput>(
    name: string,
    decl: D,
  ): Handle<D['kind']>;
  /**
   * Starts a step at an anchor of the code, which names a line in every
   * language (ADR 0017), or at `null` for a step with no line, such as
   * "The array is sorted.". Actions recorded until the next step belong to
   * it. The step is named after its anchor unless `id` says otherwise; a
   * step at `null` needs an `id` to be named.
   */
  step(anchor: string | null, narration: string, options?: StepOptions): void;
  /** Starts a section at the next step (ADR 0020). */
  section(id: string, title: string): void;
}

/** A handle whose methods record nothing. */
export function silentHandle<K extends StructureKindName>(kind: K): Handle<K> {
  const handle: Record<string, () => unknown> = {};
  for (const type of actionTypesOf(kind)) handle[type] = () => handle;
  return Object.freeze(handle) as unknown as Handle<K>;
}

/** A trace that records nothing. */
export function silentTrace(): Trace {
  return {
    add: <const D extends StructureDeclInput>(_: string, decl: D) =>
      silentHandle(decl.kind),
    step: () => undefined,
    section: () => undefined,
  };
}

/**
 * A trace that records into `recorder`, whose code has `anchors`. Unknown
 * anchors and empty narrations are programming errors, so they throw an
 * Error rather than a RangeError.
 */
export function recordingTrace(
  recorder: Recorder,
  anchors: ReadonlySet<string>,
): Trace {
  return {
    add: <const D extends StructureDeclInput>(name: string, decl: D) =>
      recorder.add(name, decl),
    step(anchor, narration, { id, vars } = {}) {
      if (anchor !== null && !anchors.has(anchor))
        throw new Error(`No anchor "${anchor}" in the code`);
      if (narration.trim() === '') throw new Error('A step needs a narration');
      const name = id ?? anchor ?? undefined;
      recorder.step({
        ...(name === undefined ? {} : { id: name }),
        ...(anchor === null ? {} : { at: anchor }),
        narration,
        ...(vars === undefined ? {} : { vars }),
      });
    },
    section(id, title) {
      recorder.section(id, title);
    },
  };
}

/**
 * The trace of one listing among joined ones: a step names a marker of
 * `listing`, which becomes the document's anchor for it, and is named after
 * the marker. `first`, if given, runs right after the first step starts,
 * e.g. to clear pointers an earlier operation left behind.
 */
export function listingTrace(
  trace: Trace,
  code: JoinedCode,
  listing: Listing,
  first?: () => void,
): Trace {
  let pending = first;
  return {
    add: <const D extends StructureDeclInput>(name: string, decl: D) =>
      trace.add(name, decl),
    step(marker, narration, options = {}) {
      const id = options.id ?? marker ?? undefined;
      trace.step(
        marker === null ? null : code.anchor(listing, marker),
        narration,
        { ...options, ...(id === undefined ? {} : { id }) },
      );
      const run = pending;
      pending = undefined;
      run?.();
    },
    section: (id, title) => trace.section(id, title),
  };
}
