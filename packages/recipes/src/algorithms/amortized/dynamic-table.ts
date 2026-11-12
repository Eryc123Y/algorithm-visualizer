/**
 * A dynamic table, as in CLRS's amortized analysis: TABLE-INSERT puts an
 * item in the next free slot, and when the table is full it first moves
 * every item into a new table of twice the size. One insertion can cost
 * as much as copying the whole table, but n insertions cost less than 3n
 * in all. With the potential Φ = 2·num − size, each insertion costs at
 * most 3, amortized.
 *
 * The table is an array whose cells grow when it expands, the copied
 * items highlighted. A table beside it has a row per insertion: num and
 * size after it, its cost (1, plus the items copied), the total so far,
 * and Φ.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';

/** The most insertions, so that the table fits a page. */
export const MAX_INSERTS = 16;

export const dynamicTable = defineAlgorithm({
  id: 'dynamic-table',
  title: 'Dynamic table',
  topic: 'amortized',
  summary:
    'Inserts items into a table that doubles its size when full, copying its items, and keeps each insertion’s cost, the total and the potential 2·num − size.',
  input: z.strictObject({
    items: listField(
      z
        .array(z.number())
        .min(1)
        .max(MAX_INSERTS)
        .describe(
          `The items to insert, in order, 1 to ${MAX_INSERTS}, e.g. [5, 3, 8, 1, 9, 2, 7, 4, 6].`,
        ),
      'number',
    ),
  }),
  main: 'items',
  examples: [{ items: [5, 3, 8, 1, 9, 2, 7, 4, 6] }],
  code: {
    pseudocode: `
      TABLE-INSERT(T, x)
          if T.size == 0
              allocate T.table with 1 slot  // @first
              T.size = 1
          if T.num == T.size
              allocate new-table with 2 · T.size slots
              insert all items in T.table into new-table  // @expand
              free T.table
              T.table = new-table
              T.size = 2 · T.size
          insert x into T.table  // @insert
          T.num = T.num + 1
    `,
    python: `
      class Table:
          def __init__(self):
              self.slots, self.num = [], 0

      def table_insert(t, x):
          if len(t.slots) == 0:
              t.slots = [None]  # @first
          if t.num == len(t.slots):
              bigger = [None] * (2 * len(t.slots))
              bigger[:t.num] = t.slots  # @expand
              t.slots = bigger
          t.slots[t.num] = x  # @insert
          t.num += 1
    `,
  },
  run({ items }, trace) {
    const n = items.length;
    const T = trace.add('T', { kind: 'array', initial: [] });
    const ledger = trace.add('cost', {
      kind: 'table',
      label: 'each insertion: num, size, cost, total, Φ',
      place: 'side',
      rows: n,
      columns: 5,
      rowLabels: items.map((_, t) => t + 1),
      columnLabels: ['num', 'size', 'cost', 'total', 'Φ'],
    });
    let size = 0;
    let total = 0;
    const grow = (count: number) => {
      for (let c = 0; c < count; c++)
        T.insert({
          index: size + c,
          element: { id: `s${size + c}`, value: '' },
        });
      size += count;
    };

    items.forEach((x, num) => {
      let cost = 1;
      if (size === 0) {
        trace.step('first', 'The table is empty: allocate it with 1 slot.', {
          vars: { num, size: 1 },
        });
        grow(1);
      }
      if (num === size) {
        cost += num;
        trace.step(
          'expand',
          `${size === 1 ? 'The 1 slot is' : `All ${size} slots are`} full: allocate ${2 * size} slots and copy the ${num === 1 ? 'item' : `${num} items`} into them, ${num} of this insertion’s cost.`,
          { vars: { num, size: 2 * size } },
        );
        T.highlight({ indices: Array.from({ length: num }, (_, k) => k) });
        grow(size);
      }
      total += cost;
      const phi = 2 * (num + 1) - size;
      trace.step(
        'insert',
        `Insert ${x} into slot ${num}. This insertion cost ${cost}; ${num === 0 ? 'it is the only one so far' : `the ${num + 1} insertions have cost ${total} in all`}, and Φ = 2·${num + 1} − ${size} = ${phi}.`,
        { vars: { num: num + 1, size } },
      );
      T.set({ index: num, value: x }).highlight({ indices: [num] });
      const row = num;
      [num + 1, size, cost, total, phi].forEach((v, c) =>
        ledger.set({ cell: [row, c], value: v }),
      );
      ledger.highlight({ cells: [0, 1, 2, 3, 4].map((c) => [row, c]) });
    });
  },
});
