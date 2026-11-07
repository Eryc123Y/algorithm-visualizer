import { describe, expect, it } from 'vitest';

import type { Figure, FigureSeries } from '@algoviz/svg';

import { DEFAULT_PATTERN, figureFiles, patternProblem } from '../src/index.ts';

const figure = (frame: number, selector: string): Figure => ({
  frame,
  selector,
  width: 10,
  height: 10,
  svg: `<svg>${frame}</svg>`,
});

/** A document of 12 frames, 0 to 11, three of them exported. */
const series: FigureSeries = {
  frames: 12,
  figures: [figure(0, '0'), figure(3, 'insert-5/relax#2'), figure(11, 'done')],
};

const names = (pattern?: string, s: FigureSeries = series) => {
  const result = figureFiles(s, {
    name: 'doc',
    ...(pattern === undefined ? {} : { pattern }),
  });
  return result.ok ? result.value.map((f) => f.file) : result.error;
};

describe('figureFiles', () => {
  it('names files {name}-{frame}, padded to the last frame of the document', () => {
    expect(DEFAULT_PATTERN).toBe('{name}-{frame}');
    expect(names()).toEqual(['doc-00.svg', 'doc-03.svg', 'doc-11.svg']);
    expect(
      names(undefined, { frames: 101, figures: [figure(7, '7')] }),
    ).toEqual(['doc-007.svg']);
    expect(names(undefined, { frames: 1, figures: [figure(0, '0')] })).toEqual([
      'doc-0.svg',
    ]);
  });

  it('spells selectors with _ for {step}', () => {
    expect(names('{step}')).toEqual([
      '0.svg',
      'insert-5_relax_2.svg',
      'done.svg',
    ]);
  });

  it('keeps the figures and appends .svg only once', () => {
    const result = figureFiles(series, {
      name: 'doc',
      pattern: '{name}.{frame}.svg',
    });
    expect(result).toEqual({
      ok: true,
      value: series.figures.map((f, k) => ({
        file: ['doc.00.svg', 'doc.03.svg', 'doc.11.svg'][k],
        figure: f,
      })),
    });
  });

  it('accepts a fixed name for one figure, not for several', () => {
    const one = { frames: 12, figures: [figure(3, 'go')] };
    expect(names('relax', one)).toEqual(['relax.svg']);
    expect(names('relax')).toMatch(
      /^The name "relax" gives every figure the same file; add \{frame\} or \{step\}/,
    );
  });
});

describe('figureFiles in TikZ', () => {
  const tex = (pattern?: string) => {
    const result = figureFiles(series, {
      name: 'doc',
      format: 'tikz',
      ...(pattern === undefined ? {} : { pattern }),
    });
    return result.ok ? result.value.map((f) => f.file) : result.error;
  };

  it('names files as for SVG, ending in .tex', () => {
    expect(tex()).toEqual(['doc-00.tex', 'doc-03.tex', 'doc-11.tex']);
    expect(tex('{step}.tex')).toEqual([
      '0.tex',
      'insert-5_relax_2.tex',
      'done.tex',
    ]);
    // .svg is part of the name in TikZ, not its extension.
    expect(tex('{frame}.svg')).toEqual([
      '00.svg.tex',
      '03.svg.tex',
      '11.svg.tex',
    ]);
  });

  it('checks the pattern against the format', () => {
    expect(patternProblem('.tex', 'tikz')).toBe('The name is empty');
    expect(patternProblem('.tex', 'svg')).toBeUndefined();
  });
});

describe('patternProblem', () => {
  it('accepts the known placeholders', () => {
    expect(patternProblem('{name}-{frame}-{step}.svg')).toBeUndefined();
    expect(patternProblem('figure')).toBeUndefined();
  });

  it('rejects unknown placeholders, path separators and empty names', () => {
    expect(patternProblem('{name}-{nope}')).toBe(
      'Unknown placeholder {nope} in the name; use {name}, {frame} or {step}',
    );
    expect(patternProblem('figs/{frame}')).toMatch(/--out/);
    expect(patternProblem('figs\\{frame}')).toMatch(/--out/);
    expect(patternProblem('fig-{frame')).toMatch(/brace/);
    expect(patternProblem('fig-{frame}}')).toMatch(/brace/);
    expect(patternProblem('')).toMatch(/empty/);
    expect(patternProblem('.svg')).toMatch(/empty/);
  });
});
