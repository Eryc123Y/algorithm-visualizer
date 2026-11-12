/**
 * `move` on a linked list (ADR 0036), added in 0.7, part of 1.0: its fields,
 * the feature that needs 0.7, and its refusal by older documents.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (version: string, actions: unknown[]) => ({
  version,
  structures: { l: { kind: 'linkedList', initial: [4, 2, 7, 1] } },
  steps: [{ actions: actions.map((a) => ({ target: 'l', ...(a as object) })) }],
});

describe('linkedList move (ADR 0036)', () => {
  it('is an action of 1.0, read in any 0.x document too', () => {
    expect(actionTypesOf('linkedList')).toContain('move');
    const move = { type: 'move', from: 2, to: 0 };
    const content = { ...doc('1.0', [move]), version: undefined };
    expect(
      minimumVersion(content as unknown as Omit<VisualizationInput, 'version'>),
    ).toBe('1.0');
    expect(parseVisualization(doc('1.0', [move])).ok).toBe(true);
    expect(parseVisualization(doc('0.6', [move])).ok).toBe(true);
  });

  it('needs both positions, and nothing else', () => {
    const codes = (action: object) => {
      const r = parseVisualization(doc('1.0', [action]));
      return r.ok ? [] : r.error.map((e) => e.code);
    };
    expect(codes({ type: 'move', from: 1 })).toEqual(['INVALID_ACTION']);
    expect(codes({ type: 'move', from: 1, to: -1 })).toEqual([
      'INVALID_ACTION',
    ]);
    expect(codes({ type: 'move', from: 1, to: 0, field: 'next' })).toEqual([
      'INVALID_ACTION',
    ]);
  });
});
