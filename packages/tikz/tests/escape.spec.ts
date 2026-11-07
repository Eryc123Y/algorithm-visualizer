import { describe, expect, it } from 'vitest';

import { texText } from '../src/index.ts';

describe('texText', () => {
  it('keeps letters, digits and plain punctuation', () => {
    expect(texText('insert 42 (left).')).toBe('insert 42 (left).');
    expect(texText('')).toBe('');
  });

  it('spells out LaTeX special characters', () => {
    expect(texText('\\ { } # $ % & _ ~ ^')).toBe(
      '\\textbackslash{} \\{ \\} \\# \\$ \\% \\& \\_ \\textasciitilde{} \\textasciicircum{}',
    );
  });

  it('spells out characters that OT1 fonts draw as others', () => {
    expect(texText('a<b>c|"d"')).toBe(
      'a\\textless{}b\\textgreater{}c\\textbar{}\\textquotedbl{}d\\textquotedbl{}',
    );
  });

  it('keeps ligature pairs apart', () => {
    expect(texText('a--b')).toBe('a-{}-b');
    expect(texText('---')).toBe('-{}-{}-');
    expect(texText("''")).toBe("'{}'");
    expect(texText(',,')).toBe(',{},');
    expect(texText('!`')).toBe('!{}`');
    expect(texText('a-b')).toBe('a-b');
  });

  it('keeps repeated spaces', () => {
    expect(texText('a  b')).toBe('a \\ b');
    expect(texText('a   b')).toBe('a \\ \\ b');
  });

  it('writes the symbols of algorithm figures as math', () => {
    expect(texText('∞')).toBe('\\ensuremath{\\infty}');
    expect(texText('∅')).toBe('\\ensuremath{\\emptyset}');
    expect(texText('d ≤ 7')).toBe('d \\ensuremath{\\le} 7');
    expect(texText('α→β')).toBe(
      '\\ensuremath{\\alpha}\\ensuremath{\\rightarrow}\\ensuremath{\\beta}',
    );
    expect(texText('−3')).toBe('\\ensuremath{-}3');
  });

  it('leaves other characters to the document', () => {
    expect(texText('Ä 中 é')).toBe('Ä 中 é');
    expect(texText('😀')).toBe('😀');
  });

  it('turns control characters into spaces', () => {
    expect(texText('a\nb\tc')).toBe('a b c');
  });

  it('never leaves an unescaped special character', () => {
    const all = Array.from({ length: 127 - 32 }, (_, k) =>
      String.fromCharCode(32 + k),
    ).join('');
    // Remove the commands the escaping writes; what is left is plain text.
    const left = texText(all)
      .replace(/\\[a-z]+\{\}/gi, '')
      .replace(/\\[{}#$%&_ ]/g, '')
      .replace(/\{\}/g, '');
    expect(left).not.toMatch(/[\\{}#$%&_~^<>|"]/);
  });
});
