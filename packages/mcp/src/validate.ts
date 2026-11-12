/**
 * Checks a document the way a player would load it, and reports what an
 * author needs to fix or improve.
 */
import { isCodeLine, type Trace } from '@algomotion/core';
import {
  formatErrors,
  formatPath,
  PROTOCOL_VERSION,
  upgradeDocument,
  type Diagnostic,
  type Visualization,
} from '@algomotion/spec';

import { loadDocument, readDocument } from './document.ts';

/** At most this many errors are reported; the rest are counted. */
export const MAX_ERRORS = 20;

export interface DocumentSummary {
  readonly title: string | null;
  readonly structures: readonly { name: string; kind: string }[];
  readonly steps: number;
  /** Frames go from 0 (before the first step) to `steps`. */
  readonly frames: number;
  /** Section ids, in order (ADR 0020). */
  readonly sections: readonly string[];
}

export type ValidationReport =
  | {
      readonly valid: true;
      readonly summary: DocumentSummary;
      /** Things that load but make a weaker lesson. */
      readonly warnings: readonly Diagnostic[];
    }
  | {
      readonly valid: false;
      readonly errors: readonly Diagnostic[];
      /** Total number of errors, including any not listed. */
      readonly errorCount: number;
    };

export function summarize(trace: Trace): DocumentSummary {
  const vis = trace.visualization;
  return {
    title: vis.title ?? null,
    structures: Object.entries(vis.structures).map(([name, decl]) => ({
      name,
      kind: decl.kind,
    })),
    steps: trace.length,
    frames: trace.length + 1,
    sections: (vis.sections ?? []).map((s) => s.id),
  };
}

/** Advice for documents that are valid but teach less than they could. */
export function lint(trace: Trace): Diagnostic[] {
  const { steps } = trace.visualization;
  const warnings: Diagnostic[] = [];
  if (steps.length === 0)
    warnings.push({
      code: 'NO_STEPS',
      path: '$.steps',
      message: 'The document has no steps, so it shows a single still frame',
      hint: 'Add one step per operation of the algorithm.',
    });
  else if (steps.every((s) => s.meta?.narration === undefined))
    warnings.push({
      code: 'NO_NARRATION',
      path: '$.steps',
      message: 'No step has a narration',
      hint: 'Give each step `meta.narration`: one or two sentences saying what happens and why.',
    });
  warnings.push(...codeWarnings(trace.visualization));
  const names = new Set(steps.map((step) => step.meta?.id));
  (trace.visualization.sections ?? []).forEach(({ id }, k) => {
    if (names.has(id))
      warnings.push({
        code: 'SECTION_HIDES_STEP',
        path: `$.sections[${k}].id`,
        message: `Section "${id}" has the id of a step name, so the selector "${id}" means the section`,
        hint: `Rename the section, e.g. after what its steps do; the step is still "${id}#1".`,
      });
  });
  steps.forEach((step, s) => {
    if (step.actions.length === 0 && step.meta === undefined)
      warnings.push({
        code: 'EMPTY_STEP',
        path: `$.steps[${s}]`,
        message: 'This step has no actions and no narration',
        hint: 'Remove it, or say what the learner should notice.',
      });
  });
  return warnings;
}

/**
 * Advice on the source code: steps that point at no line, and anchors that
 * steps use on a line without code (ADR 0017).
 */
function codeWarnings({ steps, source, sources }: Visualization): Diagnostic[] {
  if (steps.length === 0) return [];
  if (source !== undefined && steps.every((s) => s.meta?.line === undefined))
    return [
      {
        code: 'UNUSED_SOURCE',
        path: '$.source',
        message: 'The document has source code, but no step points at a line',
        hint: 'Set `meta.line` on steps to highlight the line being executed.',
      },
    ];
  if (sources === undefined) return [];
  const used = new Set(steps.map((s) => s.meta?.at));
  if (used.size === 1 && used.has(undefined))
    return [
      {
        code: 'UNUSED_SOURCE',
        path: '$.sources',
        message: 'The document has source code, but no step points at it',
        hint: "Set `meta.at` on steps to the anchor of the line being executed, and give the anchor's line in each source's `anchors`.",
      },
    ];
  return sources.flatMap(({ language, code, anchors }, k) => {
    const lines = code.split('\n');
    return Object.entries(anchors)
      .filter(
        ([name, line]) =>
          used.has(name) && !isCodeLine(lines[line - 1] ?? '', language),
      )
      .map(([name, line]) => ({
        code: 'ANCHOR_NOT_ON_CODE',
        path: formatPath(['sources', k, 'anchors', name]),
        message: `Anchor "${name}" is on line ${line} of the ${language} code, which is blank or only a comment`,
        hint: 'Put the anchor on the line that does what the step shows, so the reader sees it marked.',
      }));
  });
}

export function validate(input: unknown): ValidationReport {
  const loaded = loadDocument(input);
  if (!loaded.ok)
    return {
      valid: false,
      errors: loaded.error.slice(0, MAX_ERRORS),
      errorCount: loaded.error.length,
    };
  return {
    valid: true,
    summary: summarize(loaded.value),
    warnings: [...upgradeWarnings(input), ...lint(loaded.value)],
  };
}

/** A 0.x document is read as 1.0 (ADR 0043); writers should say 1.0. */
function upgradeWarnings(input: unknown): Diagnostic[] {
  const read = readDocument(input);
  const from = read.ok ? upgradeDocument(read.value).from : undefined;
  return from === undefined
    ? []
    : [
        {
          code: 'UPGRADED_VERSION',
          path: '$.version',
          message: `The document says version "${from}", which is read as "${PROTOCOL_VERSION}"`,
          hint: `Set "version" to "${PROTOCOL_VERSION}": the protocol is ${PROTOCOL_VERSION}, which holds everything 0.x had.`,
        },
      ];
}

/** The report as text for a model to read. */
export function formatReport(report: ValidationReport): string {
  if (!report.valid) {
    const more =
      report.errorCount > report.errors.length
        ? `\n…and ${report.errorCount - report.errors.length} more`
        : '';
    const noun = report.errorCount === 1 ? 'error' : 'errors';
    return `Invalid: ${report.errorCount} ${noun}.\n${formatErrors(report.errors)}${more}`;
  }
  const { summary, warnings } = report;
  const structures = summary.structures
    .map(({ name, kind }) => `${name} (${kind})`)
    .join(', ');
  const sections =
    summary.sections.length > 0
      ? `; sections ${summary.sections.join(', ')}`
      : '';
  const lines = [
    `Valid: ${structures}; ${summary.steps} steps, frames 0–${summary.steps}${sections}.`,
  ];
  if (warnings.length > 0)
    lines.push(`Warnings:\n${formatErrors(warnings, { max: MAX_ERRORS })}`);
  return lines.join('\n');
}
