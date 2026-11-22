/**
 * Property tests of the recipes (recipe-properties.ts): Lists, stacks and queues.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/lists.spec.ts`.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

import { runOk, stateOf } from '../helpers.ts';
import { recipe } from '../recipe-properties.ts';
import { numberArrays, strings, isBalanced } from './shared.ts';

// ---------------------------------------------------------------------------
// Linear structures

recipe(
  'reverse-linked-list',
  numberArrays(12).filter((a) => a.length > 0),
  (values, locale) => runOk('reverse-linked-list', { values }, locale).document,
  (trace, values) => {
    const list = stateOf(trace, 'list', 'linkedList');
    const byId = new Map(list.data.map((n) => [n.id, n]));
    const walked: unknown[] = [];
    let at: string | null = list.marks.pointers['head'] ?? null;
    while (at !== null && walked.length <= values.length) {
      const node = byId.get(at)!;
      walked.push(node.value);
      at = node.next;
    }
    expect(walked).toEqual([...values].reverse());
  },
);

recipe(
  'move-to-front',
  fc
    .tuple(
      fc.uniqueArray(fc.integer({ min: 0, max: 30 }), {
        minLength: 1,
        maxLength: 12,
      }),
      fc.array(fc.nat(), { minLength: 1, maxLength: 32 }),
    )
    .map(([list, picks]) => ({
      list,
      requests: picks.map((p) => list[p % list.length]!),
    })),
  (input, locale) => runOk('move-to-front', input, locale).document,
  (trace, { list, requests }) => {
    // Each request ends at the front, so the last requests, most recent
    // first, lead the list, and the keys never requested keep their order.
    const recent = [...new Set([...requests].reverse())];
    const rest = list.filter((k) => !recent.includes(k));
    const drawn = stateOf(trace, 'L', 'linkedList').data.map((n) => n.value);
    expect(drawn).toEqual([...recent, ...rest]);
  },
);

recipe(
  'balanced-brackets',
  strings('()[]{}a ', 32).filter((t) => t.length >= 1 && t.length <= 32),
  (text, locale) => runOk('balanced-brackets', { text }, locale).document,
  (trace, text) => {
    const last = trace.visualization.steps.at(-1)?.meta?.narration ?? '';
    const balanced = isBalanced(text);
    expect(last.endsWith(': balanced.')).toBe(balanced);
    if (balanced) expect(stateOf(trace, 'stack', 'stack').data).toEqual([]);
  },
);
