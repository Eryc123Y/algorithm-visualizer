/**
 * The `btree` kind (ADR 0035), protocol version 0.6: its declaration,
 * generated ids, the default root, the shape rules, and its actions.
 */
import { describe, expect, it } from 'vitest';

import {
  actionTypesOf,
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  type VisualizationInput,
} from '../src/index.ts';

const doc = (decl: Record<string, unknown>, actions: unknown[] = []) => ({
  version: '0.6',
  structures: { T: { kind: 'btree', ...decl } },
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

const tree = {
  nodes: [
    { id: 'r', keys: ['G'], children: ['a', 'b'] },
    { id: 'a', keys: ['A', 'C', 'E'] },
    { id: 'b', keys: ['H', 'K'] },
  ],
};

describe('btree (ADR 0035)', () => {
  it('is a kind of version 0.6 with thirteen actions', () => {
    expect(actionTypesOf('btree')).toEqual([
      'insertKey',
      'removeKey',
      'setKey',
      'lift',
      'split',
      'grow',
      'merge',
      'shrink',
      'borrow',
      'highlight',
      'settle',
      'pointer',
      'annotate',
    ]);
    expect(PROTOCOL_FEATURES.find((f) => f.name === 'B-trees')?.since).toBe(
      '0.6',
    );
    expect(
      minimumVersion({
        structures: { T: { kind: 'btree' } },
        steps: [],
      } as unknown as Omit<VisualizationInput, 'version'>),
    ).toBe('0.6');
    expect(errorsOf({ ...doc(tree), version: '0.5' })).toEqual([
      { code: 'VERSION_TOO_OLD', path: '$.version' },
    ]);
  });

  it('gives bare keys ids through the tree, and finds the root', () => {
    expect(parsed(doc(tree)).structures['T']).toEqual({
      kind: 'btree',
      nodes: [
        {
          id: 'r',
          keys: [{ id: 'k0', value: 'G' }],
          children: ['a', 'b'],
        },
        {
          id: 'a',
          keys: [
            { id: 'k1', value: 'A' },
            { id: 'k2', value: 'C' },
            { id: 'k3', value: 'E' },
          ],
        },
        {
          id: 'b',
          keys: [
            { id: 'k4', value: 'H' },
            { id: 'k5', value: 'K' },
          ],
        },
      ],
      root: 'r',
    });
  });

  it('is one empty root without nodes', () => {
    expect(parsed(doc({})).structures['T']).toEqual({
      kind: 'btree',
      nodes: [{ id: 'root', keys: [] }],
      root: 'root',
    });
  });

  it('refuses a shape that is not a tree', () => {
    const shape = (nodes: unknown[], root?: string) =>
      errorsOf(doc({ nodes, ...(root === undefined ? {} : { root }) }));
    expect(
      shape([
        { id: 'r', keys: [1, 2], children: ['a'] },
        { id: 'a', keys: [] },
      ]),
    ).toEqual([
      { code: 'INVALID_STRUCTURE', path: '$.structures.T.nodes[0].children' },
    ]);
    expect(
      shape([
        { id: 'r', keys: [1], children: ['a', 'z'] },
        { id: 'a', keys: [] },
      ]),
    ).toEqual([
      {
        code: 'INVALID_STRUCTURE',
        path: '$.structures.T.nodes[0].children[1]',
      },
    ]);
    expect(
      shape([
        { id: 'r', keys: [1] },
        { id: 's', keys: [2] },
      ]),
    ).toEqual([{ code: 'INVALID_STRUCTURE', path: '$.structures.T.root' }]);
    expect(shape([{ id: 'r', keys: [1] }], 'q')).toEqual([
      { code: 'INVALID_STRUCTURE', path: '$.structures.T.root' },
    ]);
    // A key and a node may not share an id.
    expect(
      errorsOf(doc({ nodes: [{ id: 'r', keys: [{ id: 'r', value: 1 }] }] })),
    ).toEqual([
      { code: 'DUPLICATE_ID', path: '$.structures.T.nodes[0].keys[0].id' },
    ]);
    expect(
      errorsOf(
        doc({
          nodes: [{ id: 'r', keys: Array.from({ length: 33 }, (_, k) => k) }],
        }),
      ),
    ).toMatchObject([{ path: '$.structures.T.nodes[0].keys' }]);
  });

  it('takes every action, and gives an inserted bare key an id', () => {
    const actions = [
      { target: 'T', type: 'insertKey', node: 'b', index: 2, key: 'M' },
      { target: 'T', type: 'split', node: 'r', index: 0, newNode: 'c' },
      { target: 'T', type: 'grow', newRoot: 's' },
      { target: 'T', type: 'merge', node: 'r', index: 0 },
      { target: 'T', type: 'borrow', node: 'r', child: 0, from: 'right' },
      { target: 'T', type: 'lift', key: 'k1', over: 'k0' },
      { target: 'T', type: 'setKey', key: 'k1', value: 'B' },
      { target: 'T', type: 'removeKey', key: 'k2' },
      { target: 'T', type: 'shrink' },
      { target: 'T', type: 'highlight', keys: ['k1'], nodes: ['a'] },
      { target: 'T', type: 'settle', key: 'k1' },
      { target: 'T', type: 'pointer', name: 'x', node: 'a' },
      { target: 'T', type: 'annotate', node: 'a', text: 'full' },
    ];
    const value = parsed(doc(tree, actions));
    expect(value.steps[0]!.actions[0]).toEqual({
      target: 'T',
      type: 'insertKey',
      node: 'b',
      index: 2,
      key: { id: 'k6', value: 'M' },
    });
    expect(errorsOf(doc(tree, [{ ...actions[1], newNode: 'a' }]))).toEqual([
      { code: 'DUPLICATE_ID', path: '$.steps[0].actions[0].newNode' },
    ]);
  });
});
