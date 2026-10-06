/**
 * The bubble sort sample with source code, line numbers and variables.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { bubbleSort } from './bubble-sort';

const SOURCE = `def bubble_sort(a):
    n = len(a)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
        # a[n - 1 - i] is now in its final position`;

/** Maps the recorder's line numbers onto SOURCE. */
const LINES: Record<number, number> = { 3: 5, 4: 6, 7: 7 };

export function bubbleSortDocument(
  values: readonly number[],
): VisualizationInput {
  const doc = bubbleSort(values);
  return {
    ...doc,
    source: { language: 'python', code: SOURCE },
    steps: doc.steps.map((step) => {
      const line = step.meta?.line;
      const pointer = step.actions.find((a) => a.type === 'pointer');
      const j = pointer?.type === 'pointer' ? pointer.index : undefined;
      return {
        ...step,
        meta: {
          ...step.meta,
          ...(line === undefined ? {} : { line: LINES[line] ?? line }),
          ...(j === undefined || j === null ? {} : { vars: { j } }),
        },
      };
    }),
  };
}
