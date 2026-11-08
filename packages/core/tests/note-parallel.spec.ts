/**
 * Notes clear of parallel edges (ADR 0031, Codex on #57): directions are
 * chosen against the lines as drawn, spread apart, not their centre line.
 */
import { describe, expect, it } from 'vitest';

import { textWidth } from '@algoviz/fonts';

import {
  clearance,
  defaultFonts,
  layoutTrace,
  loadTrace,
  noteBox,
  type SceneEdge,
  type SceneNode,
} from '../src/index.ts';

describe('a note beside parallel edges', () => {
  it('clears every drawn edge when a direction does', () => {
    const loaded = loadTrace({
      version: '0.1',
      structures: {
        g: {
          kind: 'graph',
          directed: true,
          nodes: [
            { id: 'A', x: 0, y: 120 },
            { id: 'B', x: 0, y: 0 },
          ],
          edges: Array.from({ length: 5 }, (_, k) => ({
            id: `e${k}`,
            from: 'A',
            to: 'B',
          })),
        },
      },
      steps: [
        {
          actions: [{ target: 'g', type: 'annotate', node: 'A', text: 'xxx' }],
        },
      ],
    });
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const scene = layoutTrace(loaded.value).sceneAt(1);
    const a = scene.items.find(
      (i): i is SceneNode => i.type === 'node' && i.key === 'g/element/A',
    )!;
    const size = Math.max(10, a.fontSize * 0.7);
    const box = noteBox(
      { x: a.x, y: a.y, radius: a.radius, halfWidth: a.radius },
      a.labelAngle ?? 0,
      (textWidth('xxx', defaultFonts.value) * size) / 2,
      size,
    );
    const lines = scene.items
      .filter((i): i is SceneEdge => i.type === 'edge')
      .map(
        (e) =>
          [
            { x: e.x1, y: e.y1 },
            { x: e.x2, y: e.y2 },
          ] as const,
      );
    expect(lines).toHaveLength(5);
    expect(
      clearance(box, { segments: lines, discs: [], boxes: [] }),
    ).toBeGreaterThan(0);
  });
});
