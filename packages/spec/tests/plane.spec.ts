/**
 * The `plane` kind (ADR 0038), protocol version 0.9: the declaration and
 * its shape rules, the actions, and the feature.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  type VisualizationInput,
} from '../src/index.ts';

const points = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 4, y: 3 },
  { id: 'c', x: 3, y: 4 },
];

const doc = (plane: Record<string, unknown>, actions: unknown[] = []) => ({
  version: '0.9',
  structures: { P: { kind: 'plane', ...plane } },
  steps:
    actions.length === 0
      ? []
      : [{ actions: actions.map((a) => ({ target: 'P', ...(a as object) })) }],
});

const errorsOf = (input: unknown) => {
  const r = parseVisualization(input);
  return r.ok ? [] : r.error.map(({ code, path }) => ({ code, path }));
};

describe('plane (ADR 0038)', () => {
  it('is a kind of version 0.9 with twelve actions', () => {
    expect(actionTypesOf('plane')).toEqual([
      'addPoint',
      'removePoint',
      'addSegment',
      'removeSegment',
      'label',
      'highlight',
      'compare',
      'visit',
      'settle',
      'select',
      'pointer',
      'line',
    ]);
    expect(PROTOCOL_FEATURES.find((f) => f.name === 'planes')?.since).toBe(
      '0.9',
    );
    expect(
      minimumVersion({
        structures: { P: { kind: 'plane' } },
        steps: [],
      } as unknown as Omit<VisualizationInput, 'version'>),
    ).toBe('0.9');
    expect(errorsOf({ ...doc({ points }), version: '0.8' })).toEqual([
      { code: 'VERSION_TOO_OLD', path: '$.version' },
    ]);
  });

  it('starts empty without points', () => {
    const r = parseVisualization(doc({}));
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value.structures['P']).toEqual({ kind: 'plane', points: [] });
  });

  it('refuses a shape it cannot draw', () => {
    const at = (path: string) => `$.structures.P.${path}`;
    expect(
      errorsOf(doc({ points: [...points, { id: 'd', x: 4, y: 3 }] })),
    ).toEqual([{ code: 'INVALID_STRUCTURE', path: at('points[3]') }]);
    expect(
      errorsOf(doc({ points, segments: [{ id: 's', from: 'a', to: 'z' }] })),
    ).toEqual([{ code: 'INVALID_STRUCTURE', path: at('segments[0].to') }]);
    expect(
      errorsOf(doc({ points, segments: [{ id: 's', from: 'a', to: 'a' }] })),
    ).toEqual([{ code: 'INVALID_STRUCTURE', path: at('segments[0].to') }]);
    expect(
      errorsOf(
        doc({
          points,
          segments: [
            { id: 's', from: 'a', to: 'b' },
            { id: 't', from: 'b', to: 'a' },
          ],
        }),
      ),
    ).toEqual([{ code: 'INVALID_STRUCTURE', path: at('segments[1]') }]);
    expect(
      errorsOf(doc({ points, segments: [{ id: 'a', from: 'b', to: 'c' }] })),
    ).toEqual([{ code: 'DUPLICATE_ID', path: at('segments[0].id') }]);
    expect(
      errorsOf(doc({ points: [{ id: 'a', x: 2e6, y: 0 }] })),
    ).toMatchObject([{ code: 'INVALID_SHAPE' }]);
  });

  it('reads its actions, and needs a field for a highlight', () => {
    expect(
      errorsOf(
        doc({ points }, [
          { type: 'addPoint', point: { id: 'd', x: 1, y: 1 } },
          { type: 'addSegment', segment: { id: 's', from: 'a', to: 'd' } },
          { type: 'compare', points: ['a', 'b', 'c'] },
          { type: 'line', name: 'l + δ', x: 2.5 },
          { type: 'label', segment: 's', text: '1.41' },
          { type: 'select', segment: 's', on: true },
        ]),
      ),
    ).toEqual([]);
    expect(errorsOf(doc({ points }, [{ type: 'highlight' }]))).toMatchObject([
      { code: 'INVALID_ACTION' },
    ]);
    expect(
      errorsOf(doc({ points }, [{ type: 'compare', points: ['a'] }])),
    ).toMatchObject([{ code: 'INVALID_ACTION' }]);
    expect(
      errorsOf(
        doc({ points }, [{ type: 'addPoint', point: { id: 'b', x: 9, y: 9 } }]),
      ),
    ).toEqual([
      { code: 'DUPLICATE_ID', path: '$.steps[0].actions[0].point.id' },
    ]);
  });
});
