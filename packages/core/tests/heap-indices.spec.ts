/**
 * Heap indices (ADR 0031): above their nodes, and inside the heap's block
 * whichever way they turn, whatever the heap's size and value widths.
 */
import { describe, expect, it } from 'vitest';

import { textWidth } from '@algoviz/fonts';

import {
  defaultLayoutOptions as o,
  layoutTrace,
  loadTrace,
  type SceneText,
} from '../src/index.ts';

function heapScene(initial: number[], pointers: boolean) {
  const loaded = loadTrace({
    version: '0.4',
    structures: { h: { kind: 'array', view: 'heap', initial } },
    steps: [
      {
        actions: pointers
          ? [{ target: 'h', type: 'pointer', name: 'largest', index: 0 }]
          : [],
      },
    ],
  });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return layoutTrace(loaded.value).sceneAt(1);
}

describe('heap indices', () => {
  for (const size of [1, 2, 3, 5, 8, 12, 16, 23, 31, 40, 63])
    for (const digits of [1, 3, 6])
      for (const pointers of [false, true])
        it(`stay inside the block: ${size} values of ${digits} digits${pointers ? ', with a pointer' : ''}`, () => {
          const scene = heapScene(
            Array.from({ length: size }, (_, i) => 10 ** (digits - 1) + i),
            pointers,
          );
          const indices = scene.items.filter(
            (i): i is SceneText =>
              i.type === 'text' &&
              i.role === 'index' &&
              i.key.startsWith('h/index/'),
          );
          expect(indices).toHaveLength(size);
          for (const index of indices) {
            const half =
              (textWidth(index.text, o.fonts.value) * index.fontSize) / 2;
            expect(index.x - half).toBeGreaterThanOrEqual(o.padding - 1e-9);
            expect(index.x + half).toBeLessThanOrEqual(
              scene.width - o.padding + 1e-9,
            );
          }
        });
});
