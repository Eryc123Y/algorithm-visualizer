import { afterEach, describe, expect, it, vi } from 'vitest';

import { layoutTrace, loadTrace } from '@algoviz/core';
import { createTheme, paintScene } from '@algoviz/svg';

import { SceneStage } from '../src/stage.ts';

const result = loadTrace({
  version: '0.1',
  structures: { arr: { kind: 'array', initial: [2, 1] } },
  steps: [
    { actions: [{ target: 'arr', type: 'pointer', name: 'i', index: 0 }] },
    { actions: [{ target: 'arr', type: 'swap', i: 0, j: 1 }] },
    { actions: [{ target: 'arr', type: 'pointer', name: 'i', index: null }] },
  ],
});
if (!result.ok) throw new Error('fixture');
const layout = layoutTrace(result.value);
const painted = (i: number) => paintScene(layout.sceneAt(i));

function mount() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(svg);
  return { svg, stage: new SceneStage(svg) };
}

const el = (svg: SVGSVGElement, key: string) =>
  svg.querySelector<SVGGElement>(`[data-key="${key}"]`);

describe('SceneStage', () => {
  it('draws every item of a scene with its position as a transform', () => {
    const { svg, stage } = mount();
    stage.render(painted(0), { duration: 0 });
    const cell = el(svg, 'arr/element/e0');
    expect(cell?.style.transform).toBe('translate(20px, 64px)');
    expect(cell?.getAttribute('data-role')).toBe('default');
    expect(svg.getAttribute('viewBox')).toBe(
      `0 0 ${painted(0).width} ${painted(0).height}`,
    );
  });

  it('reuses elements by key, so a swap moves the same element', () => {
    const { svg, stage } = mount();
    stage.render(painted(1), { duration: 0 });
    const first = el(svg, 'arr/element/e0');
    stage.render(painted(2), { duration: 0 });
    expect(el(svg, 'arr/element/e0')).toBe(first);
    expect(first?.style.transform).toBe('translate(80px, 64px)');
    expect(first?.getAttribute('data-role')).toBe('swap');
  });

  it('paints the theme background like renderSvg does', () => {
    const { svg, stage } = mount();
    const scene = layout.sceneAt(0);
    stage.render(
      paintScene(scene, createTheme('light', { background: '#fafafa' })),
      {
        duration: 0,
      },
    );
    const rect = svg.querySelector(':scope > rect');
    expect(rect?.getAttribute('fill')).toBe('#fafafa');
    expect(rect?.getAttribute('width')).toBe(String(scene.width));
    stage.render(paintScene(scene), { duration: 0 });
    expect(rect?.getAttribute('display')).toBe('none');
  });

  it('adds and removes items as they appear and disappear', () => {
    const { svg, stage } = mount();
    stage.render(painted(0), { duration: 0 });
    expect(el(svg, 'arr/pointer/i')).toBeNull();
    stage.render(painted(1), { duration: 0 });
    expect(el(svg, 'arr/pointer/i')).not.toBeNull();
    stage.render(painted(3), { duration: 0 });
    expect(el(svg, 'arr/pointer/i')).toBeNull();
    expect(stage.keys).not.toContain('arr/pointer/i');
  });
});

describe('SceneStage motion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Records the transform keyframes of every animation the stage starts. */
  function recordMoves() {
    const moves: string[][] = [];
    const proto = Element.prototype as unknown as { animate?: unknown };
    proto.animate = function (keyframes: Keyframe[]) {
      if (keyframes.some((k) => 'transform' in k))
        moves.push(keyframes.map((k) => String(k['transform'])));
      return { cancel() {}, onfinish: null } as unknown as Animation;
    };
    return { moves, restore: () => delete proto.animate };
  }

  it('lifts swapped cells along arcs by default', () => {
    const { moves, restore } = recordMoves();
    const { stage } = mount();
    stage.render(painted(1), { duration: 300 });
    stage.render(painted(2), { duration: 300 });
    restore();
    const cells = moves.filter((m) => m.length === 3);
    expect(cells).toHaveLength(2);
    // The cell moving right rises, the one moving left dips.
    expect(cells.map((m) => m[1])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('px, 43'),
        expect.stringContaining('px, 85'),
      ]),
    );
  });

  it('moves in straight lines with linear motion', () => {
    const { moves, restore } = recordMoves();
    const { stage } = mount();
    stage.render(painted(1), { duration: 300, motion: 'linear' });
    stage.render(painted(2), { duration: 300, motion: 'linear' });
    restore();
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.length === 2)).toBe(true);
  });
});
