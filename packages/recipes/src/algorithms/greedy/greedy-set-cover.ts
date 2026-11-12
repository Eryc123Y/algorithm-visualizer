/**
 * GREEDY-SET-COVER (CLRS 35.3): to cover a finite set X with as few as
 * possible of a family F of its subsets, repeatedly choose the subset that
 * covers the most elements not yet covered. The cover found is at most
 * H(d) times the smallest, where d is the size of the largest subset and
 * H(d) = 1 + 1/2 + … + 1/d.
 *
 * A table has a row per subset and a column per element of X, a dot where
 * the element belongs to the subset. At each choice the column "new"
 * counts what every subset would still cover, |S ∩ U|; each element is
 * settled where the subset that covered it chose it, and the chosen subsets
 * ticked. Ties go to the subset given first.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { parseIn } from '../../notation/error.ts';
import { parsePreferences } from '../graphs/gale-shapley.ts';

/** Most subsets, and most elements in all. */
export const MAX_SUBSETS = 10;
export const MAX_ELEMENTS = 16;

const NAME = /^[A-Za-z0-9_.-]{1,8}$/;

/**
 * Natural order: runs of digits compare as numbers, so 2 comes before 10.
 * Written out rather than with Intl, which the Typst plugin's JavaScript
 * engine lacks.
 */
function natural(a: string, b: string): number {
  const [x, y] = [a.match(/\d+|\D+/g) ?? [], b.match(/\d+|\D+/g) ?? []];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const [p, q] = [x[i]!, y[i]!];
    if (p === q) continue;
    if (/^\d/.test(p) && /^\d/.test(q))
      return Number(p) - Number(q) || p.length - q.length;
    return p < q ? -1 : 1;
  }
  return x.length - y.length;
}

const FORM =
  'each subset with a colon and then its elements, e.g. "S1: 1 2 3, S2: 2 4, S3: 3 4 5"';

const Name = z
  .string()
  .regex(NAME, 'A name is 1 to 8 letters, digits, "_", "." or "-"');

const Subsets = z
  .union([
    z
      .string()
      .transform((s, ctx) =>
        parseIn(s, ctx, parsePreferences, `Write ${FORM}.`),
      ),
    z.array(z.tuple([z.string(), z.array(z.string())])),
  ])
  .pipe(
    z
      .array(z.tuple([Name, z.array(Name)]))
      .min(1, 'Give at least one subset')
      .max(MAX_SUBSETS)
      .superRefine((sets, ctx) => {
        const names = new Set<string>();
        sets.forEach(([name, members], k) => {
          if (names.has(name))
            ctx.addIssue({
              code: 'custom',
              path: [k, 0],
              message: `${JSON.stringify(name)} names two subsets`,
            });
          names.add(name);
          // An empty subset covers nothing; in the notation it is most
          // likely a slip, such as "A: 1:2" for "A: 1, B: 2".
          if (members.length === 0)
            ctx.addIssue({
              code: 'custom',
              path: [k, 1],
              message: `${name} has no elements; every subset has at least one`,
            });
          const twice = members.find((x, i) => members.indexOf(x) !== i);
          if (twice !== undefined)
            ctx.addIssue({
              code: 'custom',
              path: [k, 1],
              message: `${name} lists ${JSON.stringify(twice)} twice`,
            });
        });
        const all = new Set(sets.flatMap(([, members]) => members));
        if (all.size > MAX_ELEMENTS)
          ctx.addIssue({
            code: 'custom',
            message: `The subsets hold ${all.size} elements in all; at most ${MAX_ELEMENTS}`,
          });
        if (all.size === 0)
          ctx.addIssue({
            code: 'custom',
            message: 'The subsets hold no elements',
          });
      }),
  )
  .describe(
    `The family F: ${FORM}, or pairs such as [["S1", ["1", "2"]]]. X is every element named; at most ${MAX_SUBSETS} subsets and ${MAX_ELEMENTS} elements.`,
  );

export const greedySetCover = defineAlgorithm({
  id: 'greedy-set-cover',
  title: 'Greedy set cover',
  topic: 'greedy',
  summary:
    'Covers a set with few of a family of its subsets by always choosing the subset that covers the most elements not yet covered, within a factor H(d) of the fewest.',
  input: z.strictObject({ subsets: Subsets }),
  main: 'subsets',
  examples: [
    {
      subsets: [
        ['S1', ['1', '2', '3', '4', '5', '6']],
        ['S2', ['5', '6', '8', '9']],
        ['S3', ['1', '4', '7', '10']],
        ['S4', ['2', '5', '7', '8', '11']],
        ['S5', ['3', '6', '9', '12']],
        ['S6', ['10', '11']],
      ],
    },
  ],
  code: {
    pseudocode: `
      GREEDY-SET-COVER(X, F)
          U = X  // @start
          C = an empty set
          while U is not empty
              select S in F that maximizes |S ∩ U|  // @pick
              U = U - S  // @cover
              C = C ∪ {S}
          return C  // @done
    `,
    python: `
      def greedy_set_cover(x, family):
          left = set(x)  # @start
          chosen = []
          while left:
              s = max(family, key=lambda s: len(family[s] & left))  # @pick
              left -= family[s]  # @cover
              chosen.append(s)
          return chosen  # @done
    `,
  },
  run(input, trace) {
    const sets = input.subsets;
    // In natural order, so 2 comes before 10.
    const elements = [...new Set(sets.flatMap(([, members]) => members))].sort(
      natural,
    );
    const count = elements.length;
    const table = trace.add('F', {
      kind: 'table',
      label: 'F',
      initial: sets.map(([, members]) => [
        ...elements.map((x) => (members.includes(x) ? '•' : '')),
        '',
      ]),
      rowLabels: sets.map(([name]) => name),
      columnLabels: [...elements, 'new'],
    });
    trace.step(
      'start',
      `U, the elements still to cover, is all of X: ${count} element${count === 1 ? '' : 's'}. No subset is chosen yet.`,
    );

    const left = new Set(elements);
    const chosen: string[] = [];
    while (left.size > 0) {
      const gains = sets.map(
        ([, members]) => members.filter((x) => left.has(x)).length,
      );
      const best = gains.indexOf(Math.max(...gains));
      const [name, members] = sets[best]!;
      const tied = gains.filter(
        (g, k) => g === gains[best] && k !== best,
      ).length;
      trace.step(
        'pick',
        `${name} covers the most elements still in U, ${gains[best]}${tied === 0 ? '' : `, tied with ${tied} other${tied === 1 ? '' : 's'} given after it`}: choose it.`,
      );
      gains.forEach((g, k) =>
        table.set({
          cell: [k, count],
          value: chosen.includes(sets[k]![0]) ? '✓' : g,
        }),
      );
      // The members it would cover, the ones still in U.
      const fresh = members.filter((x) => left.has(x));
      table.highlight({
        cells: fresh.map(
          (x) => [best, elements.indexOf(x)] as [number, number],
        ),
      });
      for (const x of fresh) left.delete(x);
      chosen.push(name);
      trace.step(
        'cover',
        `Remove ${fresh.join(', ')} from U: ${left.size === 0 ? 'nothing is left' : `${left.size} element${left.size === 1 ? '' : 's'} left`}.`,
      );
      // Each element is settled once, in the row of the subset that
      // covered it.
      table.set({ cell: [best, count], value: '✓' }).settle({
        cells: fresh.map(
          (x) => [best, elements.indexOf(x)] as [number, number],
        ),
      });
    }
    const d = Math.max(...sets.map(([, members]) => members.length));
    const h = Array.from({ length: d }, (_, k) => 1 / (k + 1)).reduce(
      (a, b) => a + b,
      0,
    );
    trace.step(
      'done',
      `U is empty: ${chosen.length === 1 ? `the chosen subset, ${chosen[0]}, covers` : `the ${chosen.length} chosen subsets, ${chosen.join(', ')}, cover`} X. The largest subset has ${d} element${d === 1 ? '' : 's'}, so this cover is at most H(${d}) ≈ ${h.toFixed(2)} times the smallest.`,
    );
    return { results: [chosen.length] };
  },
});
