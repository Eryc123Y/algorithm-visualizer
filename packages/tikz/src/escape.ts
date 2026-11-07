/**
 * Text of a scene as LaTeX source (ADR 0027). The document typesets it in
 * its own fonts, so every character must mean itself in any engine
 * (pdfLaTeX, LuaLaTeX, XeLaTeX) and any font encoding (OT1, T1, TU):
 *
 * - LaTeX's special characters become the commands that print them;
 * - quotes stay straight, and characters that form ligatures in TeX fonts
 *   (`--`, `,,`) are kept apart with `{}`;
 * - spaces after the first of a run are kept with `\ `;
 * - symbols that algorithms show, such as `∞` and `∅`, become math
 *   commands, which every engine and encoding has;
 * - any other character is written as it is, in UTF-8, for the document's
 *   fonts to draw, as it would be in the document's own text.
 */

/** LaTeX's special characters, and characters OT1 fonts draw as others. */
const SPECIAL: Readonly<Record<string, string>> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '|': '\\textbar{}',
  '"': '\\textquotedbl{}',
  // Straight, as typed: TeX fonts turn these into curly quotes.
  "'": '\\textquotesingle{}',
  '`': '\\textasciigrave{}',
};

const math = (command: string) => `\\ensuremath{${command}}`;

/** Symbols that an algorithm figure may show, as math commands. */
const SYMBOLS: Readonly<Record<string, string>> = {
  '∞': math('\\infty'),
  '∅': math('\\emptyset'),
  '−': math('-'),
  '±': math('\\pm'),
  '×': math('\\times'),
  '÷': math('\\div'),
  '·': math('\\cdot'),
  '≤': math('\\le'),
  '≥': math('\\ge'),
  '≠': math('\\ne'),
  '≈': math('\\approx'),
  '∈': math('\\in'),
  '∉': math('\\notin'),
  '⊥': math('\\bot'),
  '√': math('\\surd'),
  '←': math('\\leftarrow'),
  '→': math('\\rightarrow'),
  '↑': math('\\uparrow'),
  '↓': math('\\downarrow'),
  '↔': math('\\leftrightarrow'),
  '…': '\\ldots{}',
  '–': '\\textendash{}',
  '—': '\\textemdash{}',
  '‘': '\\textquoteleft{}',
  '’': '\\textquoteright{}',
  '“': '\\textquotedblleft{}',
  '”': '\\textquotedblright{}',
  ...Object.fromEntries(
    [
      ['α', 'alpha'],
      ['β', 'beta'],
      ['γ', 'gamma'],
      ['δ', 'delta'],
      ['ε', 'varepsilon'],
      ['ζ', 'zeta'],
      ['η', 'eta'],
      ['θ', 'theta'],
      ['ι', 'iota'],
      ['κ', 'kappa'],
      ['λ', 'lambda'],
      ['μ', 'mu'],
      ['ν', 'nu'],
      ['ξ', 'xi'],
      ['π', 'pi'],
      ['ρ', 'rho'],
      ['σ', 'sigma'],
      ['τ', 'tau'],
      ['υ', 'upsilon'],
      ['φ', 'varphi'],
      ['χ', 'chi'],
      ['ψ', 'psi'],
      ['ω', 'omega'],
      ['Γ', 'Gamma'],
      ['Δ', 'Delta'],
      ['Θ', 'Theta'],
      ['Λ', 'Lambda'],
      ['Ξ', 'Xi'],
      ['Π', 'Pi'],
      ['Σ', 'Sigma'],
      ['Υ', 'Upsilon'],
      ['Φ', 'Phi'],
      ['Ψ', 'Psi'],
      ['Ω', 'Omega'],
    ].map(([char, name]) => [char!, math(`\\${name!}`)]),
  ),
};

/**
 * Characters that join into a ligature with a following one of these:
 * `--` and `---` into dashes, and `,,` into a low quote in T1. Quotes are
 * commands, so they join nothing.
 */
const LIGATURE = new Set(['-', ',']);

/** A scene's text as LaTeX source that prints exactly that text. */
export function texText(text: string): string {
  let out = '';
  let previous = '';
  for (const raw of text) {
    // Control characters, such as line breaks, show as spaces.
    const char = raw < ' ' ? ' ' : raw;
    if (LIGATURE.has(previous) && LIGATURE.has(char)) out += '{}';
    out +=
      char === ' ' && previous === ' '
        ? '\\ '
        : (SPECIAL[char] ?? SYMBOLS[char] ?? char);
    previous = char;
  }
  return out;
}
