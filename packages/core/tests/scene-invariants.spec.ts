/**
 * Properties every layout must have, checked on every frame of every valid
 * conformance fixture (all kinds): unique keys, finite coordinates, items
 * inside the scene, text that fits its cell, node or badge, and a scene
 * size that never changes during a trace.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { bareLayoutOptions, layoutTrace, loadTrace } from '../src/index.ts';
import { fitProblems, sceneProblems } from './scene-check.ts';

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
      expect(sceneProblems(scene), `${name} frame ${i}`).toEqual([]);
      expect(fitProblems(scene), `${name} frame ${i}`).toEqual([]);
    }
  });
});
