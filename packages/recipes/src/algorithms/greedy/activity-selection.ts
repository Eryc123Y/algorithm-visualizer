/**
 * Activity selection, as in CLRS: of activities aᵢ = [sᵢ, fᵢ) sorted by
 * finish time, take a₁, then each activity that starts no earlier than
 * the last one taken finishes. Taking the activity that finishes first
 * always leaves the most time for the rest, so the greedy choice yields a
 * largest set of activities that do not overlap.
 *
 * A table holds the start and finish times, a column per activity in
 * order of finish; the chosen activities settle and gather in a list
 * beside it.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** The most activities, so that the table fits a page. */
export const MAX_ACTIVITIES = 12;
/** The latest time. */
export const MAX_TIME = 99;

const Activity = z
  .tuple([z.int().min(0).max(MAX_TIME), z.int().min(0).max(MAX_TIME)])
  .refine(([s, f]) => s < f, {
    message: 'An activity must start before it finishes',
  })
  .describe('An activity as [start, finish], with start < finish.');

export const activitySelection = defineAlgorithm({
  id: 'activity-selection',
  title: 'Activity selection',
  topic: 'greedy',
  summary:
    'Chooses the most activities that do not overlap by always taking, next, the compatible activity that finishes first.',
  input: z.strictObject({
    activities: z
      .array(Activity)
      .min(1)
      .max(MAX_ACTIVITIES)
      .describe(
        `The activities as [start, finish] pairs of integers from 0 to ${MAX_TIME}, e.g. [[1, 4], [3, 5], [0, 6], [5, 7]]. An activity occupies [start, finish), so another may start just as it finishes. They are sorted by finish time first.`,
      ),
  }),
  main: 'activities',
  examples: [
    {
      activities: [
        [1, 4],
        [3, 5],
        [0, 6],
        [5, 7],
        [3, 9],
        [5, 9],
        [6, 10],
        [7, 11],
        [8, 12],
        [2, 14],
        [12, 16],
      ],
    },
  ],
  code: {
    pseudocode: `
      GREEDY-ACTIVITY-SELECTOR(s, f, n)
          A = {a₁}  // @first
          k = 1
          for m = 2 to n
              if s[m] ≥ f[k]  // @check
                  A = A ∪ {aₘ}
                  k = m
          return A  // @done
    `,
    python: `
      def greedy_activity_selector(s, f):
          n = len(s)
          a = [0]  # @first
          k = 0
          for m in range(1, n):
              if s[m] >= f[k]:  # @check
                  a.append(m)
                  k = m
          return a  # @done
    `,
  },
  run({ activities }, trace) {
    // Sorted by finish time, ties by start, as GREEDY-ACTIVITY-SELECTOR
    // assumes; the sort is stable, so equal activities keep their order.
    const sorted = activities
      .map(([s, f], k) => ({ s, f, given: k }))
      .sort((x, y) => x.f - y.f || x.s - y.s);
    const n = sorted.length;
    const names = sorted.map((_, k) => `a${k + 1}`);
    const table = trace.add('activities', {
      kind: 'table',
      initial: [sorted.map((a) => a.s), sorted.map((a) => a.f)],
      rowLabels: ['s', 'f'],
      columnLabels: names,
    });
    const chosen = trace.add('A', {
      kind: 'array',
      label: 'A: the activities chosen',
      place: 'side',
      initial: names.map(() => ''),
    });
    const column = (m: number): [number, number][] => [
      [0, m],
      [1, m],
    ];
    const reordered = sorted.some((a, k) => a.given !== k);

    trace.step(
      'first',
      `${reordered ? `Sorted by finish time, a1 to a${n} are the given activities ${sorted.map((a) => a.given + 1).join(', ')}. ` : ''}a1 = [${sorted[0]!.s}, ${sorted[0]!.f}) finishes first: take it.`,
      { vars: { k: 1 } },
    );
    table.settle({ cells: column(0) });
    chosen.set({ index: 0, value: 'a1' }).highlight({ indices: [0] });
    let k = 0;
    let taken = 1;
    for (let m = 1; m < n; m++) {
      const a = sorted[m]!;
      const last = sorted[k]!;
      const fits = a.s >= last.f;
      trace.step(
        'check',
        fits
          ? `a${m + 1} starts at ${a.s}, no earlier than a${k + 1} finishes, at ${last.f}: take it.`
          : `a${m + 1} starts at ${a.s}, before a${k + 1} finishes, at ${last.f}: it overlaps, so skip it.`,
        { vars: { m: m + 1, k: k + 1 } },
      );
      table.highlight({
        cells: [
          [0, m],
          [1, k],
        ],
      });
      if (!fits) continue;
      table.settle({ cells: column(m) });
      chosen.set({ index: taken, value: `a${m + 1}` }).highlight({
        indices: [taken],
      });
      taken += 1;
      k = m;
    }
    trace.step(
      'done',
      `A holds ${taken === 1 ? 'one activity' : `${taken} activities`} that do not overlap; no choice could hold more.`,
      { vars: { k: k + 1 } },
    );
  },
});
