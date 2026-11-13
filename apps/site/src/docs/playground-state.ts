/**
 * The home page's playground (roadmap 5.1), the parts with no DOM: the
 * run a page address asks for, the address of a run, and where in the
 * input an error points. The browser and the tests share them.
 */
import type { Diagnostic } from '@algomotion/spec';

/** What the playground shows: a module of the registry and its input. */
export interface PlaygroundRun {
  readonly algorithm: string;
  readonly input: string;
}

const ALGORITHM = 'algorithm';
const INPUT = 'input';

/**
 * The run a query string asks for: a known algorithm, and its input or
 * else `exampleOf` it. Anything else is the default run.
 */
export function runFromSearch(
  search: string,
  exampleOf: (algorithm: string) => string | undefined,
  fallback: PlaygroundRun,
): PlaygroundRun {
  const params = new URLSearchParams(search);
  const algorithm = params.get(ALGORITHM);
  const example = algorithm === null ? undefined : exampleOf(algorithm);
  if (algorithm === null || example === undefined) return fallback;
  return { algorithm, input: params.get(INPUT) ?? example };
}

/**
 * The query string that keeps `run`, other parameters kept: empty for
 * the default run, so the home page's address stays plain. An input
 * equal to the algorithm's example is left out.
 */
export function searchOf(
  run: PlaygroundRun,
  example: string | undefined,
  fallback: PlaygroundRun,
  search = '',
): string {
  const params = new URLSearchParams(search);
  params.delete(ALGORITHM);
  params.delete(INPUT);
  const isDefault =
    run.algorithm === fallback.algorithm && run.input === fallback.input;
  if (!isDefault) {
    params.set(ALGORITHM, run.algorithm);
    if (run.input !== example) params.set(INPUT, run.input);
  }
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/** An error, and the part of the input it names, if it names one. */
export interface InputError {
  readonly message: string;
  readonly hint?: string;
  /** The input split around the token the error names. */
  readonly at?: {
    readonly before: string;
    readonly token: string;
    readonly after: string;
  };
}

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where `name` first stands as a whole word in `text`, from `from`. */
function wordAt(text: string, name: string, from: number): number | undefined {
  const word = new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`, 'g');
  word.lastIndex = from;
  return word.exec(text)?.index;
}

/**
 * Where `diagnostic` points in `input`: the notation readers' `(character
 * N)` with the token quoted after `not`; else that token, or the first
 * other quoted name, where the input holds it as a whole word, such as
 * `"Z" is not a node of the graph`.
 */
export function inputError(input: string, diagnostic: Diagnostic): InputError {
  const base = {
    message: diagnostic.message,
    ...(diagnostic.hint === undefined ? {} : { hint: diagnostic.hint }),
  };
  const split = (start: number, length: number) => ({
    ...base,
    at: {
      before: input.slice(0, start),
      token: input.slice(start, start + length),
      after: input.slice(start + length),
    },
  });
  const quoted = [...diagnostic.message.matchAll(/"([^"]+)"/g)].map(
    (m) => m[1]!,
  );
  const named = /not "([^"]+)"/.exec(diagnostic.message)?.[1];
  // A character counts from the start of the text read, which is the
  // whole input only when the input is that text, not a field of it.
  const character = /\(character (\d+)\)/.exec(diagnostic.message);
  if (character !== null && diagnostic.path === '$.input') {
    const start = Number(character[1]) - 1;
    if (named !== undefined && input.startsWith(named, start))
      return split(start, named.length);
    if (named === undefined && start >= 0 && start < input.length)
      return split(start, 1);
  }
  // The token a reader rejected comes first, looked for after the text
  // the message says it follows; then any other name with a letter.
  const after = /after "([^"]+)"/.exec(diagnostic.message)?.[1];
  const names = [
    ...(named === undefined ? [] : [named]),
    ...quoted.filter((q) => q !== named && /\w/.test(q)),
  ];
  for (const name of names) {
    const from =
      name === named && after !== undefined
        ? wordAt(input, after, 0)
        : undefined;
    const start =
      from === undefined
        ? undefined
        : wordAt(input, name, from + after!.length);
    const found = start ?? wordAt(input, name, 0);
    if (found !== undefined) return split(found, name.length);
  }
  return base;
}
