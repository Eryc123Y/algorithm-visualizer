/**
 * `place` on structure declarations (ADR 0029): which structures are
 * auxiliary, for the side panel of a figure. Protocol version 0.4.
 */
import { describe, expect, it } from 'vitest';

import {
  minimumVersion,
  parseVisualization,
  type VisualizationInput,
} from '../src/index.ts';

/** One declaration of every kind, in authoring form. */
const DECLS = {
  array: { kind: 'array', initial: [1, 2] },
  stack: { kind: 'stack', initial: [1] },
  queue: { kind: 'queue', initial: [1] },
  linkedList: { kind: 'linkedList', initial: [1, 2] },
  tree: { kind: 'tree', levelOrder: [2, 1, 3] },
  graph: { kind: 'graph', nodes: ['A', 'B'], edges: [['A', 'B']] },
  table: { kind: 'table', rows: 2, columns: 2 },
  hashTable: { kind: 'hashTable', size: 3 },
} satisfies Record<string, Record<string, unknown>>;

const doc = (
  structures: Record<string, unknown>,
  version = '1.0',
): Record<string, unknown> => ({ version, structures, steps: [] });

const errorsOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

describe('place (ADR 0029)', () => {
  it.each(Object.entries(DECLS))(
    'is kept on a %s declaration',
    (kind, decl) => {
      for (const place of ['main', 'side'] as const) {
        const result = parseVisualization(doc({ s: { ...decl, place } }));
        expect(result.ok, kind).toBe(true);
        if (result.ok) expect(result.value.structures['s']?.place).toBe(place);
      }
    },
  );

  it('is optional, and absent from the canonical form when not given', () => {
    const result = parseVisualization(doc({ s: DECLS.array }));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.structures['s']).not.toHaveProperty('place');
  });

  it('takes only "main" or "side"', () => {
    expect(
      errorsOf(doc({ s: { ...DECLS.stack, place: 'right' } })),
    ).toMatchObject([{ path: '$.structures.s.place' }]);
  });
});

describe('placement in 1.0 (ADR 0043)', () => {
  it('needs no version beyond 1.0, even place "main"', () => {
    for (const place of ['main', 'side']) {
      const input = doc({ a: DECLS.array, s: { ...DECLS.stack, place } });
      expect(minimumVersion(input as unknown as VisualizationInput)).toBe(
        '1.0',
      );
      expect(errorsOf({ ...input, version: '0.3' })).toEqual([]);
    }
  });
});
