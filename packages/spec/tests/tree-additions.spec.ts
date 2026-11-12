/**
 * The tree additions of ADR 0034, added in 0.5, part of 1.0: root slots, NIL
 * pointers, named notes, edge marks and labels, and root lists.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (
  structures: Record<string, unknown>,
  actions: unknown[] = [],
  version = '1.0',
) => ({
  version,
  structures,
  steps: actions.length === 0 ? [] : [{ actions }],
});

const errorsOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

const parsed = (input: unknown) => {
  const result = parseVisualization(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

const binary = {
  kind: 'tree',
  binary: true,
  nodes: [
    { id: 'r', value: 5, children: ['a', null] },
    { id: 'a', value: 3 },
  ],
};
const forest = {
  kind: 'tree',
  nodes: [
    { id: 'p', value: 1, children: ['q'] },
    { id: 'q', value: 2 },
    { id: 's', value: 3 },
  ],
};

const version = (input: unknown) =>
  minimumVersion(input as Omit<VisualizationInput, 'version'>);

describe('tree additions (ADR 0034)', () => {
  it('adds markEdge and labelEdge to the tree actions', () => {
    expect(actionTypesOf('tree').slice(-2)).toEqual(['markEdge', 'labelEdge']);
  });

  describe('root slots (S1)', () => {
    it('takes a slot on a new root and on detach', () => {
      const value = parsed(
        doc({ f: forest }, [
          { target: 'f', type: 'addNode', node: 9, parent: null, slot: 0 },
          { target: 'f', type: 'detach', node: 'q', slot: 1 },
          { target: 'f', type: 'detach', node: 's' },
        ]),
      );
      expect(value.steps[0]!.actions).toEqual([
        {
          target: 'f',
          type: 'addNode',
          node: { id: 'e0', value: 9 },
          parent: null,
          slot: 0,
        },
        { target: 'f', type: 'detach', node: 'q', slot: 1 },
        { target: 'f', type: 'detach', node: 's' },
      ]);
    });

    it('needs no version beyond 1.0, at a root or a child slot', () => {
      const base = { structures: { f: forest } };
      const step = (action: object) => ({
        ...base,
        steps: [{ actions: [{ target: 'f', ...action }] }],
      });
      expect(
        version(step({ type: 'addNode', node: 1, parent: 'p', slot: 0 })),
      ).toBe('1.0');
      expect(version(step({ type: 'detach', node: 'q' }))).toBe('1.0');
      expect(
        version(step({ type: 'addNode', node: 1, parent: null, slot: 0 })),
      ).toBe('1.0');
      expect(version(step({ type: 'detach', node: 'q', slot: 0 }))).toBe('1.0');
      // A 0.x document may use them too (ADR 0043).
      expect(
        errorsOf(
          doc(
            { f: forest },
            [{ target: 'f', type: 'detach', node: 'q', slot: 0 }],
            '0.4',
          ),
        ),
      ).toEqual([]);
    });

    it('refuses left and right as a root slot', () => {
      expect(
        errorsOf(
          doc({ f: forest }, [
            {
              target: 'f',
              type: 'addNode',
              node: 9,
              parent: null,
              slot: 'left',
            },
          ]),
        ),
      ).toMatchObject([{ path: '$.steps[0].actions[0].slot' }]);
    });

    it('refuses a slot that is not a whole number from 0', () => {
      expect(
        errorsOf(
          doc({ f: forest }, [
            { target: 'f', type: 'detach', node: 'q', slot: -1 },
          ]),
        ),
      ).toMatchObject([{ path: '$.steps[0].actions[0].slot' }]);
    });
  });

  describe('NIL pointers (S2)', () => {
    it('point at an empty slot, given as left or right', () => {
      const value = parsed(
        doc({ t: binary }, [
          {
            target: 't',
            type: 'pointer',
            name: 'x',
            node: { parent: 'a', slot: 'right' },
          },
          {
            target: 't',
            type: 'pointer',
            name: 'y',
            node: { parent: 'r', slot: 1 },
          },
        ]),
      );
      expect(value.steps[0]!.actions).toEqual([
        {
          target: 't',
          type: 'pointer',
          name: 'x',
          node: { parent: 'a', slot: 1 },
        },
        {
          target: 't',
          type: 'pointer',
          name: 'y',
          node: { parent: 'r', slot: 1 },
        },
      ]);
      expect(
        version({ structures: { t: binary }, steps: [{ actions: [] }] }),
      ).toBe('1.0');
      expect(
        version({
          structures: { t: binary },
          steps: [
            {
              actions: [
                {
                  target: 't',
                  type: 'pointer',
                  name: 'x',
                  node: { parent: 'a', slot: 'left' },
                },
              ],
            },
          ],
        }),
      ).toBe('1.0');
    });

    it('refuses a slot object with other fields', () => {
      expect(
        errorsOf(
          doc({ t: binary }, [
            {
              target: 't',
              type: 'pointer',
              name: 'x',
              node: { parent: 'a', slot: 0, side: 'left' },
            },
          ]),
        ),
      ).toMatchObject([{ path: '$.steps[0].actions[0].node' }]);
    });
  });

  describe('named notes (S3)', () => {
    it('take a field of lower-case letters, digits and hyphens', () => {
      const action = (field: string) => ({
        target: 't',
        type: 'annotate',
        node: 'a',
        text: 's=1',
        field,
      });
      expect(errorsOf(doc({ t: binary }, [action('size')]))).toEqual([]);
      expect(errorsOf(doc({ t: binary }, [action('max-2')]))).toEqual([]);
      for (const bad of ['Size', '2x', 'a b', '', 'x'.repeat(17)])
        expect(errorsOf(doc({ t: binary }, [action(bad)])), bad).toMatchObject([
          { path: '$.steps[0].actions[0].field' },
        ]);
      expect(
        version({
          structures: { t: binary },
          steps: [{ actions: [action('size')] }],
        }),
      ).toBe('1.0');
    });

    it('leave graph notes alone', () => {
      expect(
        errorsOf(
          doc(
            {
              g: { kind: 'graph', nodes: ['A'], edges: [] },
            },
            [
              {
                target: 'g',
                type: 'annotate',
                node: 'A',
                text: 'd',
                field: 'd',
              },
            ],
          ),
        ),
      ).toMatchObject([{ path: '$.steps[0].actions[0]' }]);
    });
  });

  describe('edge marks and labels (S4)', () => {
    it('name an edge by its lower end', () => {
      const actions = [
        { target: 't', type: 'markEdge', node: 'a', mark: 'selected' },
        { target: 't', type: 'markEdge', node: 'a', mark: null },
        { target: 't', type: 'labelEdge', node: 'a', label: '0' },
        { target: 't', type: 'labelEdge', node: 'a', label: 1 },
        { target: 't', type: 'labelEdge', node: 'a', label: null },
      ];
      expect(parsed(doc({ t: binary }, actions)).steps[0]!.actions).toEqual(
        actions,
      );
      expect(version({ structures: { t: binary }, steps: [{ actions }] })).toBe(
        '1.0',
      );
    });

    it('refuse unknown marks and long labels', () => {
      expect(
        errorsOf(
          doc({ t: binary }, [
            { target: 't', type: 'markEdge', node: 'a', mark: 'highlight' },
            {
              target: 't',
              type: 'labelEdge',
              node: 'a',
              label: 'x'.repeat(17),
            },
          ]),
        ),
      ).toMatchObject([
        { path: '$.steps[0].actions[0].mark' },
        { path: '$.steps[0].actions[1].label' },
      ]);
    });

    it('need no version beyond 1.0, in trees as in graphs', () => {
      expect(
        version({
          structures: {
            g: { kind: 'graph', nodes: ['A', 'B'], edges: [['A', 'B']] },
          },
          steps: [
            {
              actions: [
                {
                  target: 'g',
                  type: 'markEdge',
                  edge: 'A-B',
                  mark: 'selected',
                },
              ],
            },
          ],
        }),
      ).toBe('1.0');
    });
  });

  describe('root lists (S5)', () => {
    it('are list or circular', () => {
      for (const rootList of ['list', 'circular']) {
        const value = parsed(doc({ f: { ...forest, rootList } }));
        expect(value.structures['f']).toMatchObject({ rootList });
        expect(
          version({ structures: { f: { ...forest, rootList } }, steps: [] }),
        ).toBe('1.0');
      }
      expect(
        errorsOf(doc({ f: { ...forest, rootList: 'ring' } })),
      ).toMatchObject([{ path: '$.structures.f.rootList' }]);
    });
  });
});
