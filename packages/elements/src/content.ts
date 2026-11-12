/**
 * What a player shows (ADR 0010, 0032): a document, or an algorithm of
 * the registry run on its input. The registry is loaded on first use, so
 * a page that shows documents never loads it; the standalone bundle keeps
 * it in a second file, `algomotion-recipes.js`, next to the player's.
 */
import type * as Recipes from '@algomotion/recipes';
import { err, ok, type Diagnostic, type Result } from '@algomotion/spec';

export interface Content {
  /** A document object; wins over everything else. */
  readonly visualization: unknown;
  /** A registry id: the content is then this algorithm's input. */
  readonly algorithm: string | undefined;
  /** The input: text, read as JSON or a notation, or any other value. */
  readonly input: unknown;
  /** URL of a JSON document, or of the algorithm's input. */
  readonly src: string | undefined;
  /** The parsed inline JSON: a document, or the algorithm's input. */
  readonly inline: unknown;
}

type Loaded = Result<unknown, readonly Diagnostic[]>;
type Registry = typeof Recipes;

let registry: Promise<Registry> | undefined;

/** The registry, imported once for every player on the page. */
function loadRegistry(): Promise<Registry> {
  registry ??= import('@algomotion/recipes').catch((e: unknown) => {
    // Let a later player try again.
    registry = undefined;
    throw e;
  });
  return registry;
}

/**
 * The document to show; undefined while there is none, such as before
 * inline JSON is read. Synchronous unless it has to fetch or run, so a
 * document given directly loads at once.
 */
export function documentOf(content: Content): Loaded | Promise<Loaded> {
  if (content.visualization !== undefined) return ok(content.visualization);
  if (content.algorithm) return run(content.algorithm, content);
  return content.src ? fetchJson(content.src) : ok(content.inline);
}

async function run(algorithm: string, content: Content): Promise<Loaded> {
  const given =
    content.input !== undefined
      ? ok(content.input)
      : content.src
        ? await fetchJson(content.src)
        : ok(content.inline);
  if (!given.ok) return given;
  let recipes: Registry;
  try {
    recipes = await loadRegistry();
  } catch (e) {
    return err([
      loadError('the algorithm registry (algomotion-recipes.js)', e),
    ]);
  }
  // Text, from the attribute or the property, is read as JSON or a notation.
  const input =
    typeof content.input === 'string'
      ? recipes.readInput(content.input)
      : ok(given.value);
  if (!input.ok) return input;
  const ran = recipes.runAlgorithm(algorithm, input.value);
  return ran.ok ? ok(ran.value.document) : ran;
}

async function fetchJson(src: string): Promise<Loaded> {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return ok((await response.json()) as unknown);
  } catch (error) {
    return err([loadError(src, error)]);
  }
}

export function loadError(what: string, error: unknown): Diagnostic {
  return {
    code: 'LOAD_FAILED',
    path: '$',
    message: `Could not load ${what}: ${error instanceof Error ? error.message : String(error)}`,
  };
}
