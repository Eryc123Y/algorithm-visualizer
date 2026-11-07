/**
 * Reversing a singly linked list in place (ADR 0023): walk the list with
 * `prev`, `curr` and `next`, and turn each link around to point back.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** Most nodes the list takes, so it fits on one row. */
export const MAX_LIST = 12;

export const reverseLinkedList = defineAlgorithm({
  id: 'reverse-linked-list',
  title: 'Reverse a linked list',
  topic: 'lists',
  summary:
    'Reverses a singly linked list in place, turning one link around at a time.',
  input: z.strictObject({
    values: z
      .array(z.number())
      .min(1)
      .max(MAX_LIST)
      .describe('The values of the list from head to tail, e.g. [1, 2, 3, 4].'),
  }),
  examples: [{ values: [1, 2, 3, 4] }],
  code: {
    pseudocode: `
      REVERSE-LIST(head)
          prev = NIL  // @start
          curr = head
          while curr ≠ NIL
              next = curr.next  // @save
              curr.next = prev  // @link
              prev = curr  // @advance
              curr = next
          return prev  // @done
    `,
    python: `
      def reverse_list(head):
          prev, curr = None, head  # @start
          while curr is not None:
              nxt = curr.next  # @save
              curr.next = prev  # @link
              prev, curr = curr, nxt  # @advance
          return prev  # @done
    `,
  },
  run({ values }, trace) {
    const list = trace.add('list', {
      kind: 'linkedList',
      initial: [...values],
    });
    const n = values.length;
    trace.step(
      'start',
      'Start at the head, with no node before it: prev is empty.',
    );
    list
      .pointer({ name: 'head', index: 0 })
      .pointer({ name: 'curr', index: 0 });
    let prev: number | null = null;
    for (let curr = 0; curr < n; curr++) {
      const next = curr + 1 < n ? curr + 1 : null;
      trace.step(
        'save',
        next === null
          ? `${values[curr]} is the last node: there is no next node to remember.`
          : `Remember the next node, ${values[next]}, before its link is lost.`,
      );
      list.pointer({ name: 'next', index: next });
      trace.step(
        'link',
        prev === null
          ? `${values[curr]} becomes the tail: its link points to nothing.`
          : `Point ${values[curr]} back to ${values[prev]}.`,
      );
      list.link({ from: curr, to: prev }).highlight({ indices: [curr] });
      trace.step(
        'advance',
        next === null
          ? `Move prev to ${values[curr]}; curr runs off the end.`
          : `Move prev to ${values[curr]} and curr to ${values[next]}.`,
      );
      prev = curr;
      list
        .pointer({ name: 'prev', index: prev })
        .pointer({ name: 'curr', index: next })
        .visit({ index: curr });
    }
    trace.step('done', `curr is empty: ${values[n - 1]} is the new head.`);
    list
      .pointer({ name: 'next', index: null })
      .pointer({ name: 'head', index: prev });
  },
});
