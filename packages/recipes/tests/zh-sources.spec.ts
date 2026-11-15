/**
 * Every narration and section title in the recipes' sources is written in
 * both languages (ADR 0045), whatever input reaches it. The coverage test
 * runs the examples; this one reads the code, so a branch no example
 * reaches cannot stay English.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { PENDING_ZH } from './zh-pending.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Folders whose modules are still on PENDING_ZH. */
const PENDING_DIRS: readonly string[] = [
  'algorithms/geometry',
  'algorithms/math',
  'algorithms/foundations',
  'algorithms/amortized',
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

/** Whether an expression is text in one language only. */
function oneLanguage(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return oneLanguage(node.expression);
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  )
    return true;
  if (ts.isConditionalExpression(node))
    return oneLanguage(node.whenTrue) || oneLanguage(node.whenFalse);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  )
    return oneLanguage(node.left) || oneLanguage(node.right);
  return false;
}

/** The calls of `step` and `section` whose text is in one language only. */
function untranslated(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      const arg = node.arguments[1];
      if (
        (name === 'step' || name === 'section') &&
        arg !== undefined &&
        oneLanguage(arg)
      ) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push(
          `${relative(SRC, file)}:${line + 1}: ${arg.getText().slice(0, 70)}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('the recipes’ sources', () => {
  it('write every narration and section title in both languages', () => {
    const files = [
      ...sources(join(SRC, 'algorithms')),
      ...sources(join(SRC, 'structures')),
    ].filter(
      (file) =>
        !PENDING_DIRS.some((dir) => relative(SRC, file).startsWith(dir)),
    );
    expect(files.flatMap(untranslated)).toEqual([]);
  });

  it('leave no folder pending once every module is translated', () => {
    if (PENDING_ZH.size === 0) expect(PENDING_DIRS).toEqual([]);
  });
});
