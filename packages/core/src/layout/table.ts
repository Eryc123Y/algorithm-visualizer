/**
 * Layout for the `table` kind: a grid of cells with row and column
 * headers (labels if given, else numbers).
 *
 * ```
 *  dp
 *          ""   a    b
 *    ""  [ 0 ][ 0 ][ 0 ]
 *    a   [ 0 ][ 1 ][ 1 ]   ← `depend` draws arrows from the cells read
 *    c   [ 0 ][ 1 ][ 1 ]      into the cell computed
 * ```
 *
 * Cells are smaller than array cells so that larger tables fit.
 */
import type { Cell, Scalar, TableDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { TableState } from '../kinds/table.ts';
import {
  cellWidthFor,
  formatScalar,
  maxChars,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { LayoutOptions } from './options.ts';
import type { ElementRole, SceneItem } from './scene.ts';

export interface TableMetrics {
  readonly rows: number;
  readonly columns: number;
  readonly maxChars: number;
}

const cellText = (value: Scalar) => (value === null ? '' : formatScalar(value));

export const measureTable = (state: TableState): TableMetrics => ({
  rows: state.data.length,
  columns: state.data[0]?.length ?? 0,
  maxChars: maxChars(state.data.flat().map(cellText)),
});

export const mergeTableMetrics = (
  a: TableMetrics,
  b: TableMetrics,
): TableMetrics => ({
  rows: Math.max(a.rows, b.rows),
  columns: Math.max(a.columns, b.columns),
  maxChars: Math.max(a.maxChars, b.maxChars),
});

const GAP = 4;
/** How far a dependency arrow reaches into the cells it joins. */
const ARROW_INSET = 9;

/** Options for table cells: a smaller version of array cells. */
const cellOptions = (o: LayoutOptions): LayoutOptions => ({
  ...o,
  valueFontSize: Math.round(o.valueFontSize * 0.8),
  cellPadding: Math.round(o.cellPadding * 0.7),
  minCellWidth: Math.round(o.minCellWidth * 0.8),
});

const has = (cells: readonly Cell[], [r, c]: Cell) =>
  cells.some(([row, column]) => row === r && column === c);

function roleOf(state: TableState, cell: Cell): ElementRole {
  const { depend, highlight, settled } = state.marks;
  if (depend !== null && has(depend.on, cell)) return 'compare';
  if (depend !== null && has([depend.cell], cell)) return 'highlight';
  if (has(highlight, cell)) return 'highlight';
  if (has(settled, cell)) return 'settled';
  return 'default';
}

export function layoutTable({
  name,
  title,
  decl,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<TableDecl, TableState, TableMetrics>): Block {
  const co = cellOptions(o);
  const rowLabels =
    decl.rowLabels?.map(cellText) ??
    (o.showIndices
      ? Array.from({ length: metrics.rows }, (_, r) => String(r))
      : []);
  const columnLabels =
    decl.columnLabels?.map(cellText) ??
    (o.showIndices
      ? Array.from({ length: metrics.columns }, (_, c) => String(c))
      : []);
  const width = cellWidthFor(
    Math.max(metrics.maxChars, maxChars(columnLabels) * 0.7),
    co,
  );
  const height = Math.round(o.cellHeight * 0.8);
  const headerWidth =
    rowLabels.length === 0
      ? 0
      : Math.ceil(maxChars(rowLabels) * o.indexFontSize * o.charWidthRatio) +
        14;
  const headerHeight = columnLabels.length === 0 ? 0 : o.indexFontSize + 10;
  const left = origin.x + headerWidth;
  const top = origin.y + titleRowHeight(o) + headerHeight;
  const x = (c: number) => left + c * (width + GAP);
  const y = (r: number) => top + r * (height + GAP);

  const items: SceneItem[] = titleItems(name, title, origin, o);
  columnLabels.forEach((label, c) =>
    items.push({
      type: 'text',
      key: `${name}/column/${c}`,
      x: x(c) + width / 2,
      y: top - headerHeight / 2,
      anchor: 'middle',
      role: 'index',
      text: label,
      fontSize: o.indexFontSize,
    }),
  );
  rowLabels.forEach((label, r) =>
    items.push({
      type: 'text',
      key: `${name}/row/${r}`,
      x: left - 8,
      y: y(r) + height / 2,
      anchor: 'end',
      role: 'index',
      text: label,
      fontSize: o.indexFontSize,
    }),
  );
  state.data.forEach((row, r) =>
    row.forEach((value, c) =>
      items.push({
        type: 'box',
        key: `${name}/cell/${r}/${c}`,
        x: x(c),
        y: y(r),
        width,
        height,
        role: roleOf(state, [r, c]),
        text: cellText(value),
        fontSize: co.valueFontSize,
      }),
    ),
  );

  const { depend } = state.marks;
  if (depend !== null) {
    const centre = ([r, c]: Cell) => ({
      x: x(c) + width / 2,
      y: y(r) + height / 2,
    });
    const to = centre(depend.cell);
    depend.on.forEach((cell, k) => {
      const from = centre(cell);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return;
      const [ux, uy] = [dx / length, dy / length];
      // Distance from a cell's centre to its border along u.
      const border = Math.min(
        ux === 0 ? Infinity : width / 2 / Math.abs(ux),
        uy === 0 ? Infinity : height / 2 / Math.abs(uy),
      );
      const reach = border - ARROW_INSET;
      items.push({
        type: 'edge',
        key: `${name}/depend/${k}`,
        x1: from.x + ux * reach,
        y1: from.y + uy * reach,
        x2: to.x - ux * reach,
        y2: to.y - uy * reach,
        role: 'highlight',
        directed: true,
        fontSize: o.indexFontSize,
      });
    });
  }

  const gridWidth =
    metrics.columns === 0 ? 0 : metrics.columns * (width + GAP) - GAP;
  const gridHeight =
    metrics.rows === 0 ? 0 : metrics.rows * (height + GAP) - GAP;
  return {
    items,
    width: Math.max(headerWidth + gridWidth, titleWidth(title, o)),
    height: titleRowHeight(o) + headerHeight + gridHeight + 4,
  };
}
