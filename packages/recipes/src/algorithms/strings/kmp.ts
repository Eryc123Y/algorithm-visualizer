/**
 * Knuth–Morris–Pratt (ADR 0037; CLRS 32.4). The prefix function π is
 * computed first, on P against itself: π[q] is the length of the longest
 * proper prefix of P[0 .. q] that is also its suffix. The matcher then
 * reads the text once; after a mismatch with q characters matched, the
 * pattern moves so that its first π[q − 1] characters, known to match,
 * stay under the text.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import {
  declareMatch,
  MatchInput,
  record,
  shiftsFound,
  shiftsFoundZh,
} from './common.ts';

export const kmp = defineAlgorithm({
  id: 'kmp',
  title: { en: 'Knuth–Morris–Pratt', zh: 'Knuth–Morris–Pratt 算法' },
  topic: 'strings',
  summary: {
    en: 'Computes the prefix function of the pattern, then reads the text once: after a mismatch the pattern moves on by as much as the prefix function allows, keeping the characters known to match.',
    zh: '先计算模式的前缀函数，再把文本读一遍：失配后，按前缀函数允许的最大距离向前移动模式，保留已知匹配的字符。',
  },
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
      label: trace.say({ en: 'P against itself', zh: 'P 与自身比较' }),
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
        ? {
            en: 'π[0] is 0: a single character has no shorter prefix that is also its suffix. The pattern has one character, so π is done.',
            zh: 'π[0] 为 0：单个字符没有更短的、同时也是后缀的前缀。模式只有一个字符，所以 π 已经算完。',
          }
        : {
            en: 'π[0] is 0: a single character has no shorter prefix that is also its suffix. Now slide P along itself to find π[1] to π[m − 1].',
            zh: 'π[0] 为 0：单个字符没有更短的、同时也是后缀的前缀。现在让 P 沿着自身滑动，求出 π[1] 到 π[m − 1]。',
          },
    );
    piArray.set({ index: 0, value: 0 }).settle({ index: 0 });
    let k = 0;
    for (let q = 1; q < m; q++) {
      for (;;) {
        trace.step('pi-compare', {
          en: `For π[${q}]: with ${k} character${k === 1 ? '' : 's'} known to match, compare P[${k}] = ${pattern[k]} with P[${q}] = ${pattern[q]}.`,
          zh: `求 π[${q}]：已知有 ${k} 个字符匹配，比较 P[${k}] = ${pattern[k]} 和 P[${q}] = ${pattern[q]}。`,
        });
        self.align({ shift: q - k, matched: k }).check({ j: k });
        if (k === 0 || pattern[k] === pattern[q]) break;
        const back = pi[k - 1]!;
        trace.step('pi-back', {
          en: `They differ: fall back to k = π[${k - 1}] = ${back}, the longest prefix still known to match.`,
          zh: `它们不同：退回到 k = π[${k - 1}] = ${back}，即仍然已知匹配的最长前缀。`,
        });
        k = back;
        self.align({ shift: q - k, matched: k });
      }
      if (pattern[k] === pattern[q]) k++;
      pi.push(k);
      trace.step(
        'pi-set',
        k === 0
          ? {
              en: `No prefix of P matches a suffix of P[0 .. ${q}]: π[${q}] is 0.`,
              zh: `P 的前缀都不与 P[0 .. ${q}] 的后缀匹配：π[${q}] 为 0。`,
            }
          : {
              en: `The prefix of length ${k} is the longest that is also a suffix of P[0 .. ${q}]: π[${q}] is ${k}.`,
              zh: `长度为 ${k} 的前缀是同时也是 P[0 .. ${q}] 的后缀的最长前缀：π[${q}] 为 ${k}。`,
            },
      );
      piArray.set({ index: q, value: k }).settle({ index: q });
    }
    // The matcher, on the text.
    const found: number[] = [];
    let matched = 0;
    for (let i = 0; i < n; i++) {
      for (;;) {
        trace.step('compare', {
          en: `Read T[${i}] = ${text[i]}, with ${matched} character${matched === 1 ? '' : 's'} matched: compare it with P[${matched}] = ${pattern[matched]}.`,
          zh: `读 T[${i}] = ${text[i]}，已匹配 ${matched} 个字符：把它和 P[${matched}] = ${pattern[matched]} 比较。`,
        });
        // The alignment this comparison is made in, then the comparison.
        T.align({ shift: i - matched, matched })
          .pointer({ name: 'i', index: i })
          .check({ j: matched });
        if (matched === 0 || pattern[matched] === text[i]) break;
        const back = pi[matched - 1]!;
        trace.step('back', {
          en: `They differ: keep the first π[${matched - 1}] = ${back} characters, which still match, and move the pattern to shift ${i - back}.`,
          zh: `它们不同：保留仍然匹配的前 π[${matched - 1}] = ${back} 个字符，把模式移到偏移 ${i - back}。`,
        });
        piArray.highlight({ indices: [matched - 1] });
        matched = back;
        T.align({ shift: i - matched, matched });
      }
      if (pattern[matched] === text[i]) matched++;
      if (matched === m) {
        const s = i - m + 1;
        const next = pi[m - 1]!;
        trace.step('found', {
          en: `All ${m} characters match: ${s} is a valid shift. Go on with π[${m - 1}] = ${next} characters matched.`,
          zh: `${m} 个字符全部匹配：${s} 是一个有效偏移。继续，已匹配 π[${m - 1}] = ${next} 个字符。`,
        });
        record(handles, s, m, found);
        matched = next;
      }
    }
    trace.step('done', {
      en: `The text is read once: ${shiftsFound(found)}.`,
      zh: `文本读完一遍：${shiftsFoundZh(found)}。`,
    });
    T.pointer({ name: 'i', index: null });
    return { results: found };
  },
});
