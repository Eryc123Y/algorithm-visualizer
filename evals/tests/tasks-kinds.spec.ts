/**
 * The tasks for the newer kinds reject the near misses a model might
 * hand in: a related algorithm on the same input, or the right answer
 * reached the wrong way.
 */
import { describe, expect, it } from 'vitest';

import * as recipes from '@algoviz/recipes';
import { Recorder } from '@algoviz/recipes';

import { grade } from '../src/grade.ts';
import { tasks } from '../src/tasks.ts';
import { references } from './references.ts';

const task = (id: string) => tasks.find((t) => t.id === id)!;

function run(id: string, input: unknown) {
  const result = recipes.runAlgorithm(id, input);
  if (!result.ok) throw new Error(result.error.map((e) => e.message).join());
  return result.value.document;
}

/** The problems a valid document has with a task. */
function problems(id: string, doc: unknown): readonly string[] {
  const result = grade(task(id), doc);
  expect(result.errors).toEqual([]);
  return result.problems;
}

describe('tasks for the newer kinds', () => {
  it('reject the naive matcher for KMP', () => {
    const naive = run('naive-string-matcher', {
      text: 'abaabacababacab',
      pattern: 'abacab',
    });
    expect(problems('kmp', naive).join()).toMatch(/through shifts 0, 1, 2/);
  });

  it("reject Jarvis's march for Graham's scan", () => {
    const points = references['graham-scan']!().structures['P'] as {
      points: unknown;
    };
    const jarvis = run('jarvis-march', { points: points.points });
    expect(problems('graham-scan', jarvis).join()).toContain('popping');
  });

  it("reject Dijkstra's queue for Prim's", () => {
    const prim = references['prim-queue']!();
    const graph = prim.structures['g'] as { nodes: string[]; edges: unknown };
    const dijkstra = run('dijkstra', {
      graph: { nodes: graph.nodes, edges: graph.edges },
      source: 'A',
    });
    expect(problems('prim-queue', dijkstra).join()).toMatch(/extracts/);
  });

  it("reject Prim's queue drawn under the graph", () => {
    const prim = references['prim-queue']!();
    const queue = { ...prim.structures['Q'], place: 'main' };
    const doc = { ...prim, structures: { ...prim.structures, Q: queue } };
    expect(problems('prim-queue', doc)).toEqual([
      'no priority queue in the side panel',
    ]);
  });

  it('reject a B-tree of another minimum degree', () => {
    const t3 = run('b-tree', {
      from: { t: 3, keys: [] },
      ops: [8, 3, 12, 5, 1, 9, 15, 7].map((key) => ({ op: 'insert', key })),
    });
    expect(problems('b-tree-insert', t3).join()).toMatch(/ends as \[5\]/);
  });

  it('reject an extract-min that never consolidates', () => {
    const full = references['fibonacci-extract-min']!();
    const doc = { ...full, steps: full.steps.slice(0, 3) };
    expect(problems('fibonacci-extract-min', doc).join()).toContain(
      'not consolidated',
    );
  });

  it('reject move-to-front done by deleting and re-inserting nodes', () => {
    const r = new Recorder();
    const l = r.add('list', { kind: 'linkedList', initial: [3, 8, 5, 1, 6] });
    let order = [3, 8, 5, 1, 6];
    for (const x of [5, 1, 5, 6]) {
      const at = order.indexOf(x);
      r.step(`Move ${x} to the front.`);
      if (at > 0) {
        l.remove({ index: at }).insert({ index: 0, element: x });
        order = [x, ...order.filter((y) => y !== x)];
        for (let k = 0; k + 1 < order.length; k++)
          l.link({ from: k, to: k + 1 });
      }
    }
    expect(problems('move-to-front', r.build())).toEqual([
      'list: replaces nodes instead of moving them',
    ]);
  });
});
