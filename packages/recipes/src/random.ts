/**
 * Random choices for randomized algorithms, from a seed in the input, so
 * that the same input always gives the same trace (ADR 0018's
 * determinism). The generator is mulberry32: small, fast and well mixed
 * for the few hundred draws a run makes; it is not for cryptography.
 */
import { z } from 'zod';

/** The largest seed: any 32-bit unsigned integer. */
export const MAX_SEED = 2 ** 32 - 1;

/** The seed field of a randomized module's input, 1 by default. */
export const seedField = z
  .int()
  .min(0)
  .max(MAX_SEED)
  .default(1)
  .describe(
    'Seeds the random choices: the same seed gives the same run, another seed most likely a different one. 1 by default.',
  );

export interface Random {
  /** A number in [0, 1). */
  next(): number;
  /** An integer from `lo` to `hi`, both included, each equally likely. */
  int(lo: number, hi: number): number;
}

/** A generator whose draws depend only on `seed`. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
  };
}
