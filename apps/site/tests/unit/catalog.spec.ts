/**
 * The documentation's catalogue (roadmap 3.4): every registry module gets
 * a page, grouped by topic, and a data structure's operations under it.
 */
import { algorithms, TOPICS } from '@algoviz/recipes';
import { describe, expect, it } from 'vitest';

import { catalog, depthOf, pathOf } from '../../src/docs/catalog.ts';

const groups = catalog(algorithms);
const entries = groups.flatMap((g) => [
  ...g.algorithms,
  ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
]);

describe('the catalogue', () => {
  it('has a page for every module of the registry, once', () => {
    expect(entries.map((e) => e.id).sort()).toEqual(
      algorithms.map((a) => a.id).sort(),
    );
    expect(new Set(entries.map((e) => e.path)).size).toBe(entries.length);
  });

  it('keeps the topics in the registry’s order, without empty ones', () => {
    const topics = groups.map((g) => g.topic);
    expect(topics).toEqual(TOPICS.filter((t) => topics.includes(t)));
    for (const g of groups)
      expect(g.algorithms.length + g.structures.length).toBeGreaterThan(0);
  });

  it('puts a structure’s operations under it, in the registry’s order', () => {
    const bst = groups
      .flatMap((g) => g.structures)
      .find((s) => s.entry.id === 'bst')!;
    expect(bst.entry.title).toBe('Binary search tree');
    expect(bst.operations.map((o) => o.id)).toEqual([
      'bst.search',
      'bst.insert',
      'bst.delete',
    ]);
    for (const op of bst.operations) expect(op.structure).toBe('bst');
  });

  it('lists algorithms apart from structures', () => {
    const sorting = groups.find((g) => g.topic === 'sorting')!;
    expect(sorting.structures).toEqual([]);
    expect(sorting.algorithms[0]!.id).toBe('insertion-sort');
    expect(sorting.title).toBe('Sorting');
  });

  it('maps ids to folders: a structure’s operations inside its own', () => {
    expect(pathOf('dijkstra')).toBe('dijkstra/');
    expect(pathOf('bst')).toBe('bst/');
    expect(pathOf('bst.delete')).toBe('bst/delete/');
    expect(depthOf('')).toBe(0);
    expect(depthOf('bst/')).toBe(1);
    expect(depthOf('bst/delete/')).toBe(2);
  });

  it('keeps no page in the way of the share page or the themes', () => {
    for (const e of entries)
      expect(['play/', 'themes/', 'assets/']).not.toContain(e.path);
  });
});
