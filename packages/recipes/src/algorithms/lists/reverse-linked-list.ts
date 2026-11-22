/**
 * Reversing a singly linked list in place (ADR 0023): walk the list with
 * `prev`, `curr` and `next`, and turn each link around to point back.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';
import { labelFor } from '../../trace.ts';

/** Most nodes the list takes, so it fits on one row. */
export const MAX_LIST = 12;

export const reverseLinkedList = defineAlgorithm({
  id: 'reverse-linked-list',
  title: { en: 'Reverse a linked list', zh: '反转链表' },
  topic: 'lists',
  summary: {
    en: 'Reverses a singly linked list in place, turning one link around at a time.',
    zh: '原地反转一个单链表，每次把一个链接调转方向。',
  },
  input: z.strictObject({
    values: listField(
      z
        .array(z.number())
        .min(1)
        .max(MAX_LIST)
        .describe(
          'The values of the list from head to tail, e.g. [1, 2, 3, 4].',
        ),
      'number',
    ),
  }),
  main: 'values',
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
      ...labelFor(trace, 'list', { en: 'list', zh: '链表' }),
      initial: [...values],
    });
    const n = values.length;
    trace.step('start', {
      en: 'Start at the head, with no node before it: prev is empty.',
      zh: '从表头开始，它前面没有节点：prev 为空。',
    });
    list
      .pointer({ name: 'head', index: 0 })
      .pointer({ name: 'curr', index: 0 });
    let prev: number | null = null;
    for (let curr = 0; curr < n; curr++) {
      const next = curr + 1 < n ? curr + 1 : null;
      trace.step(
        'save',
        next === null
          ? {
              en: `${values[curr]} is the last node: there is no next node to remember.`,
              zh: `${values[curr]} 是最后一个节点：没有下一个节点需要记住。`,
            }
          : {
              en: `Remember the next node, ${values[next]}, before its link is lost.`,
              zh: `在链接丢失之前，先记住下一个节点 ${values[next]}。`,
            },
      );
      list.pointer({ name: 'next', index: next });
      trace.step(
        'link',
        prev === null
          ? {
              en: `${values[curr]} becomes the tail: its link points to nothing.`,
              zh: `${values[curr]} 成为表尾：它的链接指向空。`,
            }
          : {
              en: `Point ${values[curr]} back to ${values[prev]}.`,
              zh: `让 ${values[curr]} 反过来指向 ${values[prev]}。`,
            },
      );
      list.link({ from: curr, to: prev }).highlight({ indices: [curr] });
      trace.step(
        'advance',
        next === null
          ? {
              en: `Move prev to ${values[curr]}; curr runs off the end.`,
              zh: `把 prev 移到 ${values[curr]}；curr 走出了链表末尾。`,
            }
          : {
              en: `Move prev to ${values[curr]} and curr to ${values[next]}.`,
              zh: `把 prev 移到 ${values[curr]}，curr 移到 ${values[next]}。`,
            },
      );
      prev = curr;
      list
        .pointer({ name: 'prev', index: prev })
        .pointer({ name: 'curr', index: next })
        .visit({ index: curr });
    }
    trace.step('done', {
      en: `curr is empty: ${values[n - 1]} is the new head.`,
      zh: `curr 为空：${values[n - 1]} 是新的表头。`,
    });
    list
      .pointer({ name: 'next', index: null })
      .pointer({ name: 'head', index: prev });
  },
});
