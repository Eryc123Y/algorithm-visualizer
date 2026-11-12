/**
 * The shortest way to write an input (ADR 0032), for the documentation's
 * snippets (roadmap 3.4), and kept out of the registry so the player's
 * bundle does not carry it: each field in its notation where one fits, fields equal
 * to their defaults left out, and the main field alone where it is all
 * that remains. Every candidate is kept only if it runs to the same
 * document, so a short input never draws something else.
 */
import {
  printGraph,
  printList,
  runAlgorithm,
  type StructuredGraph,
} from '@algoviz/recipes';

type Fields = Readonly<Record<string, unknown>>;

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The input, written as short as it runs the same; else as it was. */
export function shortInput(id: string, input: unknown): unknown {
  const reference = documentKey(id, input);
  if (reference === undefined || !isFields(input)) return input;
  const same = (candidate: unknown) => documentKey(id, candidate) === reference;

  let fields: Fields = input;
  for (const [key, value] of Object.entries(fields))
    for (const text of notationsOf(value)) {
      const candidate = { ...fields, [key]: text };
      if (same(candidate)) {
        fields = candidate;
        break;
      }
    }
  for (const key of Object.keys(fields)) {
    const rest = Object.fromEntries(
      Object.entries(fields).filter(([k]) => k !== key),
    );
    if (Object.keys(rest).length > 0 && same(rest)) fields = rest;
  }
  const values = Object.values(fields);
  return values.length === 1 && same(values[0]) ? values[0] : fields;
}

/** The run's document as text, or undefined if the input does not run. */
function documentKey(id: string, input: unknown): string | undefined {
  const run = runAlgorithm(id, input);
  return run.ok ? JSON.stringify(run.value.document) : undefined;
}

/** Texts a field's value may be written as, shortest form first. */
function notationsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    const items = value as readonly unknown[];
    if (items.every(isItem)) {
      const list = printList(items);
      return list === undefined ? [] : [list.replaceAll(', ', ' '), list];
    }
    return [
      printCalls(items),
      printRows(items),
      printPreferences(items),
    ].filter((text): text is string => text !== undefined);
  }
  if (isFields(value) && Array.isArray(value['nodes'])) {
    const graph = printGraph(value as unknown as StructuredGraph);
    return graph === undefined ? [] : [graph];
  }
  return [];
}

const isItem = (item: unknown): item is number | null | string =>
  item === null || typeof item === 'number' || typeof item === 'string';

/**
 * Calls such as `{ op: "insert", key: 4 }` as `insert 4`, their arguments
 * in the order written; the run decides whether that is the order the
 * operation declares.
 */
function printCalls(items: readonly unknown[]): string | undefined {
  const calls: string[] = [];
  for (const item of items) {
    if (!isFields(item) || typeof item['op'] !== 'string') return undefined;
    const tokens = [item['op']];
    for (const [key, value] of Object.entries(item)) {
      if (key === 'op') continue;
      if (typeof value === 'number') tokens.push(String(value));
      else if (typeof value === 'string' && /^[^\s,]+$/.test(value))
        tokens.push(value);
      else return undefined;
    }
    calls.push(tokens.join(' '));
  }
  return calls.join(', ');
}

/** A matrix as rows separated by "; ", its numbers by spaces. */
function printRows(items: readonly unknown[]): string | undefined {
  if (items.length === 0) return undefined;
  const rows: string[] = [];
  for (const row of items) {
    if (!Array.isArray(row) || !row.every((x) => typeof x === 'number'))
      return undefined;
    rows.push(row.join(' '));
  }
  return rows.join('; ');
}

/** Ranked lists such as `["a", ["x", "y"]]` as `a: x y`. */
function printPreferences(items: readonly unknown[]): string | undefined {
  const lists: string[] = [];
  for (const item of items) {
    if (!Array.isArray(item) || item.length !== 2) return undefined;
    const [name, ranked] = item as [unknown, unknown];
    if (
      typeof name !== 'string' ||
      !Array.isArray(ranked) ||
      !ranked.every((x) => typeof x === 'string')
    )
      return undefined;
    lists.push(`${name}: ${ranked.join(' ')}`);
  }
  return lists.length === 0 ? undefined : lists.join(', ');
}
