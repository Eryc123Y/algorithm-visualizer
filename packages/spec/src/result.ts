/**
 * A value that is either a success or a failure.
 *
 * Validation of LLM-generated input fails routinely, so failures are values
 * the caller must handle rather than exceptions it may forget to catch.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
