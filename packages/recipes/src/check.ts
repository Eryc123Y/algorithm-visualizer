/**
 * Input checks shared by recipes. Recipes reject inputs they cannot show
 * with a RangeError that says why, rather than failing later or making a
 * document that does not load.
 */
import type { GraphInput } from './graphs.ts';

export function checkInteger(
  name: string,
  x: number,
  min: number,
  max: number,
): void {
  if (!Number.isInteger(x) || x < min || x > max)
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
}

export function checkIntegers(name: string, xs: readonly number[]): void {
  if (!xs.every(Number.isSafeInteger))
    throw new RangeError(`${name} must be integers`);
}

export function checkFinite(name: string, xs: readonly number[]): void {
  if (!xs.every(Number.isFinite))
    throw new RangeError(`${name} must be finite numbers`);
}

export function checkLength(
  name: string,
  xs: { readonly length: number },
  max: number,
): void {
  if (xs.length > max)
    throw new RangeError(`${name} may have at most ${max} entries`);
}

/** Node names become ids, so they must be short and use id characters. */
const NODE_NAME = /^[A-Za-z0-9_.:-]{1,24}$/;

/** Rejects graphs whose names or edges cannot be shown. */
export function checkGraph(g: GraphInput): void {
  const names = new Set<string>();
  for (const v of g.nodes) {
    if (!NODE_NAME.test(v))
      throw new RangeError(
        `Node name "${v}" must be 1 to 24 letters, digits or _ . : -`,
      );
    if (names.has(v)) throw new RangeError(`Node "${v}" is listed twice`);
    names.add(v);
  }
  for (const [from, to, weight] of g.edges) {
    for (const end of [from, to])
      if (!names.has(end))
        throw new RangeError(
          `Edge ${from}–${to} ends at "${end}", which is not a node`,
        );
    if (weight !== undefined && !Number.isFinite(weight))
      throw new RangeError(
        `Edge ${from}–${to} has a weight that is not a finite number`,
      );
  }
}
