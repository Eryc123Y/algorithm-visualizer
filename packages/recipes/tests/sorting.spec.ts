import { describe, expect, it } from 'vitest';

import {
  binarySearch,
  bubbleSort,
  countingSort,
  heapSort,
  insertionSort,
  mergeSort,
  quickSort,
  selectionSort,
} from '../src/index.ts';
import { randomInts, replay, stateOf } from './helpers.ts';

const inputs = [
  [],
  [1],
  [2, 1],
  [5, 3, 8, 1, 9, 2],
  [3, 3, 1, 3, 2],
  [1, 2, 3, 4, 5],
  [5, 4, 3, 2, 1],
  ...[1, 2, 3, 4, 5].map((seed) => randomInts(seed, 9, 20)),
];

const sorts = {
  bubbleSort,
  insertionSort,
  selectionSort,
  mergeSort,
  quickSort,
  heapSort,
  countingSort,
};

describe.each(Object.entries(sorts))('%s', (_, sort) => {
  it.each(inputs.map((input) => [JSON.stringify(input), input]))(
    'sorts %s and settles every element',
    (_, input) => {
      const trace = replay(sort(input));
      const state = stateOf(trace, 'a', 'array');
      expect(state.data.map((e) => e.value)).toEqual(
        [...input].sort((x, y) => x - y),
      );
      expect(state.marks.settled).toHaveLength(input.length);
      // Every step points at a line of the source, or none.
      const lines = trace.visualization.source?.code.split('\n').length ?? 0;
      for (const step of trace.visualization.steps)
        if (step.meta?.line !== undefined)
          expect(step.meta.line).toBeLessThanOrEqual(lines);
    },
  );
});

describe('binarySearch', () => {
  const sorted = [1, 3, 4, 7, 9, 11, 15];
  it.each([...sorted, 0, 5, 16].map((t) => [t]))('looks for %i', (target) => {
    const trace = replay(binarySearch(sorted, target));
    const settled = stateOf(trace, 'a', 'array').marks.settled;
    const found = sorted.indexOf(target);
    expect(settled).toEqual(found < 0 ? [] : [`e${found}`]);
    expect(trace.length).toBeLessThanOrEqual(
      2 + 3 * Math.ceil(Math.log2(sorted.length + 1)),
    );
  });
});
