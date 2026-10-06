/**
 * Layout for the `hashTable` kind: a column of buckets, each followed by
 * its chain.
 *
 * ```
 *  H
 *  [0]──▶[ 10 ]──▶[ 20 ]
 *  [1]
 *  [2]──▶[ 7 ]
 * ```
 *
 * Elements are keyed by id and the link into each element by its id too,
 * so an element moved to another bucket glides there with its arrow.
 */
import type { HashTableDecl } from '@algoviz/spec';

import type { Block, LayoutInput } from '../kind.ts';
import type { HashTableState } from '../kinds/hash-table.ts';
import {
  cellWidthFor,
  formatScalar,
  maxChars,
  titleItems,
  titleRowHeight,
  titleWidth,
} from './common.ts';
import type { ElementRole, SceneItem } from './scene.ts';

export interface HashTableMetrics {
  readonly buckets: number;
  /** Longest chain. */
  readonly maxChain: number;
  readonly maxChars: number;
}

export const measureHashTable = (s: HashTableState): HashTableMetrics => ({
  buckets: s.data.length,
  maxChain: Math.max(0, ...s.data.map((chain) => chain.length)),
  maxChars: maxChars(s.data.flat().map((e) => formatScalar(e.value))),
});

export const mergeHashTableMetrics = (
  a: HashTableMetrics,
  b: HashTableMetrics,
): HashTableMetrics => ({
  buckets: Math.max(a.buckets, b.buckets),
  maxChain: Math.max(a.maxChain, b.maxChain),
  maxChars: Math.max(a.maxChars, b.maxChars),
});

const LINK = 28;
const ROW_GAP = 8;

export function layoutHashTable({
  name,
  title,
  state,
  metrics,
  origin,
  options: o,
}: LayoutInput<HashTableDecl, HashTableState, HashTableMetrics>): Block {
  const height = Math.round(o.cellHeight * 0.8);
  const fontSize = Math.round(o.valueFontSize * 0.8);
  const bucketWidth = Math.max(
    height,
    Math.ceil(String(metrics.buckets - 1).length * o.indexFontSize * 0.6 + 16),
  );
  const width = cellWidthFor(metrics.maxChars, {
    ...o,
    valueFontSize: fontSize,
  });
  const top = origin.y + titleRowHeight(o);
  const y = (b: number) => top + b * (height + ROW_GAP);
  const x = (k: number) => origin.x + bucketWidth + LINK + k * (width + LINK);

  const { bucket, highlight, settled } = state.marks;
  const role = (id: string): ElementRole =>
    highlight.includes(id)
      ? 'highlight'
      : settled.includes(id)
        ? 'settled'
        : 'default';

  const items: SceneItem[] = titleItems(name, title, origin, o);
  state.data.forEach((chain, b) => {
    items.push({
      type: 'box',
      key: `${name}/bucket/${b}`,
      x: origin.x,
      y: y(b),
      width: bucketWidth,
      height,
      role: bucket === b ? 'highlight' : 'default',
      text: String(b),
      fontSize: o.indexFontSize,
    });
    const midY = y(b) + height / 2;
    chain.forEach((element, k) => {
      items.push(
        {
          type: 'edge',
          key: `${name}/link/${element.id}`,
          x1: k === 0 ? origin.x + bucketWidth : x(k - 1) + width,
          y1: midY,
          x2: x(k),
          y2: midY,
          role: 'link',
          directed: true,
          fontSize: o.indexFontSize,
        },
        {
          type: 'box',
          key: `${name}/element/${element.id}`,
          x: x(k),
          y: y(b),
          width,
          height,
          role: role(element.id),
          text: formatScalar(element.value),
          fontSize,
        },
      );
    });
  });

  return {
    items,
    width: Math.max(
      bucketWidth + metrics.maxChain * (LINK + width),
      titleWidth(title, o),
    ),
    height:
      titleRowHeight(o) + metrics.buckets * (height + ROW_GAP) - ROW_GAP + 4,
  };
}
