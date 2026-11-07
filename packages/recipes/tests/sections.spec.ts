import { selectFrames } from '@algoviz/core';
import { SectionId } from '@algoviz/spec';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sectionIds } from '../src/section-id.ts';
import { fuzz, runOk } from './helpers.ts';

describe('sectionIds', () => {
  it('turns titles into kebab-case ids', () => {
    expect(
      sectionIds(['insert 5', 'decrease key at 3 to 10', 'pop', 'push 2.5']),
    ).toEqual(['insert-5', 'decrease-key-at-3-to-10', 'pop', 'push-2-5']);
  });

  it('numbers repeats from 2', () => {
    expect(sectionIds(['insert 5', 'insert 5', 'pop', 'insert 5'])).toEqual([
      'insert-5',
      'insert-5-2',
      'pop',
      'insert-5-3',
    ]);
  });

  it('spells out a minus sign, so -3 and 3 differ', () => {
    expect(sectionIds(['push -3', 'push 3', 'push 1e-7'])).toEqual([
      'push-minus-3',
      'push-3',
      'push-1e-7',
    ]);
  });

  it('keeps ids within 40 characters, repeats included', () => {
    const long = `push ${'9'.repeat(60)}`;
    const ids = sectionIds([long, long]);
    expect(ids[0]).toBe(`push-${'9'.repeat(35)}`);
    expect(ids[1]).toBe(`push-${'9'.repeat(33)}-2`);
  });

  it('starts every id with a letter', () => {
    expect(sectionIds(['', '3 times', '--'])).toEqual([
      'part',
      'part-3-times',
      'part-2',
    ]);
  });

  it('gives distinct section ids for any titles', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 12 }), (titles) => {
        const ids = sectionIds(titles);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids)
          expect(SectionId.safeParse(id).success).toBe(true);
      }),
      fuzz,
    );
  });
});

describe('operations as sections', () => {
  const from = [8, 3, 10, 1, 6, 14, 4, 7, 13];

  it('makes each operation a section titled after it', () => {
    const { document } = runOk('bst', {
      from,
      ops: [
        { op: 'insert', key: 5 },
        { op: 'search', key: 5 },
        { op: 'insert', key: 5 },
      ],
    });
    // Sections need 0.2, and the code in two languages 0.3 (ADR 0017).
    expect(document.version).toBe('0.3');
    expect(document.sections?.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'insert-5', title: 'Insert 5' },
      { id: 'search-5', title: 'Search 5' },
      { id: 'insert-5-2', title: 'Insert 5' },
    ]);
    expect(document.sections?.[0]?.start).toBe(0);
  });

  it('names every step after its anchor in the code', () => {
    const { document } = runOk('bst.search', { from, key: 7 });
    expect(document.steps.map((s) => s.meta?.id)).toEqual([
      'go',
      'go',
      'go',
      'found',
    ]);
    const heap = runOk('min-heap.pop', { from: [1, 5, 2, 8] });
    expect(heap.document.steps.map((s) => s.meta?.id).slice(0, 2)).toEqual([
      'swap-last',
      'remove',
    ]);
  });

  it('clears the last operation’s pointer in the first step of the next', () => {
    const { document } = runOk('bst', {
      from,
      ops: [
        { op: 'search', key: 7 },
        { op: 'insert', key: 5 },
      ],
    });
    const second = document.sections![1]!.start;
    expect(document.steps[second]?.meta?.id).toBe('go');
    expect(document.steps[second]?.actions[0]).toEqual({
      target: 'bst',
      type: 'pointer',
      name: 'curr',
      node: null,
    });
    // No step of the first operation is a narration-only marker any more.
    expect(document.steps.every((s) => s.meta?.id !== undefined)).toBe(true);
  });

  it('lets selectors find each operation and its steps', () => {
    const { document } = runOk('bst', {
      from,
      ops: [
        { op: 'search', key: 7 },
        { op: 'delete', key: 3 },
      ],
    });
    const last = document.steps.length;
    const search = selectFrames(document, 'search-7');
    const remove = selectFrames(document, 'delete-3');
    expect(search.ok && remove.ok).toBe(true);
    if (search.ok && remove.ok) {
      expect(search.value.from).toBe(0);
      expect(search.value.to).toBe(remove.value.from);
      expect(remove.value.to).toBe(last);
    }
    expect(selectFrames(document, 'delete-3/copy')).toMatchObject({ ok: true });
  });
});
