/**
 * A whole number with commas between groups of three digits, as
 * `toLocaleString('en')` writes it, without Intl, which QuickJS (the Typst
 * plugin and the standalone command) does not have.
 */
export const thousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
