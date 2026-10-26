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
  /** Starts a step at a marker of the operation's code. */
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

export function recordingTape<K extends StructureKindName>(
  recorder: Recorder,
  on: Handle<K>,
  code: JoinedSnippets,
  snippet: Snippet,
): Tape<K> {
  return {
    on,
    step(anchor, narration, vars) {
      recorder.step({
        line: code.line(snippet, anchor),
        narration,
        ...(vars === undefined ? {} : { vars }),
      });
    },
  };
}
