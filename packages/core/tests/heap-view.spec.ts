/**
 * The heap view of `array` (ADR 0029): the complete binary tree with the
 * row under it, both drawn from the one array, with the same marks.
 */
import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type Scene,
  type SceneBox,
  type SceneNode,
  type Trace,
} from '../src/index.ts';
import { fitProblems, overlapProblems, sceneProblems } from './scene-check.ts';

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const heap = (
  view: string,
  initial: number[] = [9, 7, 8, 3, 5, 6, 2],
  withSteps = true,
) => ({
  version: '0.4',
  // A label, so the lone structure keeps its caption.
  structures: { h: { kind: 'array', label: 'h', view, initial } },
  steps: !withSteps
    ? [{ actions: [{ target: 'h', type: 'pointer', name: 'i', index: 0 }] }]
    : [
        {
          actions: [
            { target: 'h', type: 'pointer', name: 'i', index: 1 },
            { target: 'h', type: 'compare', i: 1, j: 3 },
          ],
        },
        {
          actions: [
            { target: 'h', type: 'swap', i: 0, j: 6 },
            { target: 'h', type: 'settle', index: 6 },
          ],
        },
        { actions: [] },
      ],
});

const nodes = (scene: Scene) =>
  scene.items.filter((i): i is SceneNode => i.type === 'node');
const cells = (scene: Scene) =>
  scene.items.filter((i): i is SceneBox => i.type === 'box');

describe('view: "heap"', () => {
  const trace = mustLoad(heap('heap'));
  const figure = layoutTrace(trace);

  it('draws every element as a node of the tree and as a cell of the row under it', () => {
    const scene = figure.sceneAt(0);
    expect(nodes(scene).map((n) => n.text)).toEqual([
      '9',
      '7',
      '8',
      '3',
      '5',
      '6',
      '2',
    ]);
    expect(cells(scene).map((c) => c.text)).toEqual([
      '9',
      '7',
      '8',
      '3',
      '5',
      '6',
      '2',
    ]);
    const lowestNode = Math.max(...nodes(scene).map((n) => n.y + n.radius));
    expect(Math.min(...cells(scene).map((c) => c.y))).toBeGreaterThan(
      lowestNode,
    );
    // One title for the structure.
    expect(
      scene.items.filter((i) => i.type === 'text' && i.role === 'title'),
    ).toHaveLength(1);
  });

  it('keys nodes as the tree view does and cells apart, so both animate', () => {
    const tree = layoutTrace(mustLoad(heap('tree'))).sceneAt(0);
    const scene = figure.sceneAt(0);
    expect(nodes(scene).map((n) => n.key)).toEqual(
      nodes(tree).map((n) => n.key),
    );
    expect(cells(scene).map((c) => c.key)).toEqual(
      ['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map(
        (id) => `h/row/element/${id}`,
      ),
    );
  });

  it('gives a node and its cell the same role, frame by frame', () => {
    for (let f = 0; f <= trace.length; f++) {
      const scene = figure.sceneAt(f);
      const role = new Map(
        nodes(scene).map((n) => [n.key.split('/').at(-1), n.role]),
      );
      for (const cell of cells(scene))
        expect(cell.role, `frame ${f} ${cell.key}`).toBe(
          role.get(cell.key.split('/').at(-1)),
        );
    }
    const roles = (f: number) => cells(figure.sceneAt(f)).map((c) => c.role);
    expect(roles(1)).toEqual([
      'default',
      'compare',
      'default',
      'compare',
      'default',
      'default',
      'default',
    ]);
    expect(roles(2)[0]).toBe('swap');
    expect(roles(2).at(-1)).toBe('swap');
    expect(roles(3).at(-1)).toBe('settled');
  });

  it('draws the pointer in both views', () => {
    const scene = figure.sceneAt(1);
    const badges = scene.items.filter(
      (i) => i.type === 'badge' && i.text === 'i',
    );
    expect(badges).toHaveLength(2);
  });

  it.each([
    ['seven elements', [9, 7, 8, 3, 5, 6, 2]],
    ['one element', [4]],
    ['fifteen elements', Array.from({ length: 15 }, (_, k) => 30 - k)],
  ])('keeps one size and draws cleanly (%s)', (_, initial) => {
    const t = mustLoad(heap('heap', initial, initial.length === 7));
    const f = layoutTrace(t);
    const first = f.sceneAt(0);
    for (let k = 0; k <= t.length; k++) {
      const scene = f.sceneAt(k);
      expect([scene.width, scene.height]).toEqual([first.width, first.height]);
      expect(sceneProblems(scene), `frame ${k}`).toEqual([]);
      expect(overlapProblems(scene), `frame ${k}`).toEqual([]);
      expect(fitProblems(scene), `frame ${k}`).toEqual([]);
    }
  });
});
