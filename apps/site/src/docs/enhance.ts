/**
 * What the documentation pages add in the browser (roadmap 3.4): a copy
 * button on each snippet, and a filter over the catalogue. The pages read
 * and work without them. Everything is set as text, never as markup.
 */
import { clientText } from './text/client.ts';

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
  const t = clientText(doc.documentElement.lang);
  // One live region tells screen readers what a button did.
  const status = doc.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  doc.body.append(status);
  for (const snippet of doc.querySelectorAll<HTMLElement>('.snippet')) {
    const heading = snippet.querySelector('h3');
    const code = snippet.querySelector('pre code');
    const label = heading?.textContent ?? snippet.dataset['label'];
    if (code === null || label === undefined) continue;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = t.copy;
    button.setAttribute('aria-label', t.copyLabel(label));
    button.addEventListener('click', () => {
      const text = code.textContent ?? '';
      const value =
        snippet.dataset['snippet'] === 'link' ? new URL(text, page).href : text;
      clipboard.writeText(value).then(
        () => say(button, status, t.copied, t.copy),
        () => say(button, status, t.selectToCopy, t.copy),
      );
    });
    // Beside the heading, so the heading's name stays its own; else first.
    if (heading === null) snippet.prepend(button);
    else heading.after(button);
  }
}

function say(
  button: HTMLButtonElement,
  status: HTMLElement,
  text: string,
  idle: string,
): void {
  button.textContent = text;
  status.textContent = text;
  clearTimeout(resets.get(button));
  resets.set(
    button,
    setTimeout(() => {
      button.textContent = idle;
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
          ? clientText(doc.documentElement.lang).filterNone
          : clientText(doc.documentElement.lang).filterCount(shown, total);
}

/** How a panel comes in: a short fade, rising a few pixels. */
const ENTER: Keyframe[] = [
  { opacity: 0, translate: '0 0.375rem' },
  { opacity: 1, translate: '0 0' },
];

/**
 * Shows that `panel` replaced another, unless the reader asked for less
 * motion; it always ends fully shown.
 */
function enter(doc: Document, panel: HTMLElement): void {
  const view = doc.defaultView;
  if (
    typeof panel.animate !== 'function' ||
    view?.matchMedia?.('(prefers-reduced-motion: no-preference)').matches !==
      true
  )
    return;
  panel.animate(ENTER, { duration: 180, easing: 'ease-out' });
}

/**
 * Tabs (the home page's outputs): the selected tab shows its panel, and
 * the others are hidden until found, so find-in-page still reaches them.
 * Arrow keys, Home and End move between tabs; selection follows focus.
 * Browsers with `focusgroup` move focus themselves.
 */
export function setUpTabs(doc: Document): void {
  for (const list of doc.querySelectorAll<HTMLElement>('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panelOf = (tab: HTMLElement) =>
      doc.querySelector<HTMLElement>(`[aria-labelledby="${tab.id}"]`);
    const select = (selected: HTMLButtonElement, focus: boolean) => {
      for (const tab of tabs) {
        const on = tab === selected;
        tab.setAttribute('aria-selected', String(on));
        tab.toggleAttribute('focusgroupstart', on);
        tab.tabIndex = on ? 0 : -1;
        const panel = panelOf(tab);
        if (panel === null) continue;
        if (on) {
          const shown = !panel.hasAttribute('hidden');
          panel.removeAttribute('hidden');
          if (!shown) enter(doc, panel);
        } else panel.setAttribute('hidden', 'until-found');
      }
      if (focus) selected.focus();
    };
    for (const tab of tabs) {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('focus', () => {
        if (tab.getAttribute('aria-selected') !== 'true') select(tab, false);
      });
      panelOf(tab)?.addEventListener('beforematch', () => select(tab, false));
    }
    if ('focusGroup' in HTMLElement.prototype) continue;
    list.addEventListener('keydown', (event) => {
      const at = tabs.indexOf(event.target as HTMLButtonElement);
      if (at < 0) return;
      const next =
        event.key === 'ArrowRight'
          ? (at + 1) % tabs.length
          : event.key === 'ArrowLeft'
            ? (at - 1 + tabs.length) % tabs.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? tabs.length - 1
                : -1;
      if (next < 0) return;
      event.preventDefault();
      select(tabs[next]!, true);
    });
  }
}

const STEP_MS = 2400;

/**
 * The slides tab's overlays, played in one frame as a slide steps through
 * them, with a button to pause. Only with script, so a reader can always
 * stop it (WCAG 2.2.2), and only for readers who have not asked for less
 * motion; it runs while it is on screen. Otherwise the overlays stay a
 * list, side by side.
 */
export function loopOverlays(doc: Document, step = STEP_MS): void {
  const view = doc.defaultView;
  const list = doc.querySelector<HTMLElement>('.overlays');
  if (
    list === null ||
    view === null ||
    view.matchMedia?.('(prefers-reduced-motion: no-preference)').matches !==
      true
  )
    return;
  const items = [...list.querySelectorAll<HTMLElement>(':scope > li')];
  if (items.length < 2) return;
  let at = 0;
  let paused = false;
  let visible = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const show = () =>
    items.forEach((item, k) => item.classList.toggle('on', k === at));
  const sync = () => {
    clearInterval(timer);
    timer = undefined;
    if (paused || !visible) return;
    timer = setInterval(() => {
      at = (at + 1) % items.length;
      show();
    }, step);
  };
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'overlays-pause';
  const t = clientText(doc.documentElement.lang);
  button.textContent = t.pause;
  button.addEventListener('click', () => {
    paused = !paused;
    button.textContent = paused ? t.play : t.pause;
    sync();
  });
  list.classList.add('looping');
  show();
  list.after(button);
  if (!('IntersectionObserver' in view)) {
    visible = true;
    sync();
    return;
  }
  new view.IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(list);
}

/**
 * Marks each catalogue thumbnail still loading, so its frame shows a
 * quiet placeholder rather than an empty cell, until the figure arrives
 * or fails.
 */
export function markLoadingThumbnails(doc: Document): void {
  for (const img of doc.querySelectorAll<HTMLImageElement>('.thumb img')) {
    if (img.complete) continue;
    const frame = img.closest('.thumb');
    if (frame === null) continue;
    frame.classList.add('pending');
    const done = () => frame.classList.remove('pending');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }
}
