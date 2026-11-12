/**
 * The B-tree notation (ADR 0035): a node is its keys in brackets, followed
 * by its children in parentheses, `[G M] ([A C] [H K] [N R])`. Keys are
 * numbers, or words of letters and digits; when every key reads as a
 * number they are numbers.
 */
import { NotationError, quoted } from '../../notation/error.ts';
import { NUMBER } from '../../notation/list.ts';
import type { KeyValue, NodeShape } from './model.ts';

export const TREE_FORM =
  'nodes as keys in brackets, each followed by its children in parentheses, e.g. "[G M] ([A C] [H K] [N R])"';

const WORD = /^[A-Za-z0-9]{1,8}$/;

/** The keys of a list, as numbers if every one is a number. */
export function keyValues(tokens: readonly string[]): KeyValue[] {
  return tokens.every((t) => NUMBER.test(t)) ? tokens.map(Number) : [...tokens];
}

/** The tree `text` writes; throws a NotationError at a bad token. */
export function parseTree(text: string): NodeShape {
  let at = 0;
  const raw: string[] = [];
  const skip = () => {
    while (at < text.length && /[\s,]/.test(text[at]!)) at++;
  };
  type Raw = { keys: string[]; children: Raw[] };
  const node = (depth: number): Raw => {
    if (depth > 32) throw new NotationError('Brackets nest too deep', at);
    skip();
    if (text[at] !== '[')
      throw new NotationError(
        at >= text.length
          ? 'Expected a node in brackets'
          : `Expected a node in brackets, not ${quoted(text[at]!)}`,
        at,
      );
    const close = text.indexOf(']', at);
    if (close < 0) throw new NotationError('A bracket is not closed', at);
    const inner = text.slice(at + 1, close);
    const keys: string[] = [];
    for (const m of inner.matchAll(/[^\s,]+/g)) {
      if (!WORD.test(m[0]) && !NUMBER.test(m[0]))
        throw new NotationError(
          `A key is a number or a word of letters and digits, not ${quoted(m[0])}`,
          at + 1 + m.index,
        );
      keys.push(m[0]);
      raw.push(m[0]);
    }
    at = close + 1;
    skip();
    const children: Raw[] = [];
    if (text[at] === '(') {
      at++;
      for (skip(); text[at] !== ')'; skip()) {
        if (at >= text.length)
          throw new NotationError('A parenthesis is not closed', at);
        children.push(node(depth + 1));
      }
      at++;
    }
    return { keys, children };
  };
  const tree = node(0);
  skip();
  if (at < text.length)
    throw new NotationError(`Unexpected ${quoted(text.slice(at, at + 8))}`, at);
  // One type for the whole tree: numbers only if every key is one.
  const numeric = raw.every((t) => NUMBER.test(t));
  const shape = (r: Raw): NodeShape => ({
    keys: r.keys.map((k) => (numeric ? Number(k) : k)),
    ...(r.children.length === 0 ? {} : { children: r.children.map(shape) }),
  });
  return shape(tree);
}
