/**
 * What the share page does with a fragment (ADR 0040): it reads it with
 * the spec's codec and hands the content to a fresh `<algo-player>`,
 * which validates a document with the spec parser, or runs an algorithm
 * on its input. Nothing from the fragment becomes markup: values are set
 * as properties and attributes, and errors are written as text.
 */
import {
  readShareFragment,
  type Diagnostic,
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
  const read = await readShareFragment(fragment);
  if (request !== latest) return;

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
  page.stage.append(createPlayer(doc, read.value));
  const title = titleOf(read.value);
  if (title !== undefined) doc.title = `${title} · algoviz`;
}

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

/** A document's title, or the algorithm's id. */
function titleOf(content: ShareContent): string | undefined {
  if (!('document' in content)) return content.algorithm;
  const doc = content.document;
  const title =
    typeof doc === 'object' && doc !== null && 'title' in doc
      ? doc.title
      : undefined;
  return typeof title === 'string' && title.trim() !== ''
    ? title.slice(0, 120)
    : undefined;
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
