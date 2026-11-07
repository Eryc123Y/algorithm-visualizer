/**
 * Validation errors in a form that both people and LLMs can act on: a stable
 * code, a JSONPath-like location, a message, and an optional fix hint.
 */
import type { z } from 'zod';

import { PROTOCOL_CODE_PARAM } from './common.ts';

export type ProtocolErrorCode =
  /** The document does not match the protocol's shape. */
  | 'INVALID_SHAPE'
  /** `version` names a protocol version this package cannot read. */
  | 'UNSUPPORTED_VERSION'
  /** An action's `target` names no declared structure. */
  | 'UNKNOWN_TARGET'
  /** An action's `type` is not defined for its target's kind. */
  | 'UNKNOWN_ACTION'
  /** An action's fields are missing or invalid. */
  | 'INVALID_ACTION'
  /** Two elements of one structure share an id. */
  | 'DUPLICATE_ID'
  /** A declaration breaks a structural rule, e.g. a tree with a cycle. */
  | 'INVALID_STRUCTURE'
  /**
   * A step's `meta.line`, or an anchor of `sources`, is not a line of its
   * source code.
   */
  | 'LINE_OUT_OF_RANGE'
  /**
   * The document mixes the two forms of source code: `source` and
   * `sources` together, `meta.line` with `sources`, or `meta.at` with
   * `source` (ADR 0017).
   */
  | 'MIXED_SOURCES'
  /** Two entries of `sources` have the same language. */
  | 'DUPLICATE_LANGUAGE'
  /** A step's `meta.at` is not an anchor of every source. */
  | 'UNKNOWN_ANCHOR'
  /** The document uses a feature added after its `version`. */
  | 'VERSION_TOO_OLD'
  /** A section starts past the last step. */
  | 'SECTION_OUT_OF_RANGE'
  /** A section does not start after the section before it. */
  | 'SECTION_OUT_OF_ORDER'
  /** Two sections share an id. */
  | 'DUPLICATE_SECTION';

/**
 * A located, actionable problem in a document. Generic over its code so that
 * later stages (for example the core engine) can report their own codes in
 * the same format.
 */
export interface Diagnostic<Code extends string = string> {
  readonly code: Code;
  /** Location in the input, e.g. `$.steps[3].actions[0].j`. */
  readonly path: string;
  readonly message: string;
  readonly hint?: string;
}

export type ProtocolError = Diagnostic<ProtocolErrorCode>;

/** Formats a property path as `$.a.b[0].c`. */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '$';
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`;
    else if (typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      out += `.${key}`;
    else out += `[${JSON.stringify(String(key))}]`;
  }
  return out;
}

/**
 * Converts Zod issues into protocol errors, prefixing each issue path with
 * `basePath` (the issue paths are relative to the value that was parsed).
 */
export function fromZodIssues(
  issues: readonly z.core.$ZodIssue[],
  basePath: readonly PropertyKey[],
  fallbackCode: ProtocolErrorCode,
): ProtocolError[] {
  return issues.map((issue) => {
    const tagged =
      issue.code === 'custom'
        ? (issue.params?.[PROTOCOL_CODE_PARAM] as ProtocolErrorCode | undefined)
        : undefined;
    return {
      code: tagged ?? fallbackCode,
      path: formatPath([...basePath, ...issue.path]),
      message: issue.message,
    };
  });
}

/**
 * Renders errors as plain text, one per line, for showing to a person or
 * returning to an LLM so it can correct its output.
 */
export function formatErrors(
  errors: readonly Diagnostic[],
  { max = 20 }: { max?: number } = {},
): string {
  const lines = errors
    .slice(0, max)
    .map(
      (e) =>
        `${e.code} at ${e.path}: ${e.message}${e.hint ? ` (hint: ${e.hint})` : ''}`,
    );
  if (errors.length > max) lines.push(`…and ${errors.length - max} more`);
  return lines.join('\n');
}
