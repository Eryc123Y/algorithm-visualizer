/**
 * The naive string matcher (ADR 0037; CLRS 32.1): the pattern is tried at
 * every shift, its characters compared with the text from the left until
 * one differs or all match.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import {
  declareMatch,
  MatchInput,
  record,
  shiftsFound,
  shiftsFoundZh,
} from './common.ts';

export const naiveStringMatcher = defineAlgorithm({
  id: 'naive-string-matcher',
  title: { en: 'Naive string matching', zh: '朴素字符串匹配' },
  topic: 'strings',
  summary: {
    en: 'Tries the pattern at every shift along the text, comparing characters from the left until one differs or the whole pattern matches.',
    zh: '在文本的每个偏移处尝试模式，从左往右比较字符，直到出现不同的字符或者整个模式都匹配。',
  },
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
      trace.step('shift', {
        en: `Try shift ${s}: the pattern starts under text position ${s}.`,
        zh: `尝试偏移 ${s}：模式从文本的位置 ${s} 开始对齐。`,
      });
      T.align({ shift: s }).pointer({ name: 's', index: s });
      let j = 0;
      for (; j < m; j++) {
        const [p, t] = [pattern[j]!, text[s + j]!];
        trace.step(
          'compare',
          p === t
            ? {
                en: `P[${j}] and T[${s + j}] are both ${p}: they match${j === m - 1 ? ', and so does the whole pattern' : ''}.`,
                zh: `P[${j}] 和 T[${s + j}] 都是 ${p}：它们匹配${j === m - 1 ? '，整个模式也匹配了' : ''}。`,
              }
            : {
                en: `P[${j}] is ${p} but T[${s + j}] is ${t}: shift ${s} is not valid.`,
                zh: `P[${j}] 是 ${p}，但 T[${s + j}] 是 ${t}：偏移 ${s} 无效。`,
              },
        );
        T.check({ j });
        if (p !== t) break;
      }
      if (j === m) {
        trace.step('found', {
          en: `All ${m} characters match: ${s} is a valid shift.`,
          zh: `${m} 个字符全部匹配：${s} 是一个有效偏移。`,
        });
        record(handles, s, m, found);
      }
    }
    trace.step('done', {
      en: `Every shift from 0 to ${n - m} tried: ${shiftsFound(found)}.`,
      zh: `从 0 到 ${n - m} 的每个偏移都试过了：${shiftsFoundZh(found)}。`,
    });
    T.pointer({ name: 's', index: null });
    return { results: found };
  },
});
