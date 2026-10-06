import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import {
  bareLayoutOptions,
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  type Scene,
  type SceneBox,
  type Trace,
} from '../src/index.ts';

function mustLoad(input: VisualizationInput): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const boxes = (scene: Scene) =>
  scene.items.filter((item): item is SceneBox => item.type === 'box');

const doc = (
  initial: (number | string)[],
  steps: VisualizationInput['steps'],
): VisualizationInput => ({
  version: '0.1',
  structures: { arr: { kind: 'array', initial } },
  steps,
});

describe('layoutTrace', () => {
  const swaps = mustLoad(
    doc(
      [5, 3, 8, 1],
      [
        { actions: [{ target: 'arr', type: 'swap', i: 0, j: 1 }] },
        {
          actions: [
            { target: 'arr', type: 'set', index: 2, value: 12345 },
            { target: 'arr', type: 'pointer', name: 'i', index: 4 },
          ],
        },
        {
          actions: [{ target: 'arr', type: 'pointer', name: 'i', index: null }],
        },
      ],
    ),
  );
  const layout = layoutTrace(swaps);
  const scenes = [0, 1, 2, 3].map((i) => layout.sceneAt(i));

  it('keeps the scene size and cell width constant across frames', () => {
    for (const scene of scenes) {
      expect(scene.width).toBe(scenes[0]!.width);
      expect(scene.height).toBe(scenes[0]!.height);
      for (const box of boxes(scene))
        expect(box.width).toBe(boxes(scenes[0]!)[0]!.width);
    }
  });

  it('sizes cells for the longest value in any frame', () => {
    // "12345" only appears from frame 2, but frame 0 already reserves room.
    const o = defaultLayoutOptions;
    expect(boxes(scenes[0]!)[0]!.width).toBe(
      Math.ceil(5 * o.valueFontSize * o.charWidthRatio + 2 * o.cellPadding),
    );
  });

  it('keys cells by element id so a swap moves boxes instead of relabelling them', () => {
    const before = new Map(boxes(scenes[0]!).map((b) => [b.key, b.x]));
    const after = new Map(boxes(scenes[1]!).map((b) => [b.key, b.x]));
    expect(after.get('arr/element/e0')).toBe(before.get('arr/element/e1'));
    expect(after.get('arr/element/e1')).toBe(before.get('arr/element/e0'));
  });

  it('places cells left to right without overlap, inside the scene', () => {
    for (const scene of scenes) {
      const xs = boxes(scene).map((b) => [b.x, b.x + b.width] as const);
      xs.forEach(([, right], k) => {
        const next = xs[k + 1];
        if (next) expect(next[0]).toBeGreaterThan(right);
      });
      for (const item of scene.items) {
        const x = item.type === 'arrow' ? item.x1 : item.x;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(scene.width);
      }
    }
  });

  it('reserves a slot for a pointer one past the end', () => {
    const pointer = scenes[2]!.items.find(
      (item) => item.key === 'arr/pointer/i',
    );
    const lastBox = boxes(scenes[2]!).at(-1)!;
    expect(pointer?.type === 'badge' && pointer.x).toBeGreaterThan(
      lastBox.x + lastBox.width,
    );
  });
});

describe('cell roles', () => {
  it('marks swapped cells for the step of the swap only', () => {
    const trace = mustLoad(
      doc(
        [1, 2, 3],
        [
          { actions: [{ target: 'arr', type: 'swap', i: 0, j: 2 }] },
          { actions: [] },
        ],
      ),
    );
    const layout = layoutTrace(trace);
    expect(boxes(layout.sceneAt(1)).map((b) => b.role)).toEqual([
      'swap',
      'default',
      'swap',
    ]);
    expect(boxes(layout.sceneAt(2)).map((b) => b.role)).toEqual([
      'default',
      'default',
      'default',
    ]);
  });

  it('prefers compare over highlight over settled', () => {
    const trace = mustLoad(
      doc(
        [1, 2, 3],
        [
          {
            actions: [
              { target: 'arr', type: 'settle', index: 0 },
              { target: 'arr', type: 'settle', index: 1 },
              { target: 'arr', type: 'highlight', indices: [0, 2] },
              { target: 'arr', type: 'compare', i: 0, j: 1 },
            ],
          },
        ],
      ),
    );
    const roles = boxes(layoutTrace(trace).sceneAt(1)).map((b) => b.role);
    expect(roles).toEqual(['compare', 'compare', 'highlight']);
  });

  it('stacks pointers at one index with a single arrow', () => {
    const trace = mustLoad(
      doc(
        [1, 2],
        [
          {
            actions: [
              { target: 'arr', type: 'pointer', name: 'lo', index: 0 },
              { target: 'arr', type: 'pointer', name: 'i', index: 0 },
            ],
          },
        ],
      ),
    );
    const scene = layoutTrace(trace).sceneAt(1);
    const labels = scene.items.filter((i) => i.type === 'badge');
    const arrows = scene.items.filter((i) => i.type === 'arrow');
    expect(labels.map((l) => l.type === 'badge' && l.text)).toEqual([
      'i',
      'lo',
    ]);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.key).toBe('arr/pointer-arrow/i');
  });
});

describe('multiple structures', () => {
  it('stacks structures vertically in declaration order with their labels', () => {
    const trace = mustLoad({
      version: '0.1',
      title: 'Two arrays',
      structures: {
        a: { kind: 'array', initial: [1] },
        b: { kind: 'array', label: 'output', initial: [2, 3] },
      },
      steps: [],
    });
    const scene = layoutTrace(trace).sceneAt(0);
    const titles = scene.items.filter(
      (i) => i.type === 'text' && i.role === 'title',
    );
    expect(titles.map((t) => t.type === 'text' && t.text)).toEqual([
      'a',
      'output',
    ]);
    expect(titles[1]!.type === 'text' && titles[1]!.y).toBeGreaterThan(
      boxes(scene)[0]!.y + boxes(scene)[0]!.height,
    );
    expect(scene.title).toBe('Two arrays');
  });
});

describe('bare layout', () => {
  it('draws only cells and pointers, starting right below the padding', () => {
    const trace = mustLoad(
      doc(
        [4, 2],
        [
          {
            actions: [{ target: 'arr', type: 'pointer', name: 'i', index: 1 }],
          },
        ],
      ),
    );
    const scene = layoutTrace(trace, bareLayoutOptions).sceneAt(1);
    expect(scene.items.some((i) => i.type === 'text')).toBe(false);
    expect(boxes(scene).map((b) => b.y)).toEqual([8, 8]);
    expect(scene.items.filter((i) => i.type === 'badge')).toHaveLength(1);
    // padding + cells + pointer area (20 + one badge row of 24) + padding
    expect(scene.height).toBe(8 + 52 + 44 + 8);
  });
});

describe('scene bounds', () => {
  it('keeps wide pointer badges and long titles inside the scene', () => {
    const trace = mustLoad({
      version: '0.1',
      structures: {
        arr: {
          kind: 'array',
          label: 'a rather long title for a two-cell array',
          initial: [1, 2],
        },
      },
      steps: [
        {
          actions: [
            {
              target: 'arr',
              type: 'pointer',
              name: 'very_long_name16',
              index: 0,
            },
            {
              target: 'arr',
              type: 'pointer',
              name: 'other_long_name',
              index: 2,
            },
          ],
        },
      ],
    });
    const layout = layoutTrace(trace);
    for (const index of [0, 1]) {
      const scene = layout.sceneAt(index);
      for (const item of scene.items) {
        const [left, right] =
          item.type === 'badge'
            ? [item.x - item.width / 2, item.x + item.width / 2]
            : item.type === 'box'
              ? [item.x, item.x + item.width]
              : item.type === 'text' && item.role === 'title'
                ? [item.x, item.x + item.text.length * item.fontSize * 0.6]
                : [0, 0];
        expect(left, item.key).toBeGreaterThanOrEqual(0);
        expect(right, item.key).toBeLessThanOrEqual(scene.width);
      }
    }
  });
});
