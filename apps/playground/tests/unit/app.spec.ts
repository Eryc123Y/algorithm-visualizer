import { describe, expect, it } from 'vitest';

import { loadTrace } from '@algoviz/core';

import { bubbleSort } from '@/samples/bubble-sort';
import { bubbleSortDocument } from '@/samples/bubble-sort-doc';

describe('bubbleSort sample', () => {
  it('records a valid trace that ends sorted', () => {
    const result = loadTrace(bubbleSort([5, 3, 8, 1, 4]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const last = result.value.frame(result.value.length).state['arr'];
    if (last?.kind !== 'array') throw new Error('expected an array');
    expect(last?.state.data.map((e) => e.value)).toEqual([1, 3, 4, 5, 8]);
    expect(last?.state.marks.settled).toHaveLength(5);
  });

  it('maps every step line onto the attached source code', () => {
    const doc = bubbleSortDocument([3, 1, 2]);
    expect(loadTrace(doc).ok).toBe(true);
    const lines = new Set(doc.steps.map((s) => s.meta?.line));
    expect([...lines].sort()).toEqual([5, 6, 7, undefined].sort());
  });
});
