/**
 * Where an operation records its steps. A recording tape writes them into a
 * document; a silent tape drops them, so the same operation code builds a
 * starting state without animating it.
 */
import {
  actionTypesOf,
  type StepMeta,
  type StructureKindName,
} from '@algoviz/spec';

import type { Handle, Recorder } from '../recorder.ts';
import type { JoinedSnippets, Snippet } from './snippet.ts';

export interface Tape<K extends StructureKindName> {
  /** Records actions on the structure. */
  readonly on: Handle<K>;
  /**
   * Starts a step at a marker of the operation's code; the step is named
   * after the marker (ADR 0020).
   */
  step(anchor: string, narration: string, vars?: StepMeta['vars']): void;
}

/** A handle whose methods record nothing. */
function silentHandle<K extends StructureKindName>(kind: K): Handle<K> {
  const handle: Record<string, () => unknown> = {};
  for (const type of actionTypesOf(kind)) handle[type] = () => handle;
  return Object.freeze(handle) as unknown as Handle<K>;
}

export function silentTape<K extends StructureKindName>(kind: K): Tape<K> {
  return { on: silentHandle(kind), step: () => undefined };
}

/**
 * A tape that records into `recorder`. `first`, if given, records more
 * actions in the operation's first step, such as clearing pointers an
 * earlier operation left behind.
 */
export function recordingTape<K extends StructureKindName>(
  recorder: Recorder,
  on: Handle<K>,
  code: JoinedSnippets,
  snippet: Snippet,
  first?: (tape: Tape<K>) => void,
): Tape<K> {
  let pending = first;
  const tape: Tape<K> = {
    on,
    step(anchor, narration, vars) {
      recorder.step({
        id: anchor,
        line: code.line(snippet, anchor),
        narration,
        ...(vars === undefined ? {} : { vars }),
      });
      const run = pending;
      pending = undefined;
      run?.(tape);
    },
  };
  return tape;
}
