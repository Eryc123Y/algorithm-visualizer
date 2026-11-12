/**
 * Records a full bubble sort as a visualization document.
 */
import type { VisualizationInput } from '@algoviz/spec';

type Step = VisualizationInput['steps'][number];

export function bubbleSort(values: readonly number[]): VisualizationInput {
  const a = values.slice();
  const n = a.length;
  const steps: Step[] = [];
  const at = (k: number) => a[k] ?? 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      steps.push({
        actions: [
          { target: 'arr', type: 'pointer', name: 'j', index: j },
          { target: 'arr', type: 'compare', i: j, j: j + 1 },
        ],
        meta: { line: 3, narration: `Compare ${at(j)} and ${at(j + 1)}.` },
      });
      if (at(j) > at(j + 1)) {
        steps.push({
          actions: [{ target: 'arr', type: 'swap', i: j, j: j + 1 }],
          meta: {
            line: 4,
            narration: `${at(j)} > ${at(j + 1)}, so swap them.`,
          },
        });
        [a[j], a[j + 1]] = [at(j + 1), at(j)];
      }
    }
    steps.push({
      actions: [
        { target: 'arr', type: 'pointer', name: 'j', index: null },
        { target: 'arr', type: 'settle', index: n - 1 - i },
      ],
      meta: {
        line: 7,
        narration: `${at(n - 1 - i)} is in its final position.`,
      },
    });
  }
  if (n > 0) {
    steps.push({
      actions: [{ target: 'arr', type: 'settle', index: 0 }],
      meta: { narration: 'Sorted.' },
    });
  }

  return {
    version: '1.0',
    title: 'Bubble sort',
    structures: { arr: { kind: 'array', label: 'a', initial: [...values] } },
    steps,
  };
}
