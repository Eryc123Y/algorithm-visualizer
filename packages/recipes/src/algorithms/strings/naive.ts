/**
 * The naive string matcher (ADR 0037; CLRS 32.1): the pattern is tried at
 * every shift, its characters compared with the text from the left until
 * one differs or all match.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { declareMatch, MatchInput, record, shiftsFound } from './common.ts';

export const naiveStringMatcher = defineAlgorithm({
  id: 'naive-string-matcher',
  title: 'Naive string matching',
  topic: 'strings',
  summary:
    'Tries the pattern at every shift along the text, comparing characters from the left until one differs or the whole pattern matches.',
  input: MatchInput,
  examples: [
    { text: 'acaabc', pattern: 'aab' },
    { text: 'aaaaa', pattern: 'aa' },
  ],
  code: {
    pseudocode: `
      NAIVE-STRING-MATCHER(T, P)
          n = T.length
          m = P.length
          S = an empty list
          for s = 0 to n - m  // @shift
              j = 0
              while j < m and P[j] == T[s + j]  // @compare
                  j = j + 1
              if j == m
                  append s to S  // @found
          return S  // @done
    `,
    python: `
      def naive_matcher(T, P):
          n, m = len(T), len(P)
          shifts = []
          for s in range(n - m + 1):  # @shift
              j = 0
              while j < m and P[j] == T[s + j]:  # @compare
                  j += 1
              if j == m:
                  shifts.append(s)  # @found
          return shifts  # @done
    `,
  },
  run({ text, pattern }, trace) {
    const handles = declareMatch(trace, text, pattern);
    const { T } = handles;
    const [n, m] = [text.length, pattern.length];
    const found: number[] = [];
    for (let s = 0; s <= n - m; s++) {
      trace.step(
        'shift',
        `Try shift ${s}: the pattern starts under text position ${s}.`,
      );
      T.align({ shift: s }).pointer({ name: 's', index: s });
      let j = 0;
      for (; j < m; j++) {
        const [p, t] = [pattern[j]!, text[s + j]!];
        trace.step(
          'compare',
          p === t
            ? `P[${j}] and T[${s + j}] are both ${p}: they match${j === m - 1 ? ', and so does the whole pattern' : ''}.`
            : `P[${j}] is ${p} but T[${s + j}] is ${t}: shift ${s} is not valid.`,
        );
        T.check({ j });
        if (p !== t) break;
      }
      if (j === m) {
        trace.step(
          'found',
          `All ${m} characters match: ${s} is a valid shift.`,
        );
        record(handles, s, m, found);
      }
    }
    trace.step(
      'done',
      `Every shift from 0 to ${n - m} tried: ${shiftsFound(found)}.`,
    );
    T.pointer({ name: 's', index: null });
    return { results: found };
  },
});
