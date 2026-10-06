/**
 * Properties every layout must have, checked on every frame of every valid
 * conformance fixture (all kinds): unique keys, finite coordinates, items
 * inside the scene, and a scene size that never changes during a trace.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  bareLayoutOptions,
  layoutTrace,
  loadTrace,
  type Scene,
  type SceneItem,
} from '../src/index.ts';

const root = new URL('../../../conformance/', import.meta.url);

const fixtures = ['core/valid', 'spec/valid'].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, root))
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        [
          `${dir}/${f}`,
          JSON.parse(readFileSync(new URL(`${dir}/${f}`, root), 'utf8')) as {
            input: unknown;
          },
        ] as const,
    ),
);

/** Horizontal and vertical extent of an item, including annotations. */
function extent(item: SceneItem): [number, number, number, number] {
  switch (item.type) {
    case 'box':
      return [item.x, item.y, item.x + item.width, item.y + item.height];
    case 'node': {
      const half = Math.max(item.radius, (item.width ?? 0) / 2);
      if (item.label === undefined)
        return [
          item.x - half,
          item.y - item.radius,
          item.x + half,
          item.y + item.radius,
        ];
      // Painters draw labels at 70% of the value size, at least 10 units:
      // centred above, or turned and then reaching out by their width.
      const font = Math.max(10, item.fontSize * 0.7);
      const width = [...item.label].length * font * 0.6;
      const turned = (item.labelAngle ?? 0) !== 0;
      const dx = turned ? half + width + 4 : Math.max(half, width / 2);
      const below = turned ? item.radius + font + 4 : item.radius;
      return [
        item.x - dx,
        item.y - item.radius - font - 4,
        item.x + dx,
        item.y + below,
      ];
    }
    case 'badge':
      return [
        item.x - item.width / 2,
        item.y - item.height / 2,
        item.x + item.width / 2,
        item.y + item.height / 2,
      ];
    case 'edge': {
      const loop =
        item.via === undefined && item.x1 === item.x2 && item.y1 === item.y2
          ? 34
          : 0;
      const xs = [item.x1, item.x2, ...(item.via ?? []).map((p) => p.x)];
      const ys = [item.y1, item.y2, ...(item.via ?? []).map((p) => p.y)];
      return [
        Math.min(...xs) - loop,
        Math.min(...ys) - loop,
        Math.max(...xs) + loop,
        Math.max(...ys) + loop,
      ];
    }
    case 'arrow':
      return [
        Math.min(item.x1, item.x2),
        Math.min(item.y1, item.y2),
        Math.max(item.x1, item.x2),
        Math.max(item.y1, item.y2),
      ];
    case 'text':
      return [item.x, item.y, item.x, item.y];
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}

function checkScene(scene: Scene, where: string) {
  const keys = new Set<string>();
  for (const item of scene.items) {
    expect(keys.has(item.key), `${where}: duplicate key ${item.key}`).toBe(
      false,
    );
    keys.add(item.key);
    const [x1, y1, x2, y2] = extent(item);
    for (const v of [x1, y1, x2, y2])
      expect(Number.isFinite(v), `${where}: ${item.key}`).toBe(true);
    expect(x1, `${where}: ${item.key} left`).toBeGreaterThanOrEqual(-0.5);
    expect(y1, `${where}: ${item.key} top`).toBeGreaterThanOrEqual(-0.5);
    expect(x2, `${where}: ${item.key} right`).toBeLessThanOrEqual(
      scene.width + 0.5,
    );
    expect(y2, `${where}: ${item.key} bottom`).toBeLessThanOrEqual(
      scene.height + 0.5,
    );
  }
}

describe.each([
  ['default options', {}],
  ['bare options', bareLayoutOptions],
])('scene invariants (%s)', (_, options) => {
  it.each(fixtures)('%s', (name, fixture) => {
    const result = loadTrace(fixture.input);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const layout = layoutTrace(result.value, options);
    const first = layout.sceneAt(0);
    for (let i = 0; i <= result.value.length; i++) {
      const scene = layout.sceneAt(i);
      expect([scene.width, scene.height], `${name} frame ${i} size`).toEqual([
        first.width,
        first.height,
      ]);
      checkScene(scene, `${name} frame ${i}`);
    }
  });
});
