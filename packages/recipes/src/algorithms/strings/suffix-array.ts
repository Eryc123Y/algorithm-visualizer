/**
 * The suffix array and its LCP array (CLRS 32.5), by prefix doubling and
 * then Kasai's method. Each suffix is ranked by its first character; then,
 * while two suffixes share a rank, each one pairs its rank with that of the
 * suffix k places on, which ranks its first 2k characters, and sorting the
 * pairs gives the new ranks. When every rank differs, the suffixes in rank
 * order are the suffix array. The LCP array then follows in one pass over
 * the text: the common prefix of a suffix with the one before it in order
 * is at most one shorter than that of the previous suffix in the text.
 *
 * A table holds a row per suffix in the current order: its start i, the
 * suffix, its rank and its pair, and at the end its LCP with the row above.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** Most characters: a table of 16 rows. */
export const MAX_SUFFIX_TEXT = 16;

const pairText = ([a, b]: readonly [number, number]) => `(${a}, ${b})`;

/** Dense ranks from 1 of `keys`, ordered by `compare`. */
function denseRanks<T>(keys: readonly T[], compare: (x: T, y: T) => number) {
  const order = [...keys.keys()].sort(
    (x, y) => compare(keys[x]!, keys[y]!) || x - y,
  );
  const rank = keys.map(() => 0);
  order.forEach((i, k) => {
    const prev = order[k - 1];
    rank[i] =
      k === 0
        ? 1
        : compare(keys[prev!]!, keys[i]!) === 0
          ? rank[prev!]!
          : rank[prev!]! + 1;
  });
  return { order, rank };
}

const byPair = (x: readonly [number, number], y: readonly [number, number]) =>
  x[0] - y[0] || x[1] - y[1];

export const suffixArray = defineAlgorithm({
  id: 'suffix-array',
  title: { en: 'Suffix array', zh: '后缀数组' },
  topic: 'strings',
  summary: {
    en: 'Sorts the suffixes of a text by prefix doubling, ranking them by their first 1, 2, 4, … characters, then finds the longest common prefix of each with the one before it by Kasai’s method.',
    zh: '用倍增法给文本的后缀排序，依次按前 1、2、4、…… 个字符给它们排秩，再用 Kasai 的方法求出每个后缀与前一个后缀的最长公共前缀。',
  },
  input: z.strictObject({
    text: z
      .string()
      .regex(
        new RegExp(`^[A-Za-z0-9]{1,${MAX_SUFFIX_TEXT}}$`),
        `The text is 1 to ${MAX_SUFFIX_TEXT} letters and digits`,
      )
      .describe(
        `The text: 1 to ${MAX_SUFFIX_TEXT} letters and digits, e.g. "banana".`,
      ),
  }),
  main: 'text',
  examples: [{ text: 'banana' }],
  code: {
    pseudocode: `
      SUFFIX-ARRAY(T, n)
          r[i] = the rank of T[i] among the characters of T, for each i  // @start
          k = 1
          while two suffixes share a rank
              p[i] = (r[i], r[i + k]), with r[i + k] = 0 past the end, for each i  // @pairs
              r[i] = the rank of p[i] among the distinct pairs, in sorted order, for each i  // @sort
              k = 2k
          SA = the starts of the suffixes in order of r  // @order
          h = 0
          for i = 0 to n - 1  // @lcp
              if r[i] > 1
                  j = the start of the suffix just before suffix i in SA
                  while i + h < n and j + h < n and T[i + h] = T[j + h]
                      h = h + 1
                  lcp[r[i]] = h
                  if h > 0
                      h = h - 1
          return SA and lcp  // @done
    `,
    python: `
      def suffix_array(t):
          n = len(t)
          chars = sorted(set(t))
          r = [chars.index(c) + 1 for c in t]  # @start
          k = 1
          while len(set(r)) < n:
              p = [(r[i], r[i + k] if i + k < n else 0) for i in range(n)]  # @pairs
              pairs = sorted(set(p))
              r = [pairs.index(x) + 1 for x in p]  # @sort
              k *= 2
          sa = sorted(range(n), key=lambda i: r[i])  # @order
          lcp = [0] * n
          h = 0
          for i in range(n):  # @lcp
              if r[i] > 1:
                  j = sa[r[i] - 2]
                  while i + h < n and j + h < n and t[i + h] == t[j + h]:
                      h += 1
                  lcp[r[i] - 1] = h
                  if h > 0:
                      h -= 1
          return sa, lcp  # @done
    `,
  },
  run(input, trace) {
    const t = input.text;
    const n = t.length;
    const first = denseRanks([...t], (x, y) => (x < y ? -1 : x > y ? 1 : 0));
    let rank = first.rank;
    let order = [...t].map((_, i) => i);
    const table = trace.add('S', {
      kind: 'table',
      label: trace.say({ en: 'Suffixes', zh: '后缀' }),
      initial: order.map((i) => [i, t.slice(i), '', '', '']),
      columnLabels: [
        'i',
        trace.say({ en: 'suffix', zh: '后缀' }),
        trace.say({ en: 'rank', zh: '秩' }),
        trace.say({ en: 'pair', zh: '对' }),
        'lcp',
      ],
    });
    const chars = [...new Set(t)].sort();
    trace.step('start', {
      en: `Rank each suffix by its first character: ${chars.map((c, k) => `${c} = ${k + 1}`).join(', ')}.`,
      zh: `按第一个字符给每个后缀排秩：${chars.map((c, k) => `${c} = ${k + 1}`).join(', ')}。`,
    });
    order.forEach((i, row) => table.set({ cell: [row, 2], value: rank[i]! }));

    const distinct = () => new Set(rank).size;
    for (let k = 1; distinct() < n; k *= 2) {
      const pairs = rank.map((r, i): [number, number] => [r, rank[i + k] ?? 0]);
      trace.step(
        'pairs',
        {
          en: `Pair each suffix's rank with the rank of the suffix ${k} place${k === 1 ? '' : 's'} on, 0 past the end: the pair orders the suffixes by their first ${2 * k} characters.`,
          zh: `把每个后缀的秩与它后面第 ${k} 个位置上的后缀的秩配成一对，超出末尾的记为 0：这一对按前 ${2 * k} 个字符给后缀排序。`,
        },
        { vars: { k } },
      );
      order.forEach((i, row) =>
        table.set({ cell: [row, 3], value: pairText(pairs[i]!) }),
      );
      const next = denseRanks(pairs, byPair);
      [rank, order] = [next.rank, next.order];
      const tied = n - distinct();
      trace.step(
        'sort',
        {
          en: `Sort the suffixes by their pairs and number the distinct pairs from 1: the new ranks order the suffixes by their first ${2 * k} characters${tied === 0 ? ', and no two are tied' : ', but some still share a rank'}.`,
          zh: `按这些对给后缀排序，再从 1 开始给不同的对编号：新的秩按前 ${2 * k} 个字符给后缀排序${tied === 0 ? '，没有两个并列' : '，但仍有一些后缀的秩相同'}。`,
        },
        { vars: { k } },
      );
      order.forEach((i, row) =>
        table
          .set({ cell: [row, 0], value: i })
          .set({ cell: [row, 1], value: t.slice(i) })
          .set({ cell: [row, 2], value: rank[i]! })
          .set({ cell: [row, 3], value: pairText(pairs[i]!) }),
      );
    }

    // With every first character different, no round sorted the rows.
    const sa = [...rank.keys()].sort((x, y) => rank[x]! - rank[y]!);
    const moved = sa.some((i, row) => order[row] !== i);
    trace.step('order', {
      en: `Every rank differs, so ${moved ? 'sorting by rank puts the suffixes' : 'the suffixes are'} in order: the column i, top to bottom, is the suffix array, ${sa.join(' ')}.`,
      zh: `所有秩都不同，所以${moved ? '按秩排序后，后缀就' : '后缀已经'}有序了：i 这一列从上到下就是后缀数组 ${sa.join(' ')}。`,
    });
    if (moved)
      sa.forEach((i, row) =>
        table
          .set({ cell: [row, 0], value: i })
          .set({ cell: [row, 1], value: t.slice(i) })
          .set({ cell: [row, 2], value: rank[i]! }),
      );
    table.settle({ cells: sa.map((_, row) => [row, 0] as [number, number]) });

    const lcp = sa.map(() => 0);
    let h = 0;
    for (let i = 0; i < n; i++) {
      const row = rank[i]! - 1;
      if (row === 0) {
        trace.step(
          'lcp',
          {
            en: `Suffix ${i}, ${t.slice(i)}, comes first in order: no suffix is above it.`,
            zh: `后缀 ${i}（${t.slice(i)}）排在最前面：它上面没有后缀。`,
          },
          { vars: { i, h } },
        );
        table.set({ cell: [0, 4], value: '–' }).highlight({ cells: [[0, 1]] });
        continue;
      }
      const j = sa[row - 1]!;
      const from = h;
      while (i + h < n && j + h < n && t[i + h] === t[j + h]) h++;
      lcp[row] = h;
      trace.step(
        'lcp',
        {
          en: `Suffix ${i}, ${t.slice(i)}, and suffix ${j} above it, ${t.slice(j)}, share ${h} character${h === 1 ? '' : 's'}${from > 0 ? `; the first ${from === 1 ? 'character was' : `${from} were`} known from suffix ${i - 1}, whose common prefix was one longer` : ''}.`,
          zh: `后缀 ${i}（${t.slice(i)}）与它上面的后缀 ${j}（${t.slice(j)}）有 ${h} 个公共字符${from > 0 ? `；其中前 ${from} 个从后缀 ${i - 1} 已知，它的公共前缀长一个字符` : ''}。`,
        },
        { vars: { i, h } },
      );
      table.set({ cell: [row, 4], value: h }).highlight({
        cells: [
          [row - 1, 1],
          [row, 1],
        ],
      });
      if (h > 0) h--;
    }
    trace.step('done', {
      en: 'The lcp column holds the longest common prefix of each suffix with the one above it in the suffix array.',
      zh: 'lcp 这一列是每个后缀与后缀数组中它上面那个后缀的最长公共前缀的长度。',
    });
    table.settle({ cells: sa.map((_, row) => [row, 4] as [number, number]) });
    return { results: sa };
  },
});
