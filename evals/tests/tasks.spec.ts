import { describe, expect, it } from 'vitest';

import { grade } from '../src/grade.ts';
import { tasks } from '../src/tasks.ts';
import { references } from './references.ts';

describe('eval tasks', () => {
  it('have unique ids and a reference each', () => {
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(references).sort()).toEqual([...ids].sort());
  });

  it.each(tasks.map((t) => [t.id, t] as const))(
    'accept a correct solution of %s',
    (id, task) => {
      const result = grade(task, references[id]!());
      expect(result.errors).toEqual([]);
      expect(result.problems).toEqual([]);
      expect(result.correct).toBe(true);
    },
  );

  it.each(tasks.map((t) => [t.id, t] as const))(
    'reject the solutions of other tasks for %s',
    (id, task) => {
      const passing = Object.entries(references)
        .filter(([other]) => other !== id)
        .filter(([, build]) => grade(task, build()).correct)
        .map(([other]) => other);
      expect(passing).toEqual([]);
    },
  );

  it('reject a solution without its steps', () => {
    const task = tasks.find((t) => t.id === 'insertion-sort')!;
    const doc = { ...references['insertion-sort']!(), steps: [] };
    expect(grade(task, doc).correct).toBe(false);
  });

  it('count a missing submission as a failure', () => {
    expect(grade(tasks[0]!, undefined)).toMatchObject({
      submitted: false,
      valid: false,
      correct: false,
    });
  });
});
