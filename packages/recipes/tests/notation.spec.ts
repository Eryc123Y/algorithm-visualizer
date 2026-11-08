/** The input notations' parsers and printers (ADR 0032). */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  NotationError,
  parseGraph,
  parseList,
  parseOperations,
  printGraph,
  printList,
  printOperations,
  readInput,
  type OperationShape,
} from '../src/notation/index.ts';

const LIMITS = { maxNodes: 40, maxEdges: 200, maxWeight: 1e9 };

/** The message and character of the error `parse` throws. */
function failure(parse: () => unknown, text: string): string {
  try {
    parse();
  } catch (e) {
    if (e instanceof NotationError) return e.describe(text);
    throw e;
  }
  throw new Error('It parsed');
}

describe('the list notation', () => {
  it.each([
    ['5 2 4 6 1 3', [5, 2, 4, 6, 1, 3]],
    ['5, 2, 4', [5, 2, 4]],
    ['[5,2,4]', [5, 2, 4]],
    ['  [ 5 , 2 ]  ', [5, 2]],
    ['-3 2.5 1e9 -0', [-3, 2.5, 1e9, -0]],
    ['5,,2', [5, 2]],
    ['', []],
    ['[]', []],
  ])('reads %j', (text, values) => {
    expect(parseList(text, 'number')).toEqual(values);
  });

  it('reads gaps in a level order and words in a word list', () => {
    expect(parseList('[4,2,6,1,3,null,7]', 'level')).toEqual([
      4,
      2,
      6,
      1,
      3,
      null,
      7,
    ]);
    expect(parseList('cat, car dog', 'word')).toEqual(['cat', 'car', 'dog']);
  });

  it.each([
    ['5 x 4', 'number', 'Expected a number, not "x" (character 3)'],
    ['5 null', 'number', 'Expected a number, not "null" (character 3)'],
    ['4 nul', 'level', 'Expected a number or null, not "nul" (character 3)'],
    ['[5, 2', 'number', 'Expected "]" to end the list (at the end)'],
    ['5, 2]', 'number', 'Unexpected "]": the list has no "[" (character 5)'],
    [
      '[5] 3',
      'number',
      'Expected the end of the list after "]", not "3" (character 5)',
    ],
    ['[[5]]', 'number', 'Unexpected "[": items cannot be lists (character 2)'],
    ['1e999', 'number', 'The number "1e999" is too large (character 1)'],
    ['05', 'number', 'Expected a number, not "05" (character 1)'],
  ] as const)('rejects %j', (text, kind, message) => {
    expect(failure(() => parseList(text, kind), text)).toBe(message);
  });

  it('checks each item at its token', () => {
    const text = '3 1 40';
    expect(failure(() => parseList(text, 'number', z.int().max(9)), text)).toBe(
      'Item "40": Too big: expected number to be <=9 (character 5)',
    );
  });

  it('prints lists, unless a word has a separator in it', () => {
    expect(printList([5, -0, 2.5, null])).toBe('5, -0, 2.5, null');
    expect(printList(['cat', 'dog'])).toBe('cat, dog');
    expect(printList(['a b'])).toBeUndefined();
    expect(printList([''])).toBeUndefined();
  });
});

describe('the graph notation', () => {
  it('reads weighted and plain edges, and nodes alone', () => {
    expect(parseGraph('A-B 4, B-C, D', LIMITS)).toEqual({
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        ['A', 'B', 4],
        ['B', 'C'],
      ],
    });
  });

  it('reads directed edges, line breaks, spaces and empty items', () => {
    expect(parseGraph('\n s -> t  -2\n\nt->u,\n', LIMITS)).toEqual({
      nodes: ['s', 't', 'u'],
      edges: [
        ['s', 't', -2],
        ['t', 'u'],
      ],
      directed: true,
    });
  });

  it('reads numbered nodes', () => {
    expect(parseGraph('1-2 3, 2-10', LIMITS)).toEqual({
      nodes: ['1', '2', '10'],
      edges: [
        ['1', '2', 3],
        ['2', '10'],
      ],
    });
  });

  it('keeps repeated edges and loops', () => {
    expect(parseGraph('A-B 1, A-B 2, A-A', LIMITS).edges).toEqual([
      ['A', 'B', 1],
      ['A', 'B', 2],
      ['A', 'A'],
    ]);
  });

  it.each([
    ['A-B x', 'Expected a weight or "," after "A-B", not "x" (character 5)'],
    ['A-', 'Expected a node name after "A-" (at the end)'],
    ['A- *', 'Expected a node name after "A-", not "*" (character 4)'],
    ['A B', 'Expected "-", "->" or "," after "A", not "B" (character 3)'],
    ['A-B 4 5', 'Expected "," after "A-B 4", not "5" (character 7)'],
    [
      'A-B-C',
      'Expected "," or a space and a weight after "A-B", not "-C" (character 4)',
    ],
    ['-B', 'Expected a node name, not "-B" (character 1)'],
    ['A-B, Ä-C', 'Expected a node name, not "Ä-C" (character 6)'],
    [
      'A-B, B->C',
      'The edge "B->C" is directed, but "A-B" is undirected; write every edge with "-" or every edge with "->" (character 7)',
    ],
    [
      'A-B 2e9',
      'The weight "2e9" is beyond 1000000000 either way (character 5)',
    ],
    [
      'abcdefghijklmnopqrstuvwxyz-B',
      'The name "abcdefghijklmnopqrstuvwxyz" is longer than 24 characters (character 1)',
    ],
  ])('rejects %j', (text, message) => {
    expect(failure(() => parseGraph(text, LIMITS), text)).toBe(message);
  });

  it('checks the number of nodes and edges', () => {
    const limits = { maxNodes: 2, maxEdges: 1, maxWeight: 1e9 };
    expect(failure(() => parseGraph('A-B, C', limits), 'A-B, C')).toBe(
      'A graph has at most 2 nodes; "C" is one more (character 6)',
    );
    expect(failure(() => parseGraph('A-B, B-A', limits), 'A-B, B-A')).toBe(
      'A graph has at most 1 edges; "B-A" is one more (character 7)',
    );
  });

  it('prints graphs, keeping the node order', () => {
    expect(
      printGraph({
        nodes: ['C', 'A', 'B', 'D'],
        edges: [
          ['A', 'B', 4],
          ['B', 'C'],
        ],
      }),
    ).toBe('C, A-B 4, B-C, D');
    expect(
      printGraph({
        nodes: ['B', 'A'],
        edges: [['A', 'B']],
        directed: true,
      }),
    ).toBe('B, A->B');
  });

  it('has no notation for some graphs', () => {
    expect(printGraph({ nodes: ['a.b'], edges: [] })).toBeUndefined();
    expect(printGraph({ nodes: ['A', 'A'], edges: [] })).toBeUndefined();
    expect(
      printGraph({ nodes: ['A'], edges: [], directed: true }),
    ).toBeUndefined();
    expect(printGraph({ nodes: ['A'], edges: [['A', 'B']] })).toBeUndefined();
  });
});

describe('the operation-list notation', () => {
  const OPS: readonly OperationShape[] = [
    { name: 'insert', args: { key: z.int() } },
    {
      name: 'delete',
      args: {
        key: z.int(),
        replaceWith: z.enum(['successor', 'predecessor']).optional(),
      },
    },
    { name: 'pop', args: {} },
    {
      name: 'decrease-key',
      args: { index: z.int().min(0), value: z.number() },
    },
    { name: 'add', args: { word: z.string().regex(/^[a-z0-9]+$/) } },
  ];

  it('reads calls with their arguments in order', () => {
    expect(
      parseOperations(
        'insert 4, delete 3 predecessor\npop, decrease-key 2 -1, add 123',
        OPS,
      ),
    ).toEqual([
      { op: 'insert', key: 4 },
      { op: 'delete', key: 3, replaceWith: 'predecessor' },
      { op: 'pop' },
      { op: 'decrease-key', index: 2, value: -1 },
      { op: 'add', word: '123' },
    ]);
  });

  it.each([
    [
      'delet 3',
      'Unknown operation "delet"; use insert, delete, pop, decrease-key or add (character 1)',
    ],
    ['insert', '"insert" needs its key after "insert" (at the end)'],
    [
      'decrease-key 2, pop',
      '"decrease-key" needs its value after "decrease-key 2" (character 15)',
    ],
    ['pop 3', '"pop" takes no arguments, not "3" (character 5)'],
    ['insert 3 4', '"insert" takes one argument (key), not "4" (character 10)'],
    [
      'insert x',
      'The key "x": Invalid input: expected number, received string (character 8)',
    ],
    [
      'insert 2.5',
      'The key "2.5": Invalid input: expected int, received number (character 8)',
    ],
    [
      'decrease-key -1 3',
      'The index "-1": Too small: expected number to be >=0 (character 14)',
    ],
  ])('rejects %j', (text, message) => {
    expect(failure(() => parseOperations(text, OPS), text)).toBe(message);
  });

  it('prints calls, unless an argument cannot be written', () => {
    expect(
      printOperations(
        [{ op: 'insert', key: 4 }, { op: 'delete', key: 3 }, { op: 'pop' }],
        OPS,
      ),
    ).toBe('insert 4, delete 3, pop');
    expect(printOperations([{ op: 'add', word: 'a b' }], OPS)).toBeUndefined();
    expect(printOperations([{ op: 'nope' }], OPS)).toBeUndefined();
  });
});

describe('readInput', () => {
  it.each([
    ['{"values": [5, 2]}', { values: [5, 2] }],
    ['[5, 2]', [5, 2]],
    ['"A-B 4"', 'A-B 4'],
    ['7', 7],
    ['"graph": "A-B 4", "source": "B"', { graph: 'A-B 4', source: 'B' }],
    ['5 2 4 6 1 3', '5 2 4 6 1 3'],
    ['A-B 4, B-C 2', 'A-B 4, B-C 2'],
    [' insert 4, delete 3 ', ' insert 4, delete 3 '],
    ['   ', undefined],
  ])('reads %j', (text, value) => {
    expect(readInput(text)).toEqual({ ok: true, value });
  });

  it.each(['{"values": [5, 2}', '[5, 2', '"graph": "A-B" "source": "A"'])(
    'reports broken JSON in %j',
    (text) => {
      const read = readInput(text);
      expect(read.ok).toBe(false);
      if (!read.ok)
        expect(read.error[0]).toMatchObject({
          code: 'INVALID_JSON',
          path: '$.input',
        });
    },
  );
});
