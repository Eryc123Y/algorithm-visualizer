/**
 * The home page's story: the run's steps scroll by in a list while a pinned
 * sheet beside them draws the step being read, with a ruler and a status
 * under it. The step nearest the middle of the window is the current one.
 * Without script every step shows its own figure in the list instead
 * (docs.css hides those once the story is live). Text only, never markup.
 */

/** Marks steps before `frame` (1-based) done and step `frame` now. */
export function renderRuler(ruler: HTMLElement, frame: number): void {
  [...ruler.children].forEach((cell, k) => {
    cell.classList.toggle('done', k + 1 < frame);
    cell.classList.toggle('now', k + 1 === frame);
  });
}

/** The status line: `template` with {n} and {length} filled in. */
export function statusOf(template: string, n: number, length: number): string {
  return template.replace('{n}', String(n)).replace('{length}', String(length));
}

/**
 * The index of the step whose middle is nearest the window's middle, given
 * each step's top (in page coordinates), a common height and the middle.
 */
export function nearestStep(
  tops: readonly number[],
  height: number,
  middle: number,
): number {
  let best = 0;
  let distance = Infinity;
  tops.forEach((top, k) => {
    const d = Math.abs(top + height / 2 - middle);
    if (d < distance) {
      distance = d;
      best = k;
    }
  });
  return best;
}

/** Sets up the story, if the page has one. */
export function setUpStory(doc: Document, view: Window): void {
  const story = doc.querySelector<HTMLElement>('.story');
  if (!story) return;
  const steps = [...story.querySelectorAll<HTMLElement>('.story-step')];
  const frames = [...story.querySelectorAll<HTMLElement>('.story-frame')];
  const ruler = story.querySelector<HTMLElement>('.ruler');
  const status = story.querySelector<HTMLElement>('.ruler-step');
  const template = story.dataset['step'] ?? '{n} / {length}';
  if (steps.length === 0 || frames.length !== steps.length) return;

  let current = 0;
  const show = (frame: number) => {
    if (frame === current) return;
    current = frame;
    for (const f of frames)
      f.classList.toggle('now', Number(f.dataset['frame']) === frame);
    steps.forEach((s, k) => s.classList.toggle('now', k + 1 === frame));
    if (ruler) renderRuler(ruler, frame);
    if (status) status.textContent = statusOf(template, frame, steps.length);
  };
  story.classList.add('live');
  show(1);

  let queued = false;
  const update = () => {
    queued = false;
    // Each step's middle; steps differ in height with their narration.
    const middles = steps.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    show(nearestStep(middles, 0, view.innerHeight / 2) + 1);
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    view.requestAnimationFrame(update);
  };
  view.addEventListener('scroll', onScroll, { passive: true });
  view.addEventListener('resize', onScroll);
}

/**
 * The hero's figure label names the playground's algorithm: "Fig. 1
 * Dijkstra's algorithm", following the menu.
 */
export function nameFigure(doc: Document): void {
  const title = doc.querySelector<HTMLElement>('.hero .fig-title');
  const select = doc.querySelector<HTMLSelectElement>('#pg-algorithm');
  if (!title || !select) return;
  const name = () => {
    title.textContent = select.options[select.selectedIndex]?.textContent ?? '';
  };
  select.addEventListener('change', name);
  name();
}
