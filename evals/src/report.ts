/**
 * Grades every task of a run directory and writes summary.json and
 * report.md next to the logs.
 *
 *   node --conditions=@algomotion/source evals/src/report.ts <run-dir> [<run-dir> …]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { grade, type Grade } from './grade.ts';
import { documentPath, readLog, type LogEntry, type RunMeta } from './log.ts';
import { tasks, type EvalTask } from './tasks.ts';

export interface TaskSummary extends Grade {
  readonly calls: number;
  /** Times a document was handed in; the last one is graded. */
  readonly submissions: number;
  readonly validations: number;
  /** Whether the first validation found the document valid (null: none). */
  readonly firstValid: boolean | null;
  /** Invalid validations before the first valid one, or all if never. */
  readonly invalidValidations: number;
  readonly errorCodes: readonly string[];
}

export interface RunSummary {
  readonly meta: RunMeta | null;
  readonly tasks: readonly TaskSummary[];
  readonly totals: {
    readonly tasks: number;
    readonly submitted: number;
    readonly valid: number;
    readonly correct: number;
    /** Of tasks with at least one validation. */
    readonly firstValid: number;
    readonly validated: number;
    readonly meanValidations: number;
  };
  /** Error codes across every invalid validation, most frequent first. */
  readonly errorCodes: readonly (readonly [string, number])[];
  /** Up to three example messages per code. */
  readonly examples: Readonly<Record<string, readonly string[]>>;
}

function summarizeTask(run: string, task: EvalTask): TaskSummary {
  const log = readLog(run, task.id);
  const path = documentPath(run, task.id);
  const doc = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as unknown)
    : undefined;
  const validations = log.filter((e) => e.tool === 'algomotion_validate');
  const firstOk = validations.findIndex((e) => e.ok);
  const failed = validations.filter((e) => !e.ok);
  return {
    ...grade(task, doc),
    calls: log.filter((e) => e.tool.startsWith('algomotion_')).length,
    submissions: log.filter((e) => e.tool === 'submit').length,
    validations: validations.length,
    firstValid: validations.length === 0 ? null : validations[0]!.ok,
    invalidValidations: firstOk === -1 ? validations.length : firstOk,
    errorCodes: failed.flatMap((e) => e.codes ?? []),
  };
}

const count = (xs: readonly string[]) => {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
};

export function summarizeRun(run: string): RunSummary {
  const meta = existsSync(join(run, 'meta.json'))
    ? (JSON.parse(readFileSync(join(run, 'meta.json'), 'utf8')) as RunMeta)
    : null;
  // Runs without a task list (e.g. from the CLI harness) count the tasks
  // that left a log or a document.
  const attempted = tasks.filter((t) =>
    meta?.tasks
      ? meta.tasks.includes(t.id)
      : readLog(run, t.id).length > 0 || existsSync(documentPath(run, t.id)),
  );
  const rows = attempted.map((t) => summarizeTask(run, t));
  const validated = rows.filter((r) => r.firstValid !== null);
  const failedEntries: LogEntry[] = attempted.flatMap((t) =>
    readLog(run, t.id).filter((e) => e.tool === 'algomotion_validate' && !e.ok),
  );
  const examples: Record<string, string[]> = {};
  for (const entry of failedEntries)
    for (const line of entry.errors ?? []) {
      const code = line.split(' ')[0]!;
      const list = (examples[code] ??= []);
      if (list.length < 3 && !list.includes(line)) list.push(line);
    }
  return {
    meta,
    tasks: rows,
    totals: {
      tasks: rows.length,
      submitted: rows.filter((r) => r.submitted).length,
      valid: rows.filter((r) => r.valid).length,
      correct: rows.filter((r) => r.correct).length,
      firstValid: validated.filter((r) => r.firstValid).length,
      validated: validated.length,
      meanValidations:
        rows.length === 0
          ? 0
          : rows.reduce((n, r) => n + r.validations, 0) / rows.length,
    },
    errorCodes: count(rows.flatMap((r) => r.errorCodes)),
    examples,
  };
}

const pct = (n: number, d: number) =>
  d === 0 ? '–' : `${Math.round((100 * n) / d)}% (${n}/${d})`;

export function formatRun(summary: RunSummary): string {
  const { meta, totals } = summary;
  const lines = [
    `# Eval run${meta ? `: ${meta.model}, ${meta.mode}` : ''}`,
    '',
    meta ? `${meta.date}${meta.notes ? ` · ${meta.notes}` : ''}\n` : '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Correct | ${pct(totals.correct, totals.tasks)} |`,
    `| Valid when handed in | ${pct(totals.valid, totals.tasks)} |`,
    `| Valid at first validation | ${pct(totals.firstValid, totals.validated)} |`,
    `| Validations per task | ${totals.meanValidations.toFixed(1)} |`,
    '',
    '## Tasks',
    '',
    '| Task | Correct | Valid | First valid | Validations | Submissions | Steps | Narrated | Problems |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...summary.tasks.map((r) =>
      [
        r.task,
        r.correct ? '✓' : '✗',
        r.submitted ? (r.valid ? '✓' : '✗') : 'none',
        r.firstValid === null ? '–' : r.firstValid ? '✓' : '✗',
        r.validations,
        r.submissions,
        r.steps,
        `${Math.round(r.narrated * 100)}%`,
        [
          ...r.errors.slice(0, 2).map((e) => `${e.code} at ${e.path}`),
          ...r.problems,
        ]
          .join('; ')
          .replaceAll('|', '\\|'),
      ]
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |'),
    ),
  ];
  if (summary.errorCodes.length > 0) {
    lines.push('', '## Validation errors', '');
    for (const [code, n] of summary.errorCodes) {
      lines.push(`- **${code}** × ${n}`);
      for (const example of summary.examples[code] ?? [])
        lines.push(`  - \`${example.replaceAll('`', "'")}\``);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function writeReport(run: string): RunSummary {
  const summary = summarizeRun(run);
  writeFileSync(
    join(run, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  writeFileSync(join(run, 'report.md'), formatRun(summary));
  return summary;
}

// Run as a script (import.meta.main needs Node 22.18; we support 22.12).
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url))
  for (const run of process.argv.slice(2)) {
    const { totals } = writeReport(run);
    console.log(
      `${run}: ${totals.correct}/${totals.tasks} correct, ${totals.valid} valid, first validation valid ${totals.firstValid}/${totals.validated}`,
    );
  }
