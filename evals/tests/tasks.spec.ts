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

  it('reject a binary search that never narrows the interval', () => {
    const task = tasks.find((t) => t.id === 'binary-search-miss')!;
    const still = (narration: string) => ({
      actions: [{ target: 'a', type: 'highlight', indices: [3] }],
      meta: { narration },
    });
    const result = grade(task, {
      version: '0.1',
      structures: { a: { kind: 'array', initial: [1, 3, 4, 7, 9, 11, 15] } },
      steps: [
        {
          actions: [
            { target: 'a', type: 'pointer', name: 'lo', index: 0 },
            { target: 'a', type: 'pointer', name: 'mid', index: 3 },
          ],
          meta: { narration: 'Start.' },
        },
        still('Look.'),
        still('Not found.'),
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.correct).toBe(false);
  });

  it('reject an LCS table with only the answer filled in', () => {
    const task = tasks.find((t) => t.id === 'lcs')!;
    const corner = (value: number) => ({
      actions: [{ target: 't', type: 'set', cell: [4, 5], value }],
      meta: { narration: `Set the answer to ${value}.` },
    });
    const result = grade(task, {
      version: '0.1',
      structures: { t: { kind: 'table', rows: 5, columns: 6 } },
      steps: [1, 2, 3, 1, 2, 3].map(corner),
    });
    expect(result.valid).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.problems.join()).toContain('29 wrong cells');
  });

  it('count a missing submission as a failure', () => {
    expect(grade(tasks[0]!, undefined)).toMatchObject({
      submitted: false,
      valid: false,
      correct: false,
    });
  });
});
