/**
 * The LaTeX package against the rest of algoviz, without TeX: its version
 * and format agree with the TikZ painter's, and the checks it applies
 * before calling the shell accept every algorithm id, step selector and
 * theme the engine has (ADR 0027).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTrace, selectorOf } from '@algoviz/core';
import { algorithms, runAlgorithm } from '@algoviz/recipes';
import { themes } from '@algoviz/svg';
import { TIKZ_FORMAT } from '@algoviz/tikz';

const sty = readFileSync(
  new URL('../package/algoviz.sty', import.meta.url),
  'utf8',
);

/** A constant of the package, by its name. */
const constant = (name: string) =>
  new RegExp(`\\\\${name}\\s*\\{\\s*([^}]*?)\\s*\\}`).exec(sty)?.[1];

/** One of the package's l3regex patterns, as a JavaScript RegExp. */
function pattern(name: string): RegExp {
  const source = new RegExp(
    `\\\\regex_const:Nn \\\\c__algoviz_${name}_regex\\s*\\{([^\\n]*)\\}`,
  ).exec(sty)?.[1];
  if (source === undefined) throw new Error(`No regex ${name}`);
  return new RegExp(
    source
      .replace(/\s+/g, '')
      .replace(/\\A/g, '^')
      .replace(/\\Z/g, '$')
      .replace(/\\#/g, '#')
      .replace(/\\x\{([0-9A-Fa-f]{2})\}/g, '\\x$1'),
  );
}

describe('algoviz.sty', () => {
  it('reads the format the TikZ painter writes', () => {
    expect(Number(constant('int_const:Nn \\\\c__algoviz_format_int'))).toBe(
      TIKZ_FORMAT,
    );
  });

  it('gives one version, in its header and in its cache key', () => {
    const header =
      /\\ProvidesExplPackage\{algoviz\}\{[\d-]+\}\{([\d.]+)\}/.exec(sty)?.[1];
    expect(header).toMatch(/^\d+\.\d+\.\d+$/);
    expect(constant('str_const:Nn \\\\c__algoviz_version_str')).toBe(header);
  });

  it('accepts every algorithm id of the registry', () => {
    const id = pattern('id');
    for (const algorithm of algorithms) expect(algorithm.id).toMatch(id);
    expect('dijkstra; rm').not.toMatch(id);
    expect('Dijkstra').not.toMatch(id);
  });

  it('accepts every selector of every registry example, and no shell syntax', () => {
    const step = pattern('step');
    for (const algorithm of algorithms) {
      const run = runAlgorithm(algorithm.id, algorithm.examples[0]);
      if (!run.ok) throw new Error(algorithm.id);
      const doc = run.value.document;
      const trace = loadTrace(doc);
      if (!trace.ok) throw new Error(algorithm.id);
      for (let f = 0; f <= trace.value.length; f++)
        expect(selectorOf(trace.value.visualization, f)).toMatch(step);
    }
    for (const selector of ['-1', '12', 'relax#3', 'a..b', 'insert-5', '0,-1'])
      expect(selector).toMatch(step);
    for (const selector of ['$(rm)', 'a b', 'a;b', '`x`', "'x'", 'a|b', 'a&b'])
      expect(selector).not.toMatch(step);
  });

  it('accepts every theme', () => {
    const theme = pattern('theme');
    for (const name of Object.keys(themes)) expect(name).toMatch(theme);
  });

  it('quotes file names without the characters shells read inside quotes', () => {
    const path = pattern('path');
    for (const name of ['heap.json', 'notes/my graph.json', 'C:/x/a-b_c.json'])
      expect(name).toMatch(path);
    for (const name of ['a"b', 'a$b', 'a`b', 'a\\b', 'a%b', 'a!b', 'a;b'])
      expect(name).not.toMatch(path);
  });
});
