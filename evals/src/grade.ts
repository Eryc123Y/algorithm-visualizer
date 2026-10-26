/**
 * Grading a submitted document against its task, and summarizing a run.
 */
import { loadTrace } from '@algoviz/core';
import { readDocument, lint } from '@algoviz/mcp';
import type { Diagnostic } from '@algoviz/spec';

import type { EvalTask } from './tasks.ts';

export interface Grade {
  readonly task: string;
  /** Whether a document was submitted at all. */
  readonly submitted: boolean;
  readonly valid: boolean;
  /** Valid, long enough, and its checks pass. */
  readonly correct: boolean;
  readonly errors: readonly Diagnostic[];
  readonly problems: readonly string[];
  readonly steps: number;
  /** Share of steps with a narration. */
  readonly narrated: number;
  readonly warnings: readonly string[];
}

export function grade(task: EvalTask, input: unknown): Grade {
  const base = {
    task: task.id,
    submitted: input !== undefined,
    problems: [] as string[],
    steps: 0,
    narrated: 0,
    warnings: [] as string[],
  };
  if (input === undefined)
    return { ...base, valid: false, correct: false, errors: [] };
  const read = readDocument(input);
  const loaded = read.ok ? loadTrace(read.value) : read;
  if (!loaded.ok)
    return { ...base, valid: false, correct: false, errors: loaded.error };
  const trace = loaded.value;
  const steps = trace.visualization.steps;
  let problems: string[];
  try {
    problems = task.check(trace);
  } catch (e) {
    // A check that trips over an unexpected shape counts as a failure.
    problems = [`check failed: ${e instanceof Error ? e.message : String(e)}`];
  }
  if (steps.length < task.minSteps)
    problems = [
      ...problems,
      `${steps.length} steps; at least ${task.minSteps} are needed to show the algorithm`,
    ];
  return {
    ...base,
    valid: true,
    correct: problems.length === 0,
    errors: [],
    problems,
    steps: steps.length,
    narrated:
      steps.length === 0
        ? 0
        : steps.filter((s) => s.meta?.narration !== undefined).length /
          steps.length,
    warnings: lint(trace).map((w) => w.code),
  };
}
