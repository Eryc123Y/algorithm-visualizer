/**
 * Move-to-front (ADR 0036; CLRS 4th edition, chapter 27): a list serves a
 * sequence of requests, and after each one moves the requested key to
 * the front. Finding the key at position r costs r; moving it there by
 * swaps of neighbours would take r − 1. The node moves with `move` and is
 * relinked in the same step, so every step shows a list.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';
import { MAX_LIST } from './reverse-linked-list.ts';

/** Most requests one run serves. */
export const MAX_REQUESTS = 32;

const Key = z.union([z.number(), z.string().regex(/^[A-Za-z0-9]{1,8}$/)]);

/** Keys are compared as they are written. */
const keyOf = (k: number | string) => String(k);

export const moveToFront = defineAlgorithm({
  id: 'move-to-front',
  title: 'Move-to-front',
  topic: 'lists',
  summary:
    'Serves requests from a linked list, moving each requested key to the front: the search costs its position r, and moving it there by swaps would take r − 1 more.',
  input: z
    .strictObject({
      list: listField(
        z
          .array(Key)
          .min(1)
          .max(MAX_LIST)
          .describe(
            'The keys from head to tail, all different, e.g. "4 2 7 1".',
          ),
        'word',
      ),
      requests: listField(
        z
          .array(Key)
          .min(1)
          .max(MAX_REQUESTS)
          .describe('The keys requested, in order, e.g. "7 7 1 4".'),
        'word',
      ),
    })
    .superRefine(({ list, requests }, ctx) => {
      const keys = list.map(keyOf);
      const twice = keys.find((k, i) => keys.indexOf(k) !== i);
      if (twice !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['list'],
          message: `${twice} is in the list twice; the keys must all be different`,
        });
      const missing = requests.map(keyOf).find((k) => !keys.includes(k));
      if (missing !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['requests'],
          message: `${missing} is requested but not in the list`,
        });
    }),
  examples: [
    { list: [4, 2, 7, 1], requests: [7, 7, 1, 4] },
    { list: ['a', 'b', 'c', 'd', 'e'], requests: ['e', 'd', 'e', 'a', 'c'] },
  ],
  code: {
    pseudocode: `
      MOVE-TO-FRONT(L, requests)
          total = 0
          for each key k in requests  // @request
              x = L.head
              r = 1
              while x.key ≠ k  // @compare
                  prev = x
                  x = x.next
                  r = r + 1
              total = total + r + (r - 1)  // @found
              if r > 1  // @front
                  prev.next = x.next  // @move
                  x.next = L.head
                  L.head = x
          return total  // @done
    `,
    python: `
      def move_to_front(L, requests):
          total = 0
          for k in requests:  # @request
              prev, x, r = None, L.head, 1
              while x.key != k:  # @compare
                  prev, x, r = x, x.next, r + 1
              total += r + (r - 1)  # @found
              if r > 1:  # @front
                  prev.next = x.next  # @move
                  x.next = L.head
                  L.head = x
          return total  # @done
    `,
  },
  run({ list, requests }, trace) {
    const L = trace.add('L', { kind: 'linkedList', initial: [...list] });
    const table = trace.add('cost', {
      kind: 'table',
      place: 'side',
      label: 'cost',
      rows: requests.length + 1,
      columns: 4,
      initial: [
        ...requests.map((k) => [k, null, null, null]),
        ['total', null, null, null],
      ],
      columnLabels: ['request', 'search', 'move', 'cost'],
    });
    // The keys in list order, as the drawing has them.
    let order = list.map(keyOf);
    const totals = { search: 0, move: 0 };
    requests.forEach((key, row) => {
      const k = keyOf(key);
      trace.step(
        'request',
        `Request ${row + 1} of ${requests.length}: find ${k}, starting at the head, ${order[0]}.`,
      );
      L.pointer({ name: 'head', index: 0 }).pointer({ name: 'x', index: 0 });
      table.highlight({ cells: [[row, 0]] });
      const at = order.indexOf(k);
      for (let p = 0; p <= at; p++) {
        trace.step(
          'compare',
          p < at
            ? `${order[p]} is not ${k}: go on to the next node.`
            : `${order[p]} is ${k}: found at position ${p + 1}.`,
        );
        L.pointer({ name: 'x', index: p }).highlight({ indices: [p] });
      }
      const r = at + 1;
      trace.step(
        'found',
        `The search read ${r} node${r === 1 ? '' : 's'}, so it costs ${r}; moving ${k} to the front by swaps of neighbours takes ${r - 1}, so the request costs ${2 * r - 1}.`,
      );
      table.set({ cell: [row, 1], value: r });
      table.set({ cell: [row, 2], value: r - 1 });
      table.set({ cell: [row, 3], value: 2 * r - 1 });
      table.highlight({
        cells: [
          [row, 1],
          [row, 2],
          [row, 3],
        ],
      });
      totals.search += r;
      totals.move += r - 1;
      if (r === 1) {
        trace.step('front', `${k} is already the head: nothing moves.`);
        L.highlight({ indices: [0] });
        return;
      }
      const before = order[at - 1]!;
      const after = order[at + 1];
      trace.step(
        'move',
        `Move ${k} to the front: ${before} now links to ${after ?? 'nothing'}, ${k} links to the old head, ${order[0]}, and ${k} becomes the head.`,
      );
      // After the move, the predecessor is at position `at`, the
      // successor (if any) at `at + 1`, and the old head at 1.
      L.move({ from: at, to: 0 })
        .link({ from: at, to: after === undefined ? null : at + 1 })
        .link({ from: 0, to: 1 })
        .pointer({ name: 'head', index: 0 })
        .pointer({ name: 'x', index: 0 })
        .highlight({ indices: [0] });
      order = [k, ...order.filter((o) => o !== k)];
    });
    const total = totals.search + totals.move;
    trace.step(
      'done',
      `All ${requests.length} requests served: the searches cost ${totals.search} and the moves ${totals.move}, ${total} in all.`,
    );
    L.pointer({ name: 'x', index: null });
    const last = requests.length;
    table.set({ cell: [last, 1], value: totals.search });
    table.set({ cell: [last, 2], value: totals.move });
    table.set({ cell: [last, 3], value: total });
    table.highlight({ cells: [[last, 3]] });
    return { results: [total] };
  },
});
