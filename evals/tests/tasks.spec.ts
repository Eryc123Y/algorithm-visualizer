import { describe, expect, it } from 'vitest';

import { loadTrace, type TreeData } from '@algoviz/core';

import { grade } from '../src/grade.ts';
import { tasks } from '../src/tasks.ts';
import { references } from './references.ts';

/** A tree's state as a declaration: uncoloured nodes have no colour. */
const treeDecl = ({ nodes, roots }: TreeData) => ({
  nodes: nodes.map(({ color, ...n }) => (color === null ? n : { ...n, color })),
  roots,
});

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

  // A document that declares the answer up front and then does nothing:
  // each structure starts at the reference's final state, followed by
  // empty narrated steps.
  it.each(tasks.map((t) => [t.id, t] as const))(
    'reject the answer declared up front for %s',
    (id, task) => {
      const loaded = loadTrace(references[id]!());
      if (!loaded.ok) throw new Error(id);
      const trace = loaded.value;
      const last = trace.frame(trace.length).state;
      const structures = Object.fromEntries(
        Object.entries(trace.visualization.structures).map(([name, decl]) => {
          const { data } = last[name]!.state as { data: unknown };
          const solved =
            decl.kind === 'hashTable'
              ? { buckets: data }
              : decl.kind === 'table'
                ? { cells: data }
                : decl.kind === 'tree'
                  ? treeDecl(data as TreeData)
                  : decl.kind === 'graph' || decl.kind === 'linkedList'
                    ? {}
                    : { initial: data };
          return [name, { ...decl, ...solved }];
        }),
      );
      const result = grade(task, {
        version: '0.1',
        structures,
        steps: Array.from({ length: task.minSteps }, (_, k) => ({
          actions: [],
          meta: { narration: `Step ${k + 1}.` },
        })),
      });
      expect(result.errors).toEqual([]);
      expect(result.correct).toBe(false);
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

  it('reject a red–black tree that starts already balanced', () => {
    const task = tasks.find((t) => t.id === 'red-black-insert')!;
    const wait = (narration: string) => ({
      actions: [{ target: 't', type: 'highlight', nodes: ['n2'] }],
      meta: { narration },
    });
    const result = grade(task, {
      version: '0.1',
      structures: {
        t: {
          kind: 'tree',
          binary: true,
          nodes: [
            { id: 'n2', value: 2, color: 'black', children: ['n1', 'n3'] },
            { id: 'n1', value: 1, color: 'red' },
            { id: 'n3', value: 3, color: 'red' },
          ],
        },
      },
      steps: ['Insert 1.', 'Insert 2.', 'Insert 3.', 'Fix.'].map(wait),
    });
    expect(result.valid).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.problems.join()).toContain('does not start empty');
  });

  it('reject a colouring out of order or not with the smallest colours', () => {
    const task = tasks.find((t) => t.id === 'graph-coloring')!;
    const colour = (node: string, group: number) => ({
      actions: [{ target: 'g', type: 'group', node, group }],
      meta: { narration: `Colour ${node}.` },
    });
    const result = grade(task, {
      version: '0.1',
      structures: {
        g: {
          kind: 'graph',
          nodes: ['A', 'B', 'C', 'D', 'E'],
          edges: [
            ['A', 'B'],
            ['B', 'C'],
            ['C', 'A'],
            ['C', 'D'],
            ['D', 'E'],
          ],
        },
      },
      steps: [
        colour('E', 2),
        colour('D', 1),
        colour('C', 0),
        colour('B', 2),
        colour('A', 1),
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.problems).toEqual([
      'g: colours the nodes in the order E, D, C, B, A',
      'g: colours are not the smallest free ones',
    ]);
  });

  it('reject a Kruskal run that never marks rejected edges', () => {
    const task = tasks.find((t) => t.id === 'kruskal')!;
    const doc = JSON.parse(JSON.stringify(references['kruskal']!())) as {
      steps: { actions: { type: string; mark?: string }[] }[];
    };
    for (const step of doc.steps)
      step.actions = step.actions.filter((a) => a.mark !== 'rejected');
    const result = grade(task, doc);
    expect(result.errors).toEqual([]);
    expect(result.problems.join()).toContain('rejected');
  });

  it('reject a sort done in one step and padded', () => {
    const task = tasks.find((t) => t.id === 'insertion-sort')!;
    const pad = (k: number) => ({
      actions: [{ target: 'a', type: 'highlight', indices: [0] }],
      meta: { narration: `Look ${k}.` },
    });
    const result = grade(task, {
      version: '0.1',
      structures: { a: { kind: 'array', initial: [5, 2, 4, 6, 1, 3] } },
      steps: [
        {
          actions: [1, 2, 3, 4, 5, 6].map((value, index) => ({
            target: 'a',
            type: 'set',
            index,
            value,
          })),
          meta: { narration: 'Sort.' },
        },
        ...[1, 2, 3, 4, 5, 6, 7].map(pad),
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.problems.join()).toContain('insertion pass');
  });

  it('count a missing submission as a failure', () => {
    expect(grade(tasks[0]!, undefined)).toMatchObject({
      submitted: false,
      valid: false,
      correct: false,
    });
  });
});
