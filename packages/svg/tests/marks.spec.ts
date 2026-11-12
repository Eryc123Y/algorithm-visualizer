/**
 * Check marks (ADR 0009, 0031): inside the node, clear of its value, and
 * kept when a settled element is drawn in a stronger, transient role.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ElementRole, Scene, SceneNode } from '@algomotion/core';

import { paintScene, themeNames, themes, type SvgNode } from '../src/index.ts';
import { inkDepth } from './glyph-depth.ts';

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

/** The points of a mark's path, which is a move and two lines. */
function points(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [, c, args] of d.matchAll(/([MLml])([^MLml]*)/g)) {
    const [x, y] = (args!.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const from = c === 'l' || c === 'm' ? out.at(-1)! : { x: 0, y: 0 };
    out.push({ x: from.x + x!, y: from.y + y! });
  }
  return out;
}

/** Characters of values: digits, letters with and without descenders, punctuation. */
const VALUE_CHARS = [...'0123456789abcdfgjpqxyzAJQ()[],;_|@$-'];

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
        fc
          .array(fc.constantFrom(...VALUE_CHARS), {
            minLength: 1,
            maxLength: 3,
          })
          .map((chars) => chars.join('')),
        (radius, fontSize, stretch, name, role, text) => {
          const theme = themes[name];
          const width = stretch === undefined ? undefined : stretch * radius;
          const halfWidth = Math.max(radius, (width ?? 0) / 2);
          const node = painted(
            {
              radius,
              fontSize,
              role,
              text,
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
            // Under the value's ink: its baseline, and any descender.
            const depth = inkDepth(text, theme.fontMetrics.value.id);
            expect(p.y - cap).toBeGreaterThanOrEqual(
              (0.35 + depth) * fontSize + 1 - 1e-6,
            );
          }
          // Big enough to read as a check, even under a descender.
          const ys = points(path!.attrs['d']!).map((p) => p.y);
          expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(
            0.1 * radius,
          );
          // In the same place whatever role the node takes.
          const settled = painted(
            {
              radius,
              fontSize,
              role: 'settled',
              text,
              ...(width === undefined ? {} : { width }),
            },
            theme,
          );
          expect(mark(settled)?.attrs['d']).toBe(path!.attrs['d']);
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
