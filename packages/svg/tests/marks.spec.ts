/**
 * Check marks (ADR 0009, 0031): inside the node, clear of its value, and
 * kept when a settled element is drawn in a stronger, transient role.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ElementRole, Scene, SceneNode } from '@algoviz/core';

import { paintScene, themeNames, themes, type SvgNode } from '../src/index.ts';

/** fast-check settings, deepened with FUZZ_RUNS and replayed with FUZZ_SEED. */
const params = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 100),
  ...(process.env['FUZZ_SEED'] === undefined
    ? {}
    : { seed: Number(process.env['FUZZ_SEED']) }),
};

const sceneOf = (node: Partial<SceneNode>): Scene => ({
  width: 200,
  height: 200,
  title: 't',
  items: [
    {
      type: 'node',
      key: 'g/element/A',
      x: 100,
      y: 100,
      radius: 20,
      role: 'settled',
      text: 'A',
      fontSize: 20,
      ...node,
    },
  ],
});

/** The check mark of a painted node: its path, if it has one. */
function mark(node: SvgNode): SvgNode | undefined {
  return node.children?.find(
    (c) => c.tag === 'path' && c.attrs['fill'] === 'none',
  );
}

/** The absolute points of a mark's path: `M x y l dx dy l dx dy`. */
function points(d: string): { x: number; y: number }[] {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out = [{ x: n[0]!, y: n[1]! }];
  for (let k = 2; k + 1 < n.length; k += 2)
    out.push({ x: out.at(-1)!.x + n[k]!, y: out.at(-1)!.y + n[k + 1]! });
  return out;
}

const painted = (node: Partial<SceneNode>, theme = themes.light) =>
  paintScene(sceneOf(node), theme).items[0]!.node;

describe('check marks on nodes', () => {
  it('lie inside the outline, less its border, and under the value', () => {
    fc.assert(
      fc.property(
        // Layout's node radii and value sizes (nodeShape in core).
        fc.integer({ min: 20, max: 26 }),
        fc.integer({ min: 13, max: 20 }),
        fc.option(fc.double({ min: 2, max: 6, noNaN: true }), {
          nil: undefined,
        }),
        fc.constantFrom(...themeNames),
        fc.constantFrom<ElementRole>('settled', 'compare', 'swap', 'highlight'),
        (radius, fontSize, stretch, name, role) => {
          const theme = themes[name];
          const width = stretch === undefined ? undefined : stretch * radius;
          const halfWidth = Math.max(radius, (width ?? 0) / 2);
          const node = painted(
            {
              radius,
              fontSize,
              role,
              ...(role === 'settled' ? {} : { settled: true as const }),
              ...(width === undefined ? {} : { width }),
            },
            theme,
          );
          const path = mark(node);
          expect(path).toBeDefined();
          const cap = Number(path!.attrs['stroke-width']) / 2;
          const inner = radius - theme.cell[role].strokeWidth - cap;
          for (const p of points(path!.attrs['d']!)) {
            // Distance to the stadium's spine, a segment of the x axis.
            const sx = Math.max(
              -(halfWidth - radius),
              Math.min(halfWidth - radius, p.x),
            );
            expect(Math.hypot(p.x - sx, p.y)).toBeLessThanOrEqual(inner + 1e-9);
            // Under the value's baseline, whatever the face.
            expect(p.y - cap).toBeGreaterThanOrEqual(
              0.35 * fontSize + 1 - 1e-9,
            );
          }
        },
      ),
      params,
    );
  });

  it('stays on a settled node that a transient mark draws, in its text colour', () => {
    const theme = themes.light;
    const highlighted = painted({ role: 'highlight', settled: true });
    expect(mark(highlighted)?.attrs['stroke']).toBe(theme.cell.highlight.text);
    expect(mark(painted({ role: 'settled' }))?.attrs['stroke']).toBe(
      theme.settledMark,
    );
    expect(mark(painted({ role: 'highlight' }))).toBeUndefined();
  });

  it('stays on a settled cell that a transient mark draws', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      title: 't',
      items: [
        {
          type: 'box',
          key: 'a/element/e0',
          x: 0,
          y: 0,
          width: 52,
          height: 52,
          role: 'compare',
          settled: true,
          text: '1',
          fontSize: 20,
        },
      ],
    };
    const node = paintScene(scene, 'light').items[0]!.node;
    expect(mark(node)?.attrs['stroke']).toBe(themes.light.cell.compare.text);
  });
});

describe('edge labels', () => {
  it('are painted after every edge of their structure, before the rest', () => {
    const edge = (key: string, y: number, label?: string) => ({
      type: 'edge' as const,
      key,
      x1: 0,
      y1: y,
      x2: 100,
      y2: 100 - y,
      role: 'default' as const,
      directed: true,
      fontSize: 12,
      ...(label === undefined ? {} : { label }),
    });
    const scene: Scene = {
      width: 200,
      height: 200,
      title: 't',
      items: [
        edge('g/edge/a', 0, '15'),
        edge('g/edge/b', 100),
        {
          type: 'node',
          key: 'g/element/A',
          x: 50,
          y: 50,
          radius: 20,
          role: 'default',
          text: 'A',
          fontSize: 20,
        },
        edge('h/edge/c', 0, '2'),
      ],
    };
    const keys = paintScene(scene, 'light').items.map((i) => i.key);
    expect(keys).toEqual([
      'g/edge/a',
      'g/edge/a#head',
      'g/edge/b',
      'g/edge/b#head',
      'g/edge/a#label',
      'g/element/A',
      'h/edge/c',
      'h/edge/c#head',
      'h/edge/c#label',
    ]);
  });
});
