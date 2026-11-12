/**
 * The `priorityQueue` kind and the `heap` view of `array` (ADR 0029),
 * both added in protocol version 0.4, part of 1.0.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  kindNames,
  minimumVersion,
  parseVisualization,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (
  structures: Record<string, unknown>,
  steps: unknown[] = [],
  version = '1.0',
) => ({ version, structures, steps });

const errorsOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

const queue = (extra: Record<string, unknown> = {}) => ({
  kind: 'priorityQueue',
  initial: [
    { value: 'A', key: 0 },
    { id: 'b', value: 'B', key: null },
  ],
  ...extra,
});

describe('priorityQueue', () => {
  it('is a kind with five actions', () => {
    expect(kindNames).toContain('priorityQueue');
    expect(actionTypesOf('priorityQueue')).toEqual([
      'insert',
      'extract',
      'setKey',
      'peek',
      'highlight',
    ]);
  });

  it('gives items without an id e0, e1, … by position', () => {
    const result = parseVisualization(doc({ q: queue({ order: 'max' }) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.structures['q']).toEqual({
      kind: 'priorityQueue',
      order: 'max',
      initial: [
        { id: 'e0', value: 'A', key: 0 },
        { id: 'b', value: 'B', key: null },
      ],
    });
  });

  it('gives a bare inserted value the next free id, and keeps its key', () => {
    const result = parseVisualization(
      doc({ q: queue() }, [
        {
          actions: [
            { target: 'q', type: 'insert', element: 'C', key: 4.5 },
            { target: 'q', type: 'setKey', id: 'b', key: -1 },
            { target: 'q', type: 'extract' },
            { target: 'q', type: 'peek' },
            { target: 'q', type: 'highlight', ids: ['e1'] },
          ],
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]!.actions[0]).toEqual({
      target: 'q',
      type: 'insert',
      element: { id: 'e1', value: 'C' },
      key: 4.5,
    });
  });

  it('rejects ids used twice, also by a later insert', () => {
    expect(
      errorsOf(
        doc({
          q: {
            kind: 'priorityQueue',
            initial: [
              { id: 'a', value: 1, key: 1 },
              { id: 'a', value: 2, key: 2 },
            ],
          },
        }),
      ),
    ).toEqual([{ code: 'DUPLICATE_ID', path: '$.structures.q.initial[1].id' }]);
    expect(
      errorsOf(
        doc({ q: queue() }, [
          {
            actions: [
              {
                target: 'q',
                type: 'insert',
                element: { id: 'b', value: 'B' },
                key: 3,
              },
            ],
          },
        ]),
      ),
    ).toEqual([
      { code: 'DUPLICATE_ID', path: '$.steps[0].actions[0].element.id' },
    ]);
  });

  it('takes a number or null as a key, and min or max as the order', () => {
    expect(
      errorsOf(
        doc({
          q: { kind: 'priorityQueue', initial: [{ value: 1, key: '3' }] },
        }),
      ),
    ).toMatchObject([{ path: '$.structures.q.initial[0].key' }]);
    expect(errorsOf(doc({ q: queue({ order: 'least' }) }))).toMatchObject([
      { path: '$.structures.q.order' },
    ]);
    expect(
      errorsOf(
        doc({ q: queue() }, [
          { actions: [{ target: 'q', type: 'insert', element: 'C' }] },
        ]),
      ),
    ).toMatchObject([{ path: '$.steps[0].actions[0].key' }]);
  });

  it('needs no version beyond 1.0 (ADR 0043)', () => {
    const input = doc({ q: queue() });
    expect(minimumVersion(input as unknown as VisualizationInput)).toBe('1.0');
    expect(errorsOf({ ...input, version: '0.3' })).toEqual([]);
  });
});

describe('the heap view of array', () => {
  const heap = { kind: 'array', view: 'heap', initial: [9, 7, 8] };

  it('is a view of 1.0, read in any 0.x document too', () => {
    expect(errorsOf(doc({ h: heap }))).toEqual([]);
    expect(
      minimumVersion(doc({ h: heap }) as unknown as VisualizationInput),
    ).toBe('1.0');
    expect(errorsOf(doc({ h: heap }, [], '0.3'))).toEqual([]);
  });
});
