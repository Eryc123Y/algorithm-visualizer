/**
 * The home page's playground in the browser (roadmap 5.1): the choice of
 * algorithm and the input field drive the player, the output tabs'
 * snippets and the share link. An input that does not fit shows its
 * error beside the field, and the last good run stays on screen. The
 * address keeps the run, so it can be shared. Everything is set as text
 * or properties, never as markup.
 */
import { SNIPPET_LANGUAGES } from './highlight.ts';
import { clientText } from './text/client.ts';
import { fillCode } from './highlight-dom.ts';
import type { PlaygroundFailure, PlaygroundResult } from './playground-run.ts';
import {
  runFromSearch,
  searchOf,
  type InputError,
  type PlaygroundRun,
} from './playground-state.ts';

/** The module that runs an input, loaded on first use. */
export interface PlaygroundRunner {
  runPlayground(
    algorithm: string,
    title: string,
    input: string,
    page?: { lang?: string; depth?: number },
  ): Promise<PlaygroundResult | PlaygroundFailure>;
}

export interface PlaygroundEnv {
  readonly location: Pick<Location, 'search' | 'hash' | 'pathname'>;
  readonly history: Pick<History, 'replaceState'>;
  readonly load: () => Promise<PlaygroundRunner>;
  /** How long typing must pause before a run, in milliseconds. */
  readonly delay?: number;
}

/** A started playground; `settled` waits for the latest run to show. */
export interface Playground {
  settled(): Promise<void>;
}

const DELAY_MS = 300;

interface Parts {
  readonly select: HTMLSelectElement;
  readonly input: HTMLTextAreaElement;
  readonly reset: HTMLButtonElement;
  readonly error: HTMLElement;
  /** The one live region: says an error once the reader pauses. */
  readonly announce: HTMLElement;
  readonly stage: HTMLElement;
  readonly player: HTMLElement & { visualization?: unknown };
  readonly caption: HTMLElement;
  readonly share: HTMLAnchorElement;
}

function partsOf(doc: Document): Parts | undefined {
  const root = doc.querySelector('.playground');
  if (root === null) return undefined;
  const parts = {
    select: root.querySelector('select'),
    input: root.querySelector('textarea'),
    reset: root.querySelector('.pg-reset'),
    error: root.querySelector('.pg-error'),
    announce: root.querySelector('.pg-announce'),
    stage: root.querySelector('.pg-stage'),
    player: root.querySelector('algo-player'),
    caption: root.querySelector('.pg-caption'),
    share: root.querySelector('.pg-share'),
  };
  return Object.values(parts).every((p) => p !== null)
    ? (parts as unknown as Parts)
    : undefined;
}

/** Starts the playground of `doc`, if it has one. */
export function setUpPlayground(
  doc: Document,
  env: PlaygroundEnv,
): Playground | undefined {
  const parts = partsOf(doc);
  if (parts === undefined) return undefined;
  const { select, input, reset, stage, player, caption, share } = parts;
  const optionOf = (id: string) =>
    [...select.options].find((o) => o.value === id);
  const exampleOf = (id: string) => optionOf(id)?.dataset['input'];
  const fallback: PlaygroundRun = {
    algorithm: select.value,
    input: input.value,
  };

  let latest = 0;
  let pending: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (): Promise<void> => {
    clearTimeout(timer);
    const request = ++latest;
    const wanted: PlaygroundRun = {
      algorithm: select.value,
      input: input.value,
    };
    const title = optionOf(wanted.algorithm)?.textContent ?? wanted.algorithm;
    pending = env
      .load()
      .then((runner) =>
        runner.runPlayground(wanted.algorithm, title, wanted.input, {
          lang: doc.documentElement.lang,
          // The share link is relative to the site's root, which a page
          // in a locale's folder is a folder further from.
          depth: Number(
            doc.querySelector<HTMLElement>('.playground')?.dataset['depth'] ??
              '0',
          ),
        }),
      )
      .then(
        (result) => {
          if (request !== latest) return;
          if (!result.ok) {
            showError(doc, parts, result.error);
            return;
          }
          showError(doc, parts, undefined);
          player.visualization = result.document;
          for (const s of result.snippets) setCode(doc, s.id, s.code);
          setCode(doc, 'slides', result.slides);
          share.href = result.link;
          setCaption(doc, caption, title, wanted.input);
          const { pathname, hash, search } = env.location;
          env.history.replaceState(
            null,
            '',
            `${pathname}${searchOf(wanted, exampleOf(wanted.algorithm), fallback, search)}${hash}`,
          );
        },
        (e: unknown) => {
          if (request !== latest) return;
          showError(doc, parts, {
            message: clientText(
              doc.documentElement.lang,
            ).playground.couldNotRun(
              e instanceof Error ? e.message : String(e),
            ),
          });
        },
      );
    return pending;
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), env.delay ?? DELAY_MS);
  };
  const toExample = () => {
    input.value = exampleOf(select.value) ?? '';
    void run();
  };

  select.addEventListener('change', toExample);
  reset.addEventListener('click', toExample);
  input.addEventListener('input', later);
  // An input is one line: Enter runs it at once, without waiting. While
  // an input method composes (Chinese, Japanese, Korean), Enter confirms
  // the candidate, so it is left alone; keyCode 229 catches Safari's late
  // keydown.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void run();
  });
  keepHeight(doc, stage);

  const asked = runFromSearch(env.location.search, exampleOf, fallback);
  if (
    asked.algorithm !== fallback.algorithm ||
    asked.input !== fallback.input
  ) {
    select.value = asked.algorithm;
    input.value = asked.input;
    void run();
  }
  return {
    settled: async () => {
      // A run may start while another is awaited: wait for the last.
      let seen: Promise<void> | undefined;
      while (seen !== pending) {
        seen = pending;
        await seen;
      }
    },
  };
}

/** Sets the code of the snippet in output `id`'s panel, coloured. */
function setCode(doc: Document, id: string, code: string): void {
  const el = doc.querySelector(`#panel-${id} .snippet pre code`);
  if (el !== null) fillCode(el, code, SNIPPET_LANGUAGES[id]);
}

function setCaption(
  doc: Document,
  caption: HTMLElement,
  title: string,
  input: string,
): void {
  const code = doc.createElement('code');
  code.textContent = input;
  const [before, after] = clientText(
    doc.documentElement.lang,
  ).playground.caption(title);
  caption.replaceChildren(before, code, after);
}

const ANNOUNCE_MS = 500;
const announcing = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Shows `error` beside the field, or clears it. The field points at the
 * error only while there is one, and the page's live region says it a
 * moment later, once, so it does not talk over the typing.
 */
function showError(
  doc: Document,
  { input, error: box, announce }: Parts,
  error: InputError | undefined,
): void {
  clearTimeout(announcing.get(announce));
  if (error === undefined) {
    input.setAttribute('aria-invalid', 'false');
    input.removeAttribute('aria-describedby');
    box.replaceChildren();
    announce.textContent = '';
    return;
  }
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', box.id);
  const t = clientText(doc.documentElement.lang).playground;
  const said = `${t.doesNotRun} ${error.message}`;
  if (announce.textContent !== said)
    announcing.set(
      announce,
      setTimeout(() => {
        announce.textContent = said;
      }, ANNOUNCE_MS),
    );
  const p = (className: string, ...nodes: (Node | string)[]) => {
    const el = doc.createElement('p');
    el.className = className;
    el.append(...nodes);
    return el;
  };
  const strong = doc.createElement('strong');
  strong.textContent = t.doesNotRun;
  const lines: HTMLElement[] = [p('pg-message', strong, ` ${error.message}`)];
  if (error.at !== undefined) {
    const code = doc.createElement('code');
    const mark = doc.createElement('mark');
    mark.textContent = error.at.token;
    code.append(error.at.before, mark, error.at.after);
    lines.push(p('pg-where', code));
  }
  if (error.hint !== undefined) lines.push(p('pg-hint', error.hint));
  lines.push(p('pg-kept', t.kept));
  box.replaceChildren(...lines);
}

/**
 * Keeps the stage at least as tall as it has been, so a smaller figure
 * does not pull the page up under the reader.
 */
function keepHeight(doc: Document, stage: HTMLElement): void {
  const view = doc.defaultView;
  if (view === null || !('ResizeObserver' in view)) return;
  let tallest = 0;
  new view.ResizeObserver(() => {
    const height = stage.getBoundingClientRect().height;
    if (height > tallest) {
      tallest = height;
      stage.style.minBlockSize = `${Math.ceil(height)}px`;
    }
  }).observe(stage);
  // A new width lays the player out anew: start measuring again.
  let width = view.innerWidth;
  view.addEventListener('resize', () => {
    if (view.innerWidth === width) return;
    width = view.innerWidth;
    tallest = 0;
    stage.style.minBlockSize = '';
  });
}
