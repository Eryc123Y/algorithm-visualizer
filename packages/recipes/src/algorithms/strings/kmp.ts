/**
 * Knuth–Morris–Pratt (ADR 0037; CLRS 32.4). The prefix function π is
 * computed first, on P against itself: π[q] is the length of the longest
 * proper prefix of P[0 .. q] that is also its suffix. The matcher then
 * reads the text once; after a mismatch with q characters matched, the
 * pattern moves so that its first π[q − 1] characters, known to match,
 * stay under the text.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { declareMatch, MatchInput, record, shiftsFound } from './common.ts';

export const kmp = defineAlgorithm({
  id: 'kmp',
  title: 'Knuth–Morris–Pratt',
  topic: 'strings',
  summary:
    'Computes the prefix function of the pattern, then reads the text once: after a mismatch the pattern moves on by as much as the prefix function allows, keeping the characters known to match.',
  input: MatchInput,
  examples: [
    { text: 'bacbabababacaab', pattern: 'ababaca' },
    { text: 'abababcabababab', pattern: 'abab' },
  ],
  code: {
    pseudocode: `
      COMPUTE-PREFIX-FUNCTION(P)
          m = P.length
          π[0] = 0  // @pi-start
          k = 0
          for q = 1 to m - 1
              while k > 0 and P[k] ≠ P[q]  // @pi-compare
                  k = π[k - 1]  // @pi-back
              if P[k] == P[q]
                  k = k + 1
              π[q] = k  // @pi-set
          return π

      KMP-MATCHER(T, P)
          n = T.length
          m = P.length
          π = COMPUTE-PREFIX-FUNCTION(P)
          S = an empty list
          q = 0
          for i = 0 to n - 1
              while q > 0 and P[q] ≠ T[i]  // @compare
                  q = π[q - 1]  // @back
              if P[q] == T[i]
                  q = q + 1
              if q == m
                  append i - m + 1 to S  // @found
                  q = π[q - 1]
          return S  // @done
    `,
    python: `
      def prefix_function(P):
          m = len(P)
          pi = [0] * m  # @pi-start
          k = 0
          for q in range(1, m):
              while k > 0 and P[k] != P[q]:  # @pi-compare
                  k = pi[k - 1]  # @pi-back
              if P[k] == P[q]:
                  k += 1
              pi[q] = k  # @pi-set
          return pi

      def kmp_matcher(T, P):
          n, m = len(T), len(P)
          pi = prefix_function(P)
          shifts, q = [], 0
          for i in range(n):
              while q > 0 and P[q] != T[i]:  # @compare
                  q = pi[q - 1]  # @back
              if P[q] == T[i]:
                  q += 1
              if q == m:
                  shifts.append(i - m + 1)  # @found
                  q = pi[q - 1]
          return shifts  # @done
    `,
  },
  run({ text, pattern }, trace) {
    const handles = declareMatch(trace, text, pattern);
    const { T } = handles;
    const [n, m] = [text.length, pattern.length];
    // P against itself, and π, beside the text.
    const self = trace.add('P', {
      kind: 'array',
      place: 'side',
      label: 'P against itself',
      initial: [...pattern],
      pattern: [...pattern],
      shift: m > 1 ? 1 : 0,
    });
    const piArray = trace.add('pi', {
      kind: 'array',
      place: 'side',
      label: 'π',
      // Blank until each value is known.
      initial: Array.from({ length: m }, () => ''),
    });
    const pi: number[] = [0];
    trace.step(
      'pi-start',
      m === 1
        ? 'π[0] is 0: a single character has no shorter prefix that is also its suffix. The pattern has one character, so π is done.'
        : 'π[0] is 0: a single character has no shorter prefix that is also its suffix. Now slide P along itself to find π[1] to π[m − 1].',
    );
    piArray.set({ index: 0, value: 0 }).settle({ index: 0 });
    let k = 0;
    for (let q = 1; q < m; q++) {
      for (;;) {
        trace.step(
          'pi-compare',
          `For π[${q}]: with ${k} character${k === 1 ? '' : 's'} known to match, compare P[${k}] = ${pattern[k]} with P[${q}] = ${pattern[q]}.`,
        );
        self.align({ shift: q - k, matched: k }).check({ j: k });
        if (k === 0 || pattern[k] === pattern[q]) break;
        const back = pi[k - 1]!;
        trace.step(
          'pi-back',
          `They differ: fall back to k = π[${k - 1}] = ${back}, the longest prefix still known to match.`,
        );
        k = back;
        self.align({ shift: q - k, matched: k });
      }
      if (pattern[k] === pattern[q]) k++;
      pi.push(k);
      trace.step(
        'pi-set',
        k === 0
          ? `No prefix of P matches a suffix of P[0 .. ${q}]: π[${q}] is 0.`
          : `The prefix of length ${k} is the longest that is also a suffix of P[0 .. ${q}]: π[${q}] is ${k}.`,
      );
      piArray.set({ index: q, value: k }).settle({ index: q });
    }
    // The matcher, on the text.
    const found: number[] = [];
    let matched = 0;
    for (let i = 0; i < n; i++) {
      for (;;) {
        trace.step(
          'compare',
          `Read T[${i}] = ${text[i]}, with ${matched} character${matched === 1 ? '' : 's'} matched: compare it with P[${matched}] = ${pattern[matched]}.`,
        );
        // The alignment this comparison is made in, then the comparison.
        T.align({ shift: i - matched, matched })
          .pointer({ name: 'i', index: i })
          .check({ j: matched });
        if (matched === 0 || pattern[matched] === text[i]) break;
        const back = pi[matched - 1]!;
        trace.step(
          'back',
          `They differ: keep the first π[${matched - 1}] = ${back} characters, which still match, and move the pattern to shift ${i - back}.`,
        );
        piArray.highlight({ indices: [matched - 1] });
        matched = back;
        T.align({ shift: i - matched, matched });
      }
      if (pattern[matched] === text[i]) matched++;
      if (matched === m) {
        const s = i - m + 1;
        const next = pi[m - 1]!;
        trace.step(
          'found',
          `All ${m} characters match: ${s} is a valid shift. Go on with π[${m - 1}] = ${next} characters matched.`,
        );
        record(handles, s, m, found);
        matched = next;
      }
    }
    trace.step('done', `The text is read once: ${shiftsFound(found)}.`);
    T.pointer({ name: 'i', index: null });
    return { results: found };
  },
});
