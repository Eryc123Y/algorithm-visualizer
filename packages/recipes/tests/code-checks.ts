/**
 * Checks of code in pseudocode and Python (ADR 0017), shared by the tests
 * of snippets and of the registry.
 */
import { highlightCode, isCodeLine } from '@algomotion/core';
import type { AnchoredSource } from '@algomotion/spec';

import type { Language } from '../src/snippet.ts';

/**
 * Non-blank lines indented in a way the language would not read as its
 * blocks: Python opens a block after `:`, pseudocode after a procedure's
 * first line and after `if`, `elseif`, `else`, `while`, `for` and `repeat`
 * (a one-line `else x = y` opens none).
 */
export function badIndents(code: string, language: Language): string[] {
  const lines = code.split('\n').filter((l) => l.trim() !== '');
  const indent = (l: string) => l.length - l.trimStart().length;
  const opensBlock = (line: string) =>
    language === 'python'
      ? line.trimEnd().endsWith(':')
      : indent(line) === 0 ||
        /^(if|elseif|while|for|repeat)\b/.test(line.trim()) ||
        line.trim() === 'else';
  return lines.filter((line, k) => {
    const prev = k === 0 ? undefined : lines[k - 1]!;
    const before = prev === undefined ? 0 : indent(prev);
    const opens = prev !== undefined && opensBlock(prev);
    const depth = indent(line);
    return depth % 4 !== 0 || (opens ? depth !== before + 4 : depth > before);
  });
}

/** Problems with one source: anchors, highlighting and indentation. */
export function sourceProblems(source: AnchoredSource): string[] {
  const { language, code, anchors } = source;
  const lines = code.split('\n');
  const problems: string[] = [];
  for (const [anchor, line] of Object.entries(anchors))
    if (!isCodeLine(lines[line - 1] ?? '', language))
      problems.push(`${language} anchor @${anchor} is not on a line of code`);
  const highlighted = highlightCode(code, language);
  if (highlighted.map((l) => l.map((t) => t.text).join('')).join('\n') !== code)
    problems.push(`${language} tokens do not join back into the code`);
  for (const line of badIndents(code, language as Language))
    problems.push(`${language} line is badly indented: ${line.trim()}`);
  // Every procedure in pseudocode is named in capitals.
  if (language === 'pseudocode')
    for (const header of code.split('\n\n').map((p) => p.split('\n')[0]!))
      if (highlightCode(header, language)[0]![0]?.kind !== 'function')
        problems.push(
          `pseudocode procedure does not start with a name: ${header}`,
        );
  return problems;
}

/** Narrations name values and ideas, not the syntax of either language. */
export const CODE_SYNTAX = /None|NIL|len\(|\.size|append|==|\bdef\b|\/\/|#/;
