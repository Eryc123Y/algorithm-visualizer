/**
 * An array's pattern (ADR 0037), protocol version 0.8: the declaration,
 * generated pattern ids, the refusals, the two actions and the feature.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (array: Record<string, unknown>, actions: unknown[] = []) => ({
  version: '0.8',
  structures: { T: { kind: 'array', initial: ['a', 'b', 'a', 'c'], ...array } },
  steps:
    actions.length === 0
      ? []
      : [{ actions: actions.map((a) => ({ target: 'T', ...(a as object) })) }],
});

const errorsOf = (input: unknown) => {
  const r = parseVisualization(input);
  return r.ok ? [] : r.error.map(({ code, path }) => ({ code, path }));
};

const versionOf = (input: ReturnType<typeof doc>) =>
  minimumVersion({
    ...input,
    version: undefined,
  } as unknown as Omit<VisualizationInput, 'version'>);

describe('array patterns (ADR 0037)', () => {
  it('are a feature of version 0.8, with align and check', () => {
    expect(actionTypesOf('array')).toEqual(
      expect.arrayContaining(['align', 'check']),
    );
    expect(
      PROTOCOL_FEATURES.find((f) => f.name === 'array patterns')?.since,
    ).toBe('0.8');
    expect(versionOf(doc({ pattern: ['a', 'c'] }))).toBe('0.8');
    expect(versionOf(doc({}))).toBe('0.1');
    expect(
      errorsOf({ ...doc({ pattern: ['a', 'c'] }), version: '0.7' }),
    ).toEqual([{ code: 'VERSION_TOO_OLD', path: '$.version' }]);
  });

  it('gives bare pattern values ids the document does not use', () => {
    const r = parseVisualization(
      doc({
        initial: [
          { id: 'p0', value: 'a' },
          { id: 't1', value: 'b' },
        ],
        pattern: ['a', 'b'],
        shift: 1,
      }),
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value.structures['T']).toMatchObject({
      pattern: [
        { id: 'p1', value: 'a' },
        { id: 'p2', value: 'b' },
      ],
      shift: 1,
    });
  });

  it('refuses a pattern it cannot draw or place', () => {
    expect(errorsOf(doc({ pattern: ['a'], view: 'tree' }))).toEqual([
      { code: 'INVALID_STRUCTURE', path: '$.structures.T.pattern' },
    ]);
    expect(errorsOf(doc({ pattern: ['a'], shift: 5 }))).toEqual([
      { code: 'INVALID_STRUCTURE', path: '$.structures.T.shift' },
    ]);
    expect(errorsOf(doc({ shift: 1 }))).toEqual([
      { code: 'INVALID_STRUCTURE', path: '$.structures.T.shift' },
    ]);
    expect(errorsOf(doc({ pattern: [] }))).toMatchObject([
      { path: '$.structures.T.pattern' },
    ]);
    // Pattern ids share the structure's ids.
    expect(
      errorsOf(
        doc({
          initial: [{ id: 'x', value: 1 }],
          pattern: [{ id: 'x', value: 1 }],
        }),
      ),
    ).toEqual([{ code: 'DUPLICATE_ID', path: '$.structures.T.pattern[0].id' }]);
  });

  it('reads align and check', () => {
    expect(
      errorsOf(
        doc({ pattern: ['a', 'c'] }, [
          { type: 'align', shift: 2, matched: 1 },
          { type: 'check', j: 1 },
        ]),
      ),
    ).toEqual([]);
    expect(
      errorsOf(doc({ pattern: ['a'] }, [{ type: 'align', shift: -1 }])),
    ).toMatchObject([{ code: 'INVALID_ACTION' }]);
    expect(
      errorsOf(doc({ pattern: ['a'] }, [{ type: 'check' }])),
    ).toMatchObject([{ code: 'INVALID_ACTION' }]);
  });
});
