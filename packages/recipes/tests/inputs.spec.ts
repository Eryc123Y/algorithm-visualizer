/**
 * Inputs in notations, as the main field alone, and left out (ADR 0032):
 * each gives the document of the structured input it stands for.
 */
import { describe, expect, it } from 'vitest';

import { algorithms, findAlgorithm, runAlgorithm } from '../src/index.ts';
import { runError, runOk } from './helpers.ts';

const CITIES = {
  nodes: ['A', 'B', 'C', 'D'],
  edges: [
    ['A', 'B', 4],
    ['B', 'C', 1],
    ['A', 'C', 7],
    ['C', 'D', 2],
  ],
};
const CITIES_TEXT = 'A-B 4, B-C 1, A-C 7, C-D 2';

const documentOf = (id: string, input: unknown) => runOk(id, input).document;

describe('inputs in notations', () => {
  it.each([
    [
      'insertion-sort',
      { values: '5 2 4 6 1 3' },
      { values: [5, 2, 4, 6, 1, 3] },
    ],
    ['counting-sort', { values: '[3, 1, 0]' }, { values: [3, 1, 0] }],
    [
      'binary-search',
      { values: '1 3 5 7', target: 5 },
      { values: [1, 3, 5, 7], target: 5 },
    ],
    ['reverse-linked-list', { values: '1, 2, 3' }, { values: [1, 2, 3] }],
    [
      'inorder-tree-walk',
      { levelOrder: '[4,2,6,1,3,null,7]' },
      { levelOrder: [4, 2, 6, 1, 3, null, 7] },
    ],
    [
      'dijkstra',
      { graph: CITIES_TEXT, source: 'A' },
      { graph: CITIES, source: 'A' },
    ],
    [
      'topological-sort',
      { graph: 'shirt->tie, tie->jacket, socks' },
      {
        graph: {
          directed: true,
          nodes: ['shirt', 'tie', 'jacket', 'socks'],
          edges: [
            ['shirt', 'tie'],
            ['tie', 'jacket'],
          ],
        },
      },
    ],
    [
      'bst.insert',
      { from: '8 3 10 1 6', key: 4 },
      { from: [8, 3, 10, 1, 6], key: 4 },
    ],
    [
      'bst',
      { from: '8 3 10 1 6', ops: 'insert 4, delete 3' },
      {
        from: [8, 3, 10, 1, 6],
        ops: [
          { op: 'insert', key: 4 },
          { op: 'delete', key: 3 },
        ],
      },
    ],
    [
      'bst',
      { from: [8, 3, 10], ops: 'delete 8 predecessor' },
      {
        from: [8, 3, 10],
        ops: [{ op: 'delete', key: 8, replaceWith: 'predecessor' }],
      },
    ],
    [
      'min-heap',
      { from: '5 3 8', ops: 'push 1, pop' },
      { from: [5, 3, 8], ops: [{ op: 'push', value: 1 }, { op: 'pop' }] },
    ],
    [
      'max-heap.pop',
      { from: { array: '9 5 8' } },
      { from: { array: [9, 5, 8] } },
    ],
    [
      'trie',
      { from: 'cat car', ops: 'insert dog, search cat' },
      {
        from: ['cat', 'car'],
        ops: [
          { op: 'insert', word: 'dog' },
          { op: 'search', word: 'cat' },
        ],
      },
    ],
    [
      'disjoint-set',
      { from: { size: 4 }, ops: 'union 0 1, find-set 1' },
      {
        from: { size: 4 },
        ops: [
          { op: 'union', x: 0, y: 1 },
          { op: 'find-set', x: 1 },
        ],
      },
    ],
    [
      'hash-chaining',
      { from: { size: 7, keys: '10 22 31' }, ops: 'insert 4' },
      {
        from: { size: 7, keys: [10, 22, 31] },
        ops: [{ op: 'insert', key: 4 }],
      },
    ],
  ])('%s: %j', (id, notated, structured) => {
    expect(documentOf(id, notated)).toEqual(documentOf(id, structured));
  });
});

describe('the main field alone', () => {
  it.each([
    ['insertion-sort', '5 2 4 6 1 3', { values: [5, 2, 4, 6, 1, 3] }],
    ['merge-sort', [5, 2, 4], { values: [5, 2, 4] }],
    [
      'postorder-tree-walk',
      [4, 2, 6, null, 7],
      { levelOrder: [4, 2, 6, null, 7] },
    ],
    ['balanced-brackets', '{[()]}', { text: '{[()]}' }],
    ['dijkstra', CITIES_TEXT, { graph: CITIES, source: 'A' }],
    ['dijkstra', CITIES, { graph: CITIES, source: 'A' }],
    [
      'bfs',
      'A-B, A-C, B-D',
      {
        graph: {
          nodes: ['A', 'B', 'C', 'D'],
          edges: [
            ['A', 'B'],
            ['A', 'C'],
            ['B', 'D'],
          ],
        },
        source: 'A',
      },
    ],
    ['prim', CITIES_TEXT, { graph: CITIES, root: 'A' }],
    ['kruskal', CITIES_TEXT, { graph: CITIES }],
  ])('%s: %j', (id, alone, structured) => {
    expect(documentOf(id, alone)).toEqual(documentOf(id, structured));
  });

  it('starts graph algorithms at the first node by default', () => {
    expect(documentOf('bellman-ford', { graph: 'B->A 2, A->C 1' })).toEqual(
      documentOf('bellman-ford', {
        graph: {
          directed: true,
          nodes: ['B', 'A', 'C'],
          edges: [
            ['B', 'A', 2],
            ['A', 'C', 1],
          ],
        },
        source: 'B',
      }),
    );
  });

  it('is not offered where two fields are needed', () => {
    expect(runError('binary-search', '1 3 5')).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input',
    });
    expect(runError('bst.insert', '8 3 10')).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input',
    });
  });
});

describe('no input', () => {
  it.each(algorithms.map((a) => a.id))('%s runs on its first example', (id) => {
    const first = findAlgorithm(id)!.examples[0];
    expect(documentOf(id, undefined)).toEqual(documentOf(id, first));
  });
});

describe('input errors', () => {
  it('quote the token of a notation, at the field', () => {
    expect(runError('dijkstra', { graph: 'A-B 4, B-C x' })).toEqual({
      code: 'INVALID_NOTATION',
      path: '$.input.graph',
      message: 'Expected a weight or "," after "B-C", not "x" (character 12)',
      hint: expect.stringContaining('A-B 4, B-C 2'),
    });
  });

  it('are at the input for a main field alone', () => {
    expect(runError('insertion-sort', '5 x 4')).toMatchObject({
      code: 'INVALID_NOTATION',
      path: '$.input',
      message: 'Expected a number, not "x" (character 3)',
    });
  });

  it('check items and lengths of a list', () => {
    expect(runError('counting-sort', { values: '3 1 400' })).toMatchObject({
      code: 'INVALID_NOTATION',
      path: '$.input.values',
      message: expect.stringContaining('Item "400"'),
    });
    expect(runError('insertion-sort', { values: '' })).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input.values',
    });
  });

  it('name an unknown operation', () => {
    expect(
      runError('bst', { from: [8], ops: 'insert 4, delet 8' }),
    ).toMatchObject({
      code: 'INVALID_NOTATION',
      path: '$.input.ops',
      message:
        'Unknown operation "delet"; use search, insert or delete (character 11)',
    });
  });

  it('keep the structured form’s paths', () => {
    expect(runError('insertion-sort', { values: [1, 'a'] })).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input.values[1]',
    });
    expect(
      runError('dijkstra', {
        graph: { nodes: ['A'], edges: [['A', 'A', 'x']] },
      }),
    ).toMatchObject({
      code: 'INVALID_SHAPE',
      path: expect.stringMatching(/^\$\.input\.graph\.edges\[0\]/),
    });
    expect(
      runError('dijkstra', { nodes: ['A'], edges: [['A', 'A', 'x']] }),
    ).toMatchObject({
      code: 'INVALID_SHAPE',
      path: expect.stringMatching(/^\$\.input\.edges\[0\]/),
    });
  });

  it('say which types a field takes', () => {
    expect(runError('insertion-sort', 5)).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input',
      message: expect.stringMatching(/expected .*string.*received number/),
    });
    expect(runError('insertion-sort', { vals: [1] })).toMatchObject({
      code: 'INVALID_SHAPE',
    });
  });

  it('report a source that is not a node', () => {
    expect(runError('dijkstra', { graph: 'A-B', source: 'Z' })).toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('report an unknown id as before', () => {
    expect(runAlgorithm('nope', undefined)).toMatchObject({ ok: false });
  });
});
