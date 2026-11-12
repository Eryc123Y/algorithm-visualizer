/**
 * What a run records per task: every tool call with its outcome, and the
 * submitted document. Both kinds of run (the API runner and agents using
 * the command line) write the same files, so one report reads both.
 *
 *   <run>/meta.json          what was run
 *   <run>/<task>.log.jsonl   one LogEntry per tool call
 *   <run>/<task>.json        the submitted document, if any
 */
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { formatErrors } from '@algomotion/spec';
import { callTool, validate, type ToolResult } from '@algomotion/mcp';

export interface LogEntry {
  readonly tool: string;
  /** False when the tool reported an error (for validate: invalid). */
  readonly ok: boolean;
  /** Error codes, for an invalid document. */
  readonly codes?: readonly string[];
  /** The first error lines, for an invalid document. */
  readonly errors?: readonly string[];
}

export interface RunMeta {
  readonly model: string;
  readonly mode: string;
  readonly date: string;
  readonly notes?: string;
  /**
   * The tasks the run was asked to do. Each counts in the report, even
   * one that failed before leaving a log or a document.
   */
  readonly tasks?: readonly string[];
}

export const logPath = (run: string, task: string) =>
  join(run, `${task}.log.jsonl`);
export const documentPath = (run: string, task: string) =>
  join(run, `${task}.json`);

export function appendLog(run: string, task: string, entry: LogEntry): void {
  mkdirSync(run, { recursive: true });
  appendFileSync(logPath(run, task), `${JSON.stringify(entry)}\n`);
}

/**
 * The tools' prefix before ADR 0044 renamed the project. Runs recorded
 * then, such as those in evals/results, keep it, and are read with the
 * tools' current names.
 */
const OLD_PREFIX = 'algoviz_';

export function readLog(run: string, task: string): LogEntry[] {
  let text: string;
  try {
    text = readFileSync(logPath(run, task), 'utf8');
  } catch {
    return [];
  }
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as LogEntry)
    .map((entry) =>
      entry.tool.startsWith(OLD_PREFIX)
        ? {
            ...entry,
            tool: `algomotion_${entry.tool.slice(OLD_PREFIX.length)}`,
          }
        : entry,
    );
}

export function writeMeta(run: string, meta: RunMeta): void {
  mkdirSync(run, { recursive: true });
  writeFileSync(join(run, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

/** Calls a tool and logs it; validation logs the error codes too. */
export function loggedCall(
  run: string,
  task: string,
  tool: string,
  args: Record<string, unknown>,
): ToolResult {
  const result = callTool(tool, args);
  let entry: LogEntry = { tool, ok: !result.isError };
  if (tool === 'algomotion_validate' && result.isError) {
    const report = validate(args['document']);
    if (!report.valid)
      entry = {
        ...entry,
        codes: report.errors.map((e) => e.code),
        errors: formatErrors(report.errors.slice(0, 5)).split('\n'),
      };
  }
  appendLog(run, task, entry);
  return result;
}

/** Records a submission: the document as given, and a log entry. */
export function submit(run: string, task: string, document: unknown): void {
  const value =
    typeof document === 'string' ? (tryParse(document) ?? document) : document;
  mkdirSync(run, { recursive: true });
  writeFileSync(documentPath(run, task), `${JSON.stringify(value, null, 2)}\n`);
  appendLog(run, task, { tool: 'submit', ok: true });
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
