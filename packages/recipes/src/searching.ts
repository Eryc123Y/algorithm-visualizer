/**
 * Searching algorithms.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { checkFinite } from './check.ts';
import { Recorder } from './recorder.ts';
import { python } from './source.ts';

/** Binary search for `target` in sorted `values`. */
export function binarySearch(
  values: readonly number[],
  target: number,
): VisualizationInput {
  checkFinite('The values and the target', [...values, target]);
  const r = new Recorder({
    title: `Binary search for ${target}`,
    source: python(`
      def binary_search(a, target):
          lo, hi = 0, len(a) - 1
          while lo <= hi:
              mid = (lo + hi) // 2
              if a[mid] == target: return mid
              if a[mid] < target: lo = mid + 1
              else: hi = mid - 1
          return -1
    `),
  });
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  let lo = 0;
  let hi = values.length - 1;
  r.step({
    line: 2,
    narration: `Search the whole array for ${target}.`,
    vars: { lo, hi },
  });
  arr.pointer({ name: 'lo', index: lo });
  arr.pointer({ name: 'hi', index: hi >= 0 ? hi : null });
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = values[mid]!;
    r.step({
      line: 5,
      narration: `Look in the middle: a[${mid}] = ${v}.`,
      vars: { lo, hi, mid },
    });
    arr.pointer({ name: 'mid', index: mid }).highlight({ indices: [mid] });
    if (v === target) {
      r.step({ line: 5, narration: `Found ${target} at position ${mid}.` });
      arr.settle({ index: mid });
      return r.build();
    }
    if (v < target) {
      lo = mid + 1;
      r.step({
        line: 6,
        narration: `${v} < ${target}: search right of ${mid}.`,
        vars: { lo, hi },
      });
      arr.pointer({ name: 'lo', index: lo });
    } else {
      hi = mid - 1;
      r.step({
        line: 7,
        narration: `${v} > ${target}: search left of ${mid}.`,
        vars: { lo, hi },
      });
      arr.pointer({ name: 'hi', index: hi >= 0 ? hi : null });
    }
    arr.pointer({ name: 'mid', index: null });
  }
  r.step({ line: 8, narration: `lo > hi: ${target} is not in the array.` });
  return r.build();
}
