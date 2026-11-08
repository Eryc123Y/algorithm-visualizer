/**
 * A settled element keeps showing that it is settled under a transient
 * mark (ADR 0031): its scene item carries `settled: true` beside the
 * stronger role, and only then.
 */
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene } from '../src/index.ts';

function lastScene(input: unknown): Scene {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return layoutTrace(result.value).sceneAt(result.value.length);
}

const item = (scene: Scene, key: string) => {
  const found = scene.items.find((i) => i.key === key);
  if (found === undefined || (found.type !== 'node' && found.type !== 'box'))
    throw new Error(`no node or box ${key}`);
  return found;
};

/** A document of one structure: settled first, marked in the last step. */
const doc = (structure: unknown, settle: unknown, mark: unknown) => ({
  version: '0.4',
  structures: { s: structure },
  steps: [
    { actions: [{ target: 's', ...(settle as object) }] },
    { actions: [{ target: 's', ...(mark as object) }] },
  ],
});

const cases: [string, unknown, unknown, unknown, string, string][] = [
  [
    'graph',
    { kind: 'graph', nodes: ['A', 'B'], edges: [['A', 'B']] },
    { type: 'settle', node: 'A' },
    { type: 'highlight', nodes: ['A'] },
    's/element/A',
    'highlight',
  ],
  [
    'tree',
    {
      kind: 'tree',
      binary: true,
      nodes: [
        { id: 'a', value: 2, children: ['b', null] },
        { id: 'b', value: 1 },
      ],
      roots: ['a'],
    },
    { type: 'settle', node: 'a' },
    { type: 'highlight', nodes: ['a'] },
    's/element/a',
    'highlight',
  ],
  [
    'array row',
    { kind: 'array', initial: [3, 1, 2] },
    { type: 'settle', index: 0 },
    { type: 'compare', i: 0, j: 1 },
    's/element/e0',
    'compare',
  ],
  [
    'heap view',
    { kind: 'array', view: 'heap', initial: [3, 1, 2] },
    { type: 'settle', index: 0 },
    { type: 'highlight', indices: [0] },
    's/element/e0',
    'highlight',
  ],
  [
    'linked list',
    { kind: 'linkedList', initial: [3, 1] },
    { type: 'settle', index: 0 },
    { type: 'highlight', indices: [0] },
    's/element/e0',
    'highlight',
  ],
  [
    'table',
    { kind: 'table', rows: 1, columns: 2 },
    { type: 'settle', cells: [[0, 0]] },
    { type: 'highlight', cells: [[0, 0]] },
    's/cell/0/0',
    'highlight',
  ],
];

describe('settled under a transient mark (ADR 0031)', () => {
  it.each(cases)('%s', (_, structure, settle, mark, key, role) => {
    const scene = lastScene(doc(structure, settle, mark));
    const marked = item(scene, key);
    expect(marked.role).toBe(role);
    expect(marked.settled).toBe(true);
  });

  it('leaves settled out where the role says it, or nothing is settled', () => {
    const settledOnly = lastScene({
      version: '0.1',
      structures: { s: { kind: 'array', initial: [1, 2] } },
      steps: [{ actions: [{ target: 's', type: 'settle', index: 0 }] }],
    });
    const cells = settledOnly.items.filter((i) => i.type === 'box');
    expect(cells.map((c) => c.type === 'box' && c.role)).toEqual([
      'settled',
      'default',
    ]);
    expect(cells.some((c) => 'settled' in c)).toBe(false);
  });
});
