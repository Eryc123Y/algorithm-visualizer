/**
 * The words the layout draws itself, in the figure's locale (ADR 0045):
 * "(empty)", the stack's "top" and the queue's "front" and "back".
 */
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene } from '../src/index.ts';
import { fitProblems, sceneProblems } from './scene-check.ts';

const mustLoad = (input: unknown) => {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

/** A document with every structure that draws a word of its own. */
const doc = (initial: boolean) =>
  mustLoad({
    version: '1.0',
    structures: {
      s: { kind: 'stack', initial: initial ? [1, 2] : [] },
      q: { kind: 'queue', initial: initial ? [1, 2] : [] },
      h: { kind: 'array', view: 'heap', initial: initial ? [3, 1] : [] },
      p: {
        kind: 'priorityQueue',
        initial: initial ? [{ value: 'x', key: 1 }] : [],
      },
      g: { kind: 'graph', nodes: [], edges: [] },
      t: { kind: 'tree', levelOrder: [] },
    },
    steps: [],
  });

const words = (scene: Scene) =>
  scene.items.flatMap((item) =>
    'text' in item && typeof item.text === 'string' ? [item.text] : [],
  );

describe('the layout’s own words', () => {
  it('are English by default', () => {
    const empty = words(layoutTrace(doc(false)).sceneAt(0));
    expect(empty).toContain('(empty)');
    expect(empty).toContain('top (empty)');
    const full = words(layoutTrace(doc(true)).sceneAt(0));
    expect(full).toEqual(
      expect.arrayContaining(['top', 'front', 'back', 'min']),
    );
  });

  it('are Chinese in Chinese, and nothing English is left', () => {
    const empty = words(layoutTrace(doc(false), { locale: 'zh' }).sceneAt(0));
    expect(empty).toContain('（空）');
    expect(empty).toContain('栈顶（空）');
    const full = words(layoutTrace(doc(true), { locale: 'zh' }).sceneAt(0));
    expect(full).toEqual(
      expect.arrayContaining(['栈顶', '队头', '队尾', '最小']),
    );
    for (const w of [...empty, ...full]) expect(w).not.toMatch(/[a-z]{2,}/);
  });

  it('fit their figure in either locale', () => {
    for (const locale of ['en', 'zh'] as const)
      for (const initial of [false, true]) {
        const scene = layoutTrace(doc(initial), { locale }).sceneAt(0);
        expect(sceneProblems(scene)).toEqual([]);
        expect(fitProblems(scene)).toEqual([]);
      }
  });
});
