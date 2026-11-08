/**
 * A call stack beside the main structure, for recursive procedures (ADR
 * 0029). Each call that records a step has an entry, pushed in its first
 * step:
 *
 * - `pop` takes the top entry off in the current step, for a call whose
 *   last step is its own, such as MERGE-SORT's `merged`;
 * - `leave` takes it off at the start of the next step, for a call that
 *   ends without a step of its own, such as QUICKSORT after its second
 *   recursive call, so each frame shows the calls active during its step;
 * - `close` takes off every entry left, in the last step, so the last frame
 *   shows the finished run.
 *
 * Record steps through `trace`, which starts each step by taking off the
 * entries of calls that have left since the step before.
 */
import type { Trace } from './trace.ts';

export interface CallStack {
  /** The trace to record steps on; see above. */
  readonly trace: Trace;
  /** Pushes an entry, `{ id, value }`; ids are unique for the whole run. */
  push(id: string, value: string): void;
  /** Takes the top entry off now. */
  pop(): void;
  /** Takes the top entry off at the start of the next step. */
  leave(): void;
  /** Takes off every entry, now. */
  close(): void;
}

/** Declares the stack, `calls`, in the side panel of the figure. */
export function callStack(trace: Trace, label = 'call stack'): CallStack {
  const calls = trace.add('calls', {
    kind: 'stack',
    label,
    place: 'side',
    initial: [],
  });
  // Entries on the stack, and how many of the top ones have left.
  let depth = 0;
  let left = 0;
  const flush = () => {
    for (; left > 0; left--, depth--) calls.pop();
  };
  return {
    trace: {
      add: (name, decl) => trace.add(name, decl),
      section: (id, title) => trace.section(id, title),
      step(anchor, narration, options) {
        trace.step(anchor, narration, options);
        flush();
      },
    },
    push(id, value) {
      calls.push({ element: { id, value } });
      depth += 1;
    },
    pop() {
      calls.pop();
      depth -= 1;
    },
    leave() {
      left += 1;
    },
    close() {
      left = depth;
      flush();
    },
  };
}
