import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { loadTrace, type Trace } from '../src/index.ts';

/** Records a bubble sort of `values` as a visualization document. */
function bubbleSort(values: number[]): VisualizationInput {
  const a = values.slice();
  const steps: VisualizationInput['steps'] = [];
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      steps.push({
        actions: [{ target: 'arr', type: 'compare', i: j, j: j + 1 }],
      });
      if (a[j]! > a[j + 1]!) {
        steps.push({
          actions: [{ target: 'arr', type: 'swap', i: j, j: j + 1 }],
        });
        [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
      }
    }
    steps.push({
      actions: [{ target: 'arr', type: 'settle', index: n - 1 - i }],
    });
  }
  return {
    version: '1.0',
    structures: { arr: { kind: 'array', initial: values } },
    steps,
  };
}

function mustLoad(input: unknown, checkpointInterval?: number): Trace {
  const result = loadTrace(
    input,
    checkpointInterval === undefined ? {} : { checkpointInterval },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function arrayValues(trace: Trace, index: number): unknown[] {
  const entry = trace.frame(index).state['arr'];
  if (entry?.kind !== 'array') throw new Error('expected an array');
  return entry.state.data.map((e) => e.value);
}

describe('compileTrace', () => {
  it('ends with the sorted array when replaying a recorded bubble sort', () => {
    const values = [9, 4, 7, 1, 8, 2, 2, 6, 0, 5];
    const trace = mustLoad(bubbleSort(values));
    expect(arrayValues(trace, trace.length)).toEqual(
      values.toSorted((x, y) => x - y),
    );
    expect(arrayValues(trace, 0)).toEqual(values);
  });

  it('serves identical frames regardless of checkpoint interval or access order', () => {
    const input = bubbleSort([5, 1, 4, 2, 8, 0, 3]);
    const reference = mustLoad(input, 1);
    for (const interval of [2, 7, 32, 1000]) {
      const trace = mustLoad(input, interval);
      const order = [...Array(trace.length + 1).keys()].reverse();
      for (const i of order)
        expect(trace.frame(i).state).toEqual(reference.frame(i).state);
    }
  });

  it('pairs each frame with the step that produced it', () => {
    const trace = mustLoad(bubbleSort([2, 1]));
    expect(trace.frame(0).step).toBeUndefined();
    expect(trace.frame(1).step?.actions[0]?.type).toBe('compare');
    expect(trace.frame(2).step?.actions[0]?.type).toBe('swap');
  });

  it('never mutates earlier frames', () => {
    const trace = mustLoad(bubbleSort([3, 2, 1]));
    const first = trace.frame(0).state;
    const snapshot = structuredClone(first);
    trace.frame(trace.length);
    expect(trace.frame(0).state).toEqual(snapshot);
  });

  it('rejects frame indices outside the timeline', () => {
    const trace = mustLoad(bubbleSort([2, 1]));
    expect(() => trace.frame(-1)).toThrow(RangeError);
    expect(() => trace.frame(trace.length + 1)).toThrow(RangeError);
    expect(() => trace.frame(0.5)).toThrow(RangeError);
  });

  it('explains out-of-range errors in terms of the current state', () => {
    const result = loadTrace({
      version: '1.0',
      structures: { arr: { kind: 'array', initial: [1, 2, 3] } },
      steps: [{ actions: [{ target: 'arr', type: 'swap', i: 0, j: 3 }] }],
    });
    expect(result).toEqual({
      ok: false,
      error: [
        {
          code: 'OUT_OF_RANGE',
          path: '$.steps[0].actions[0].j',
          message: 'j=3 is out of range for an array of length 3',
          hint: 'Valid values are 0 to 2.',
        },
      ],
    });
  });
});
