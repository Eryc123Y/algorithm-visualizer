/** Number formatting shared by the painter and the outline writer. */

/** Rounds to two decimals and drops trailing zeros. */
export const num = (n: number): string => String(Math.round(n * 100) / 100);
