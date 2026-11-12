/**
 * What the share page does with a fragment (ADR 0040): it reads it with
 * the spec's codec and hands the content to a fresh `<algo-player>`,
 * which validates a document with the spec parser, or runs an algorithm
 * on its input. Nothing from the fragment becomes markup: values are set
 * as properties and attributes, and errors are written as text.
 */
import {
  err,
  readShareFragment,
  type Diagnostic,
  type Result,
  type ShareContent,
} from '@algoviz/spec';

/** The parts of the page that show what a link holds. */
export interface PlayPage {
  /** What the page is for, shown when the link carries nothing. */
  readonly intro: HTMLElement;
  /** Why a link cannot be read; holds `errors`. */
  readonly problem: HTMLElement;
  readonly errors: HTMLElement;
  /** Where the player goes. */
  readonly stage: HTMLElement;
}

/** The player's properties that the page sets. */
interface Player extends HTMLElement {
  visualization: unknown;
  algorithm: string | undefined;
  input: unknown;
  theme: string;
}

const PAGE_TITLE = 'algoviz player';

/** The last fragment asked for; an earlier one still reading is dropped. */
let latest = 0;

/** Shows what a fragment holds: the intro, its errors, or a player. */
export async function showFragment(
  fragment: string,
  page: PlayPage,
): Promise<void> {
  const request = ++latest;
  let read: Read;
  try {
    read = await readShareFragment(fragment);
  } catch (e) {
    read = err([internalError(e)]);
  }
  if (request !== latest) return;
  try {
    show(read, page, request);
  } catch (e) {
    show(err([internalError(e)]), page, request);
  }
}

/** What reading a fragment gave, or why the page could not. */
type Read = Result<ShareContent | undefined, readonly Diagnostic[]>;

function show(read: Read, page: PlayPage, request: number): void {
  page.stage.replaceChildren();
  page.errors.replaceChildren();
  page.intro.hidden = !(read.ok && read.value === undefined);
  page.problem.hidden = read.ok;
  const doc = page.stage.ownerDocument;
  doc.title = PAGE_TITLE;

  if (!read.ok) {
    page.errors.append(...read.error.map((e) => errorItem(doc, e)));
    return;
  }
  if (read.value === undefined) return;
  const content = read.value;
  const player = createPlayer(doc, content);
  // Name the tab only once the player has accepted the content.
  player.addEventListener(
    'algo-load',
    () => {
      const title = titleOf(content);
      if (request === latest && title !== undefined)
        doc.title = `${title} · algoviz`;
    },
    { once: true },
  );
  page.stage.append(player);
}

/** A failure of the page itself, which should never happen. */
const internalError = (e: unknown): Diagnostic => ({
  code: 'INTERNAL',
  path: '$',
  message: `The page failed: ${e instanceof Error ? e.message : String(e)}`,
  hint: 'Reload the page; if it fails again, the link may be fine but this page is not.',
});

/** A player for the content, set up before it connects. */
function createPlayer(doc: Document, content: ShareContent): Player {
  const player = doc.createElement('algo-player') as Player;
  if ('document' in content) player.visualization = content.document;
  else {
    player.algorithm = content.algorithm;
    player.input = content.input;
  }
  player.theme = content.theme ?? 'auto';
  // As the attribute: digits are a frame number, anything else a selector.
  if (content.frame !== undefined)
    player.setAttribute('frame', String(content.frame));
  return player;
}

/**
 * A document's title, or the algorithm's id, for the tab: without control
 * or direction characters, which could make it read as something else.
 */
function titleOf(content: ShareContent): string | undefined {
  const doc = 'document' in content ? content.document : undefined;
  const raw =
    'algorithm' in content
      ? content.algorithm
      : typeof doc === 'object' && doc !== null && 'title' in doc
        ? doc.title
        : undefined;
  if (typeof raw !== 'string') return undefined;
  const title = raw
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      '',
    )
    .trim()
    .slice(0, 120);
  return title === '' ? undefined : title;
}

function errorItem(doc: Document, error: Diagnostic): HTMLLIElement {
  const item = doc.createElement('li');
  const code = doc.createElement('code');
  code.textContent = error.code;
  const message = doc.createElement('span');
  message.textContent = ` ${error.message}.`;
  item.append(code, message);
  if (error.hint !== undefined) {
    const hint = doc.createElement('p');
    hint.className = 'hint';
    hint.textContent = error.hint;
    item.append(hint);
  }
  return item;
}
