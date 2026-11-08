/**
 * ADR 0031: pointer bands open only over the frames that have pointers,
 * and settled elements leave the tree of a heap view.
 */
import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type Scene,
  type Trace,
} from '../src/index.ts';

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const boxY = (scene: Scene, key: string) => {
  const item = scene.items.find((i) => i.key === key);
  if (item === undefined || item.type !== 'box') throw new Error(key);
  return item.y;
};

describe('pointer bands (ADR 0031)', () => {
  // `a` has a pointer in frames 1 and 2 only; `b` sits below it.
  const trace = mustLoad({
    version: '0.1',
    structures: {
      a: { kind: 'array', initial: [3, 1, 2] },
      b: { kind: 'array', initial: [9] },
    },
    steps: [
      { actions: [{ target: 'a', type: 'pointer', name: 'i', index: 0 }] },
      { actions: [{ target: 'a', type: 'pointer', name: 'i', index: 1 }] },
      { actions: [{ target: 'a', type: 'pointer', name: 'i', index: null }] },
    ],
  });
  const layout = layoutTrace(trace);
  const scenes = [0, 1, 2, 3].map((f) => layout.sceneAt(f));
  const below = scenes.map((s) => boxY(s, 'b/element/e0'));

  it('are open over the frames that have pointers, and nothing moves there', () => {
    expect(below[1]).toBe(below[2]);
  });

  it('are closed before and after, so what is below sits higher', () => {
    expect(below[0]).toBe(below[3]);
    expect(below[0]).toBeLessThan(below[1]!);
  });

  it('keep every frame the same size, the canvas of ADR 0025', () => {
    expect(new Set(scenes.map((s) => `${s.width}x${s.height}`)).size).toBe(1);
  });

  it('are closed in the frames before the first pointer', () => {
    const always = layoutTrace(
      mustLoad({
        version: '0.1',
        structures: {
          a: { kind: 'array', initial: [1, 2] },
          b: { kind: 'array', initial: [9] },
        },
        steps: [
          { actions: [{ target: 'a', type: 'pointer', name: 'i', index: 0 }] },
        ],
      }),
    );
    // Frame 0 has no pointer: the span is frame 1 alone.
    expect(boxY(always.sceneAt(0), 'b/element/e0')).toBeLessThan(
      boxY(always.sceneAt(1), 'b/element/e0'),
    );
  });
});

describe('a heap view’s settled elements (ADR 0031)', () => {
  const trace = mustLoad({
    version: '0.4',
    structures: {
      h: { kind: 'array', view: 'heap', initial: [5, 3, 4, 1, 2] },
    },
    steps: [
      {
        actions: [
          { target: 'h', type: 'settle', index: 4 },
          { target: 'h', type: 'settle', index: 3 },
        ],
      },
    ],
  });
  const edges = (f: number) =>
    layoutTrace(trace)
      .sceneAt(f)
      .items.filter((i) => i.type === 'edge' && i.key.includes('/heap-edge/'))
      .map((i) => i.key.split('/').at(-1));

  it('are linked while in the heap', () => {
    expect(edges(0)).toEqual(['1', '2', '3', '4']);
  });

  it('leave the tree once settled, keeping their place', () => {
    expect(edges(1)).toEqual(['1', '2']);
    const nodes = layoutTrace(trace)
      .sceneAt(1)
      .items.filter((i) => i.type === 'node');
    expect(nodes).toHaveLength(5);
  });
});
