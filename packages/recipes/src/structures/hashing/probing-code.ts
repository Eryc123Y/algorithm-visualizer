/**
 * The code of HASH-INSERT and HASH-SEARCH, which every open-addressing
 * table shares but for the line that computes the slot q of probe i.
 */
import { listing } from '../../snippet.ts';

/** The probe line in each language, without its anchor. */
export interface ProbeLine {
  readonly pseudocode: string;
  readonly python: string;
  /** Python lines before the loop, such as a second hash function. */
  readonly pythonSetup?: string;
}

/** HASH-INSERT and HASH-SEARCH with `probe` as their probe line. */
export function probingCode(probe: ProbeLine) {
  const setup =
    probe.pythonSetup === undefined ? '' : `\n        ${probe.pythonSetup}`;
  return {
    insert: listing('insert', {
      pseudocode: `
        HASH-INSERT(T, k)
            for i = 0 to m - 1
                ${probe.pseudocode}  // @probe
                if T[q] == NIL
                    T[q] = k  // @store
                    return q
            error "hash table overflow"
      `,
      python: `
        def insert(t, k):
            m = len(t)${setup.replaceAll('\n        ', '\n            ')}
            for i in range(m):
                ${probe.python}  # @probe
                if t[q] is None:
                    t[q] = k  # @store
                    return q
            raise OverflowError('hash table overflow')
      `,
    }),
    search: listing('search', {
      pseudocode: `
        HASH-SEARCH(T, k)
            for i = 0 to m - 1
                ${probe.pseudocode}  // @probe
                if T[q] == k
                    return q  // @found
                if T[q] == NIL
                    return NIL  // @missing
            return NIL  // @exhausted
      `,
      python: `
        def search(t, k):
            m = len(t)${setup.replaceAll('\n        ', '\n            ')}
            for i in range(m):
                ${probe.python}  # @probe
                if t[q] == k:
                    return q  # @found
                if t[q] is None:
                    return None  # @missing
            return None  # @exhausted
      `,
    }),
  };
}
