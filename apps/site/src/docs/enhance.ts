/**
 * What the documentation pages add in the browser (roadmap 3.4): a copy
 * button on each snippet, and a filter over the catalogue. The pages read
 * and work without them. Everything is set as text, never as markup.
 */

/** The part of the Clipboard API used here. */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
}

const COPIED_MS = 1600;

/** Each button's pending reset, so a second click restarts it. */
const resets = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

/**
 * Puts a copy button beside each snippet's heading. A share link is copied as
 * a whole address, resolved against `page`.
 */
export function addCopyButtons(
  doc: Document,
  clipboard: TextClipboard | undefined,
  page: string,
): void {
  if (clipboard === undefined) return;
  // One live region tells screen readers what a button did.
  const status = doc.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  doc.body.append(status);
  for (const snippet of doc.querySelectorAll<HTMLElement>('.snippet')) {
    const heading = snippet.querySelector('h3');
    const code = snippet.querySelector('pre code');
    if (heading === null || code === null) continue;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', `Copy: ${heading.textContent ?? ''}`);
    button.addEventListener('click', () => {
      const text = code.textContent ?? '';
      const value =
        snippet.dataset['snippet'] === 'link' ? new URL(text, page).href : text;
      clipboard.writeText(value).then(
        () => say(button, status, 'Copied'),
        () => say(button, status, 'Select and copy'),
      );
    });
    // Beside the heading, so the heading's name stays its own.
    heading.after(button);
  }
}

function say(
  button: HTMLButtonElement,
  status: HTMLElement,
  text: string,
): void {
  button.textContent = text;
  status.textContent = text;
  clearTimeout(resets.get(button));
  resets.set(
    button,
    setTimeout(() => {
      button.textContent = 'Copy';
      status.textContent = '';
    }, COPIED_MS),
  );
}

/**
 * Shows the catalogue's entries whose words contain every word of
 * `query`, and the topics that still have one, and says how many in the
 * page's status line, which screen readers announce.
 */
export function filterCatalog(doc: Document, query: string): void {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  let total = 0;
  for (const topic of doc.querySelectorAll<HTMLElement>('.topic')) {
    let here = 0;
    for (const item of topic.querySelectorAll<HTMLElement>('[data-search]')) {
      const haystack = item.dataset['search'] ?? '';
      item.hidden = !words.every((w) => haystack.includes(w));
      total++;
      if (!item.hidden) here++;
    }
    topic.hidden = here === 0;
    shown += here;
  }
  const status = doc.querySelector<HTMLElement>('.filter-status');
  if (status !== null)
    status.textContent =
      words.length === 0
        ? ''
        : shown === 0
          ? 'Nothing matches; try fewer words.'
          : `${shown} of ${total} shown.`;
}
