/**
 * `move` on a linked list (ADR 0036), protocol version 0.7: its fields,
 * the feature that needs 0.7, and its refusal by older documents.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (version: string, actions: unknown[]) => ({
  version,
  structures: { l: { kind: 'linkedList', initial: [4, 2, 7, 1] } },
  steps: [{ actions: actions.map((a) => ({ target: 'l', ...(a as object) })) }],
});

describe('linkedList move (ADR 0036)', () => {
  it('is an action of version 0.7', () => {
    expect(actionTypesOf('linkedList')).toContain('move');
    expect(PROTOCOL_FEATURES.find((f) => f.name === 'list moves')?.since).toBe(
      '0.7',
    );
    const move = { type: 'move', from: 2, to: 0 };
    const { version: _, ...content } = doc('0.7', [move]);
    expect(
      minimumVersion(content as unknown as Omit<VisualizationInput, 'version'>),
    ).toBe('0.7');
    expect(parseVisualization(doc('0.7', [move])).ok).toBe(true);
    const old = parseVisualization(doc('0.6', [move]));
    expect(old.ok ? [] : old.error.map((e) => e.code)).toEqual([
      'VERSION_TOO_OLD',
    ]);
  });

  it('needs both positions, and nothing else', () => {
    const codes = (action: object) => {
      const r = parseVisualization(doc('0.7', [action]));
      return r.ok ? [] : r.error.map((e) => e.code);
    };
    expect(codes({ type: 'move', from: 1 })).not.toEqual([]);
    expect(codes({ type: 'move', from: 1, to: -1 })).not.toEqual([]);
    expect(codes({ type: 'move', from: 1, to: 0, field: 'next' })).not.toEqual(
      [],
    );
  });

  it('leaves documents without a move at their version', () => {
    const { version: _, ...content } = doc('0.1', [
      { type: 'link', from: 0, to: 2 },
    ]);
    expect(
      minimumVersion(content as unknown as Omit<VisualizationInput, 'version'>),
    ).toBe('0.1');
  });
});
