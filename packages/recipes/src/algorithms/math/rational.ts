/**
 * Exact rational numbers, as a reduced fraction of big integers with a
 * positive denominator, for the steps of LUP decomposition: an integer
 * matrix gives fractions, and decimals would hide whether a pivot is 0.
 */

export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

const abs = (x: bigint): bigint => (x < 0n ? -x : x);

function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [abs(a), abs(b)];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** n / d, reduced, with d > 0. */
export function rational(n: bigint, d = 1n): Rational {
  if (d === 0n) throw new RangeError('A fraction cannot have denominator 0');
  const g = gcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export const fromInt = (x: number): Rational => rational(BigInt(x));

export const add = (a: Rational, b: Rational) =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n);

export const isZero = (a: Rational) => a.n === 0n;

/** −1, 0 or 1 as |a| is less than, equal to or greater than |b|. */
export const compareAbs = (a: Rational, b: Rational) => {
  const [x, y] = [abs(a.n) * b.d, abs(b.n) * a.d];
  return x < y ? -1 : x > y ? 1 : 0;
};

/** As the figures write it: `3`, `−2/5`. */
export function show(a: Rational): string {
  const text = a.d === 1n ? String(abs(a.n)) : `${abs(a.n)}/${a.d}`;
  return a.n < 0n ? `−${text}` : text;
}

/** Reads what `show` writes. */
export function parse(text: string): Rational {
  const match = /^(−?)(\d+)(?:\/(\d+))?$/.exec(text);
  if (match === null) throw new RangeError(`Not a fraction: "${text}"`);
  const n = BigInt(match[2]!);
  return rational(match[1] === '' ? n : -n, BigInt(match[3] ?? '1'));
}
