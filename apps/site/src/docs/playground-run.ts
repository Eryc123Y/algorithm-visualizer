/**
 * The home page's playground (roadmap 5.1), run in the browser: an
 * algorithm of the registry on the text a reader typed, and the same run
 * written for every output, by the same code the build uses for the
 * pages' snippets. The page imports this module on first use, so the
 * registry loads with the player's, in one shared file.
 */
import { readInput, runAlgorithm } from '@algomotion/recipes';

import { inputError, type InputError } from './playground-state.ts';
import {
  inputText,
  slidesCode,
  snippetsFor,
  type Snippet,
} from './snippets.ts';

/** A run that worked: its document and its snippets. */
export interface PlaygroundResult {
  readonly ok: true;
  readonly document: unknown;
  readonly snippets: readonly Snippet[];
  /** The run as Beamer overlays. */
  readonly slides: string;
  /** The share page's address for the run, relative to the site's root. */
  readonly link: string;
}

export interface PlaygroundFailure {
  readonly ok: false;
  readonly error: InputError;
}

const EMPTY: InputError = {
  message: 'The input is empty.',
  hint: 'Write an input, or choose the algorithm again to get its example back.',
};

/** Runs `algorithm`, titled `title`, on the text `input`. */
export async function runPlayground(
  algorithm: string,
  title: string,
  input: string,
): Promise<PlaygroundResult | PlaygroundFailure> {
  const read = readInput(input);
  if (!read.ok) return { ok: false, error: inputError(input, read.error[0]!) };
  if (read.value === undefined) return { ok: false, error: EMPTY };
  const ran = runAlgorithm(algorithm, read.value);
  if (!ran.ok) return { ok: false, error: inputError(input, ran.error[0]!) };
  const snippets = await snippetsFor(algorithm, read.value, 0);
  return {
    ok: true,
    document: ran.value.document,
    snippets,
    slides: slidesCode(title, algorithm, inputText(read.value)),
    link: snippets.find((s) => s.id === 'link')!.code,
  };
}
