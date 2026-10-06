/**
 * Reducer for the `table` kind.
 */
import {
  err,
  ok,
  type Cell,
  type Result,
  type Scalar,
  type TableAction,
  type TableDecl,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';

export interface TableMarks {
  readonly highlight: readonly Cell[];
  /** The cell being computed and the cells it reads, this step. */
  readonly depend: { readonly cell: Cell; readonly on: readonly Cell[] } | null;
  readonly settled: readonly Cell[];
}

export interface TableState {
  readonly data: readonly (readonly Scalar[])[];
  readonly marks: TableMarks;
}

type Reduced = Result<TableState, ReduceError>;

const emptyMarks: TableMarks = { highlight: [], depend: null, settled: [] };

const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

function checkCell(
  s: TableState,
  path: readonly PropertyKey[],
  [row, column]: Cell,
): ReduceError | undefined {
  const height = s.data.length;
  const width = s.data[0]?.length ?? 0;
  if (row < height && column < width) return undefined;
  return {
    code: 'OUT_OF_RANGE',
    path,
    message: `Cell [${row}, ${column}] is outside the ${height}×${width} table`,
    hint:
      height * width === 0
        ? 'The table has no cells.'
        : `Rows are 0 to ${height - 1} and columns 0 to ${width - 1}.`,
  };
}

const checkCells = (
  s: TableState,
  key: string,
  cells: readonly Cell[],
): ReduceError | undefined => {
  for (const [k, cell] of cells.entries()) {
    const bad = checkCell(s, [key, k], cell);
    if (bad) return bad;
  }
  return undefined;
};

function reduceTable(s: TableState, a: TableAction): Reduced {
  const marks = (next: Partial<TableMarks>): Reduced =>
    ok({ data: s.data, marks: { ...s.marks, ...next } });
  switch (a.type) {
    case 'set': {
      const bad = checkCell(s, ['cell'], a.cell);
      if (bad) return err(bad);
      const [row, column] = a.cell;
      return ok({
        data: s.data.map((cells, r) =>
          r === row ? cells.map((v, c) => (c === column ? a.value : v)) : cells,
        ),
        marks: s.marks,
      });
    }
    case 'highlight': {
      const bad = checkCells(s, 'cells', a.cells);
      if (bad) return err(bad);
      return marks({ highlight: a.cells });
    }
    case 'depend': {
      const bad = checkCell(s, ['cell'], a.cell) ?? checkCells(s, 'on', a.on);
      if (bad) return err(bad);
      return marks({ depend: { cell: a.cell, on: a.on } });
    }
    case 'settle': {
      const bad = checkCells(s, 'cells', a.cells);
      if (bad) return err(bad);
      const fresh = a.cells.filter(
        (cell, k) =>
          !s.marks.settled.some((done) => sameCell(done, cell)) &&
          a.cells.findIndex((other) => sameCell(other, cell)) === k,
      );
      return marks({ settled: [...s.marks.settled, ...fresh] });
    }
    case 'resetMarks':
      return ok({ data: s.data, marks: emptyMarks });
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const tableKind: StructureKind<TableDecl, TableState, TableAction> = {
  init: (decl) => ({ data: decl.cells, marks: emptyMarks }),
  beginStep: (s) =>
    s.marks.highlight.length === 0 && s.marks.depend === null
      ? s
      : { data: s.data, marks: { ...s.marks, highlight: [], depend: null } },
  reduce: reduceTable,
};
