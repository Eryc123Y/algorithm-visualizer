/**
 * Records an in-place array reversal with two pointers.
 */
import type { VisualizationInput } from '@algomotion/spec';

type Step = VisualizationInput['steps'][number];

export function reverse(
  values: readonly (number | string)[],
): VisualizationInput {
  const steps: Step[] = [];
  let lo = 0;
  let hi = values.length - 1;
  const pointers = (): Step['actions'] => [
    { target: 'arr', type: 'pointer', name: 'lo', index: lo },
    { target: 'arr', type: 'pointer', name: 'hi', index: hi },
  ];
  while (lo < hi) {
    steps.push({
      actions: [...pointers(), { target: 'arr', type: 'swap', i: lo, j: hi }],
    });
    steps.push({
      actions: [
        { target: 'arr', type: 'settle', index: lo },
        { target: 'arr', type: 'settle', index: hi },
      ],
    });
    lo += 1;
    hi -= 1;
  }
  if (lo === hi)
    steps.push({ actions: [{ target: 'arr', type: 'settle', index: lo }] });
  steps.push({
    actions: [
      { target: 'arr', type: 'pointer', name: 'lo', index: null },
      { target: 'arr', type: 'pointer', name: 'hi', index: null },
    ],
  });
  return {
    version: '1.0',
    title: 'Reverse an array',
    structures: { arr: { kind: 'array', initial: [...values] } },
    steps,
  };
}
