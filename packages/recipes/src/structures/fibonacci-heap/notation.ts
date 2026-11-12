/**
 * The forest notation of the Fibonacci heap (ADR 0034): trees left to
 * right, each a key with its children in brackets and `*` after a marked
 * node, such as `23 7 3(18*(39*) 52 38(41)) 17(30)`. Trees and siblings
 * are separated by spaces or commas.
 */
import { NotationError, quoted } from '../../notation/error.ts';
import { numberAt } from '../../notation/list.ts';
import type { Entry } from './model.ts';

export const FOREST_FORM =
  'trees separated by spaces, each a key with its children in brackets and * after a marked node, e.g. "23 7 3(18*(39*) 52 38(41)) 17(30)"';

const SEPARATOR = /[\s,]/;
const KEY_END = /[\s,()*]/;

/** The forest `text` writes; throws a NotationError at a bad token. */
export function parseForest(text: string): Entry[] {
  let at = 0;
  const skip = () => {
    while (at < text.length && SEPARATOR.test(text[at]!)) at++;
  };
  let depth = 0;
  const forest = (closing: boolean): Entry[] => {
    const trees: Entry[] = [];
    for (;;) {
      skip();
      if (at >= text.length) {
        if (closing) throw new NotationError('A bracket is not closed', at);
        return trees;
      }
      if (text[at] === ')') {
        if (!closing) throw new NotationError(`Unexpected ${quoted(')')}`, at);
        at++;
        return trees;
      }
      trees.push(tree());
    }
  };
  const tree = (): Entry => {
    const start = at;
    while (at < text.length && !KEY_END.test(text[at]!)) at++;
    if (at === start)
      throw new NotationError(`Expected a key, not ${quoted(text[at]!)}`, at);
    const key = numberAt(text.slice(start, at), start, 'a key');
    let marked = false;
    if (text[at] === '*') {
      marked = true;
      at++;
    }
    if (text[at] !== '(') return marked ? { key, marked } : { key };
    // A heap holds at most 32 keys, so deeper brackets are a mistake.
    if (++depth > 32) throw new NotationError('Brackets nest too deep', at);
    at++;
    const children = forest(true);
    depth--;
    if (children.length === 0)
      throw new NotationError(`${quoted('()')} has no children`, at - 1);
    return { key, ...(marked ? { marked } : {}), children };
  };
  return forest(false);
}
