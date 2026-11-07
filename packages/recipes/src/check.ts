/**
 * Input checks shared by recipes. Recipes reject inputs they cannot show
 * with a RangeError that says why, rather than failing later or making a
 * document that does not load.
 */
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
