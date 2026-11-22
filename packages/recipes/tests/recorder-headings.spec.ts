/**
 * A structure's heading (ADR 0045): the name a figure draws where it would
 * draw the structure's id, in the document's language. A figure draws a
 * lone structure without a label under no heading at all, so a heading
 * becomes the label only beside other structures.
 */
import { describe, expect, it } from 'vitest';

import { Recorder } from '../src/index.ts';

const documentOf = (
  add: (r: Recorder) => void,
): { structures: Record<string, { label?: string }> } => {
  const r = new Recorder();
  add(r);
  r.step('Look.');
  return r.build() as { structures: Record<string, { label?: string }> };
};

describe('a structure’s heading', () => {
  it('is its label beside other structures', () => {
    const doc = documentOf((r) => {
      r.add('out', { kind: 'array', initial: [] }, { heading: '输出' });
      r.add('Q', { kind: 'array', initial: [] });
    });
    expect(doc.structures['out']!.label).toBe('输出');
    expect(doc.structures['Q']!.label).toBeUndefined();
  });

  it('is nothing for a lone structure, whose figure draws no heading', () => {
    const doc = documentOf((r) =>
      r.add('list', { kind: 'array', initial: [1] }, { heading: '链表' }),
    );
    expect(doc.structures['list']!.label).toBeUndefined();
  });

  it('gives way to a label, and adds nothing when it is the name', () => {
    const doc = documentOf((r) => {
      r.add(
        'a',
        { kind: 'array', label: 'A, sorted', initial: [] },
        { heading: '甲' },
      );
      r.add('dist', { kind: 'array', initial: [] }, { heading: 'dist' });
    });
    expect(doc.structures['a']!.label).toBe('A, sorted');
    expect(doc.structures['dist']).not.toHaveProperty('label');
  });
});
