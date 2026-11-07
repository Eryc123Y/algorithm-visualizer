import { describe, expect, it } from 'vitest';

import { loadTrace } from '@algoviz/core';

import { bubbleSort } from '@/samples/bubble-sort';
import { bubbleSortDocument } from '@/samples/bubble-sort-doc';
import { algorithms, TOPICS } from '@algoviz/recipes';

import { exampleGroups, examples } from '@/samples/examples';

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

describe('examples', () => {
  it('has one entry per registry module, with unique labels', () => {
    const labels = examples.map((e) => e.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const { title } of algorithms) expect(labels).toContain(title);
  });

  it('is grouped by topic, in menu order', () => {
    const order = examples.map((e) => TOPICS.indexOf(e.topic));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(exampleGroups.map((g) => g.topic)).toEqual([
      ...new Set(examples.map((e) => e.topic)),
    ]);
    expect(exampleGroups[0]).toEqual({ topic: 'sorting', title: 'Sorting' });
  });

  it.each(examples.map((e) => [e.label, e]))('%s loads', (_, example) => {
    const result = loadTrace(example.build());
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  });
});
