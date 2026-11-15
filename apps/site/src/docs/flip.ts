/**
 * The catalogue's thumbnails as flipbooks, and the title that carries a
 * card into its page.
 *
 * Hovering or focusing a card flips its thumbnail through a few frames of
 * the run, drawn at build time beside it (`data-flip`, `data-frames`), with
 * a ruler under it marking the frame. Readers who ask for less motion, and
 * screens without hover, keep the still thumbnail.
 *
 * Opening a card lends it the page title's view-transition name, so its
 * title grows into the next page's heading (base.css opts in to
 * cross-document transitions).
 */

/** How long each frame shows, in milliseconds: well under three a second. */
export const FLIP_INTERVAL = 700;

/** Loads a drawing before it is shown, so a flip never shows a blank. */
export type Preload = (url: string) => Promise<void>;

const preloadImage: Preload = (url) => {
  const image = new Image();
  image.src = url;
  return image.decode().catch(() => undefined);
};

/** The frames `thumb` flips through, from its `data-frames`. */
export function framesOf(thumb: HTMLElement): number[] {
  return (thumb.dataset['frames'] ?? '')
    .split(',')
    .filter((n) => /^\d+$/.test(n))
    .map(Number);
}

/** The drawing of `frame` in `theme`, beside the thumbnail at `stem`. */
export function flipUrl(
  stem: string,
  frame: number,
  theme: 'light' | 'dark',
): string {
  return `${stem}-f${frame}-${theme}.svg`;
}

/** Marks the ruler's cells before `k` done and cell `k` now. */
function mark(ruler: HTMLElement, k: number): void {
  [...ruler.children].forEach((cell, j) => {
    cell.className = j < k ? 'done' : j === k ? 'now' : '';
  });
}

/** Makes one thumbnail a flipbook. */
function flipbook(thumb: HTMLElement, view: Window, preload: Preload): void {
  const stem = thumb.dataset['flip'];
  const frames = framesOf(thumb);
  const img = thumb.querySelector('img');
  const source = thumb.querySelector('source');
  const link = thumb.closest('a');
  if (!stem || frames.length < 2 || !img || !link) return;
  const still = {
    src: img.getAttribute('src') ?? '',
    srcset: source?.getAttribute('srcset') ?? '',
  };

  const ruler = thumb.ownerDocument.createElement('span');
  ruler.className = 'thumb-ruler';
  ruler.setAttribute('aria-hidden', 'true');
  ruler.append(...frames.map(() => thumb.ownerDocument.createElement('span')));
  thumb.append(ruler);

  const show = (k: number) => {
    img.setAttribute('src', flipUrl(stem, frames[k]!, 'light'));
    source?.setAttribute('srcset', flipUrl(stem, frames[k]!, 'dark'));
    mark(ruler, k);
  };

  // Each hover is a run of its own; leaving ends it, loaded or not.
  let run = 0;
  let timer: number | undefined;
  const start = async () => {
    const mine = ++run;
    const dark = view.matchMedia('(prefers-color-scheme: dark)').matches;
    await Promise.all(
      frames.map((f) => preload(flipUrl(stem, f, dark ? 'dark' : 'light'))),
    );
    if (mine !== run) return;
    thumb.classList.add('flipping');
    let k = 0;
    const next = () => {
      show(k);
      k = (k + 1) % frames.length;
      timer = view.setTimeout(next, FLIP_INTERVAL);
    };
    next();
  };
  const stop = () => {
    run++;
    if (timer !== undefined) view.clearTimeout(timer);
    timer = undefined;
    thumb.classList.remove('flipping');
    img.setAttribute('src', still.src);
    source?.setAttribute('srcset', still.srcset);
  };

  link.addEventListener('pointerenter', () => void start());
  link.addEventListener('focusin', () => void start());
  link.addEventListener('pointerleave', stop);
  link.addEventListener('focusout', stop);
}

/** Makes every catalogue thumbnail with frames a flipbook. */
export function setUpFlip(
  doc: Document,
  view: Window,
  preload: Preload = preloadImage,
): void {
  const motion = view.matchMedia(
    '(hover: hover) and (prefers-reduced-motion: no-preference)',
  );
  if (!motion.matches) return;
  for (const thumb of doc.querySelectorAll<HTMLElement>('.thumb[data-flip]'))
    flipbook(thumb, view, preload);
}

/**
 * Before leaving for `to`, lends the page title's transition name to the
 * title of the card that links there, and takes it from the page's own
 * heading, since two elements cannot share a name. Returns the undo.
 */
export function nameTitleFor(
  doc: Document,
  to: string,
  base: string,
): () => void {
  const card = [...doc.querySelectorAll<HTMLAnchorElement>('.card > a')].find(
    (a) => new URL(a.getAttribute('href') ?? '', base).href === to,
  );
  const title = card?.querySelector<HTMLElement>('.card-title');
  const heading = doc.querySelector<HTMLElement>('main h1');
  if (!title) return () => {};
  title.style.viewTransitionName = 'page-title';
  if (heading) heading.style.viewTransitionName = 'none';
  return () => {
    title.style.viewTransitionName = '';
    if (heading) heading.style.viewTransitionName = '';
  };
}

interface PageSwap extends Event {
  readonly activation: { readonly entry: { readonly url: string } } | null;
  readonly viewTransition: {
    readonly ready: Promise<void>;
    readonly updateCallbackDone: Promise<void>;
    readonly finished: Promise<void>;
  } | null;
}

/** Carries the opened card's title into the next page, where supported. */
export function setUpTitleMorph(doc: Document, view: Window): void {
  view.addEventListener('pageswap', (event) => {
    const swap = event as PageSwap;
    const transition = swap.viewTransition;
    if (!transition || !swap.activation) return;
    // A transition the browser skips rejects `ready` and
    // `updateCallbackDone`; that is not an error here, and left unhandled
    // it would surface as one.
    transition.ready.catch(() => undefined);
    transition.updateCallbackDone.catch(() => undefined);
    const undo = nameTitleFor(doc, swap.activation.entry.url, doc.baseURI);
    // A page kept for Back must not keep the borrowed name, whether the
    // transition finished or was cut short.
    transition.finished.then(undo, undo);
  });
}
