/**
 * The `table` kind: a grid of cells, for dynamic programming (LCS, edit
 * distance, knapsack, Floyd–Warshall) and adjacency matrices.
 *
 * Cells are addressed as `[row, column]`. A null cell is drawn empty.
 *
 * Marks: `highlight` and `depend` last one step; `settle` persists until
 * `resetMarks`.
 */
import { z } from 'zod';

import { Index, LIMITS, Scalar } from '../common.ts';
import { typesOf, type DeclIssue, type KindSpec } from './kind.ts';

const Labels = z
  .array(Scalar)
  .max(Math.max(LIMITS.tableRows, LIMITS.tableColumns));

export const Cell = z
  .tuple([Index, Index])
  .describe('A cell as [row, column], both from 0.');
export type Cell = z.infer<typeof Cell>;

const Cells = z
  .array(Cell)
  .min(1)
  .max(LIMITS.tableRows * LIMITS.tableColumns);

const Grid = z
  .array(z.array(Scalar).max(LIMITS.tableColumns))
  .max(LIMITS.tableRows);

export const TableDecl = z
  .strictObject({
    kind: z.literal('table'),
    label: z.string().max(LIMITS.textLength).optional(),
    cells: Grid.describe('Rows of cells; null cells are empty.'),
    rowLabels: Labels.optional(),
    columnLabels: Labels.optional(),
  })
  .describe('A table.');
export type TableDecl = z.infer<typeof TableDecl>;

export const TableDeclInput = z
  .strictObject({
    kind: z.literal('table'),
    label: z.string().max(LIMITS.textLength).optional(),
    rows: z.int().min(0).max(LIMITS.tableRows).optional(),
    columns: z.int().min(0).max(LIMITS.tableColumns).optional(),
    initial: Grid.optional().describe(
      'Initial rows of cells; shorter rows are padded with empty cells.',
    ),
    rowLabels: Labels.optional().describe(
      'Shown left of the rows, e.g. the characters of a string; row numbers by default.',
    ),
    columnLabels: Labels.optional().describe(
      'Shown above the columns; column numbers by default.',
    ),
    cells: Grid.optional().describe(
      'The canonical form of `initial`: every row, all of one length. Accepted so that parsed documents can be read again.',
    ),
  })
  .refine((d) => d.cells === undefined || d.initial === undefined, {
    message: 'Give either `initial` or `cells`, not both',
    path: ['cells'],
  })
  // The same rule for JSON Schema validators, which cannot run the refinement.
  .meta({ not: { required: ['initial', 'cells'] } })
  .describe(
    'Give `rows` and `columns` for an empty table, `initial` for one with values, or both to pad `initial`.',
  );
export type TableDeclInput = z.infer<typeof TableDeclInput>;

function normalizeTableDecl(input: TableDeclInput): TableDecl {
  const { rows, columns, cells: given, ...others } = input;
  const { initial = given ?? [], ...rest } = others;
  const height = Math.max(rows ?? 0, initial.length);
  const width = Math.max(columns ?? 0, ...initial.map((row) => row.length));
  const cells = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => initial[r]?.[c] ?? null),
  );
  return { ...rest, cells };
}

function validateTableDecl(decl: TableDecl): DeclIssue[] {
  const issues: DeclIssue[] = [];
  const height = decl.cells.length;
  const width = decl.cells[0]?.length ?? 0;
  decl.cells.forEach((row, r) => {
    if (row.length !== width)
      issues.push({
        path: ['cells', r],
        message: `Row ${r} has ${row.length} cells, but row 0 has ${width}`,
      });
  });
  if (decl.rowLabels !== undefined && decl.rowLabels.length !== height)
    issues.push({
      path: ['rowLabels'],
      message: `There are ${decl.rowLabels.length} row labels for ${height} rows`,
    });
  if (decl.columnLabels !== undefined && decl.columnLabels.length !== width)
    issues.push({
      path: ['columnLabels'],
      message: `There are ${decl.columnLabels.length} column labels for ${width} columns`,
    });
  return issues;
}

export const TableAction = z.discriminatedUnion('type', [
  z
    .strictObject({ type: z.literal('set'), cell: Cell, value: Scalar })
    .describe('Write a cell; null empties it.'),
  z
    .strictObject({ type: z.literal('highlight'), cells: Cells })
    .describe('Highlight cells (this step only).'),
  z
    .strictObject({ type: z.literal('depend'), cell: Cell, on: Cells })
    .describe(
      'Show that `cell` is computed from the cells `on`, with arrows from each (this step only).',
    ),
  z
    .strictObject({ type: z.literal('settle'), cells: Cells })
    .describe(
      'Mark cells as part of the answer, e.g. a traced-back path (persists).',
    ),
  z
    .strictObject({ type: z.literal('resetMarks') })
    .describe('Clear every mark.'),
]);
export type TableAction = z.infer<typeof TableAction>;

export const tableSpec: KindSpec<{
  decl: TableDecl;
  declInput: TableDeclInput;
  action: TableAction;
  actionInput: TableAction;
}> = {
  kind: 'table',
  decl: TableDecl,
  declInput: TableDeclInput,
  action: TableAction,
  actionInput: TableAction,
  actionTypes: typesOf(TableAction),
  normalizeDecl: normalizeTableDecl,
  declIds: () => [],
  validateDecl: validateTableDecl,
  normalizeAction: (action) => action,
  introducedIds: () => [],
};
