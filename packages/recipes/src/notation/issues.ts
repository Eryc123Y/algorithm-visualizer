/**
 * Input errors as diagnostics (ADR 0032). A union reports every branch it
 * tried; this keeps the branch that matches the value's type, so a string
 * gets the notation's error and an array the structured form's.
 */
import { formatPath, type Diagnostic } from '@algoviz/spec';
import type { z } from 'zod';

import { CODE_PARAM, HINT_PARAM } from './error.ts';

type Issue = z.core.$ZodIssue;

/** The diagnostics of an input's issues, at paths under `$.input`. */
export function inputDiagnostics(issues: readonly Issue[]): Diagnostic[] {
  return narrow(issues, ['input'], undefined);
}

/**
 * Issues with unions narrowed; `forms` is the message of a union narrowed
 * on the way, such as "from must be …", kept as a hint.
 */
function narrow(
  issues: readonly Issue[],
  base: readonly PropertyKey[],
  forms: string | undefined,
): Diagnostic[] {
  return issues.flatMap((issue) => {
    const path = [...base, ...issue.path];
    if (issue.code !== 'invalid_union' || issue.errors.length === 0)
      return [diagnostic(issue, path, forms)];
    const matching = issue.errors.filter((branch) => !isMismatch(branch));
    if (matching.length === 0)
      return [
        {
          code: 'INVALID_SHAPE',
          path: formatPath(path),
          message: mismatchMessage(issue),
          ...(forms === undefined || ownMessage(issue) !== undefined
            ? {}
            : { hint: forms }),
        },
      ];
    // Of several matching branches, the one that got furthest into the
    // value, then the first.
    const best = matching.reduce((a, b) => (depth(b) > depth(a) ? b : a));
    return narrow(best, path, ownMessage(issue) ?? forms);
  });
}

/** A branch that failed only because the value has another type. */
function isMismatch(branch: readonly Issue[]): boolean {
  return branch.every(
    (issue) =>
      issue.path.length === 0 &&
      (issue.code === 'invalid_type' ||
        (issue.code === 'invalid_union' &&
          issue.errors.length > 0 &&
          issue.errors.every(isMismatch))),
  );
}

/** How far into the value a branch's deepest issue is. */
function depth(branch: readonly Issue[]): number {
  return Math.max(
    ...branch.map((issue) => {
      if (issue.code !== 'invalid_union') return issue.path.length;
      const inner = issue.errors.filter((b) => !isMismatch(b));
      return (
        issue.path.length +
        (inner.length === 0 ? 0 : Math.max(...inner.map(depth)))
      );
    }),
  );
}

/** "Expected a string or an array, not a number", from Zod's messages. */
function mismatchMessage(issue: Issue): string {
  const expected = new Set<string>();
  let received: string | undefined;
  const visit = (branch: readonly Issue[]) => {
    for (const inner of branch) {
      if (inner.code === 'invalid_union') inner.errors.forEach(visit);
      else if (inner.code === 'invalid_type') {
        expected.add(inner.expected);
        received ??= /received (.+)$/.exec(inner.message)?.[1];
      }
    }
  };
  if (issue.code === 'invalid_union') issue.errors.forEach(visit);
  const types = [...expected];
  const list =
    types.length === 1
      ? types[0]!
      : `${types.slice(0, -1).join(', ')} or ${types.at(-1)}`;
  const own = ownMessage(issue);
  if (own !== undefined) return own;
  return `Invalid input: expected ${list}${received === undefined ? '' : `, received ${received}`}`;
}

/** The message a union was given, such as a heap's `from`'s, if any. */
const ownMessage = (issue: Issue): string | undefined =>
  issue.message === 'Invalid input' ? undefined : issue.message;

function diagnostic(
  issue: Issue,
  path: readonly PropertyKey[],
  forms: string | undefined,
): Diagnostic {
  const params =
    issue.code === 'custom'
      ? (issue.params as Record<string, unknown> | undefined)
      : undefined;
  const code = params?.[CODE_PARAM];
  const hint = params?.[HINT_PARAM] ?? forms;
  return {
    code: typeof code === 'string' ? code : 'INVALID_SHAPE',
    path: formatPath(path),
    message: issue.message,
    ...(typeof hint === 'string' ? { hint } : {}),
  };
}
