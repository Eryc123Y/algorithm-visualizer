import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace } from '../src/index.ts';

const root = new URL('../../../conformance/layout/', import.meta.url);

const fixtures = readdirSync(root)
  .filter((f) => f.endsWith('.json'))
  .map(
    (f) =>
      [
        f,
        JSON.parse(readFileSync(new URL(f, root), 'utf8')) as Record<
          string,
          unknown
        >,
      ] as const,
  );

describe('conformance: layout', () => {
  it.each(fixtures)('%s', (_, fixture) => {
    const result = loadTrace(fixture['input']);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const layout = layoutTrace(result.value);
    for (const { index, scene } of fixture['frames'] as {
      index: number;
      scene: unknown;
    }[])
      expect(layout.sceneAt(index), `frame ${index}`).toEqual(scene);
  });
});
