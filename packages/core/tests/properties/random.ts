/**
 * Random choices for generated documents, driven by a list of numbers that
 * fast-check generates and shrinks. When the list runs out, choices go on
 * from a generator seeded by the list, so short lists still make long
 * documents, and shrinking replaces numbers with simpler ones (zeros).
 */
import type { Scalar } from '@algoviz/spec';

/** How many cases each property runs: FUZZ_RUNS=5000 for a deep run. */
export const RUNS = Number(process.env['FUZZ_RUNS'] ?? 60);

export class Dice {
  /** Multiplies the size of declared structures; set per document. */
  scale = 1;
  #k = 0;
  #seed: number;
  readonly #values: readonly number[];

  constructor(values: readonly number[]) {
    this.#values = values;
    this.#seed = values.reduce((h, v) => Math.imul(h ^ v, 0x9e3779b1), 1) >>> 0;
  }

  /** The next number: from the list, then from mulberry32. */
  #next(): number {
    const v = this.#values[this.#k++];
    if (v !== undefined) return v;
    let t = (this.#seed = (this.#seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** An integer in [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return this.#next() % n;
  }

  /** True with probability about p. */
  chance(p: number): boolean {
    return this.int(1000) < p * 1000;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  /**
   * A position in [0, n), or with probability `bad` one just past the
   * valid range, to exercise range errors.
   */
  index(n: number, bad = 0.04): number {
    if (n === 0 || this.chance(bad)) return n + this.int(2);
    return this.int(n);
  }

  /** A displayable value of any type, including awkward ones. */
  value(): Scalar {
    switch (this.int(10)) {
      case 0:
        return null;
      case 1:
        return this.chance(0.5);
      case 2:
        return this.pick([
          '',
          'a',
          'é',
          '🙂',
          'x'.repeat(40),
          '<&>"',
          'ab cd',
          '\u6570\u7ec4',
          'W'.repeat(12),
          '\u221e',
        ]);
      case 3:
        return this.pick([-0, -1, 0.5, 1e9, -12345.678, 2 ** 53, 123456789012]);
      default:
        return this.int(100) - 20;
    }
  }

  /** A fresh id, or with probability `dup` one from `used`. */
  id(used: readonly string[], prefix = 'n', dup = 0.03): string {
    if (used.length > 0 && this.chance(dup)) return this.pick(used);
    // Names that collide with JavaScript built-ins, or use punctuation.
    const odd = this.pick(['constructor', 'toString', 'a.b:c-d', '__x']);
    if (this.chance(0.1) && !used.includes(odd)) return odd;
    for (let k = used.length; ; k++)
      if (!used.includes(`${prefix}${k}`)) return `${prefix}${k}`;
  }
}
