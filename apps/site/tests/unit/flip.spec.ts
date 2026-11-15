import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flipUrl,
  framesOf,
  nameTitleFor,
  setUpFlip,
} from '../../src/docs/flip.ts';

const card = (
  frames = '1,4,7,10',
) => `<ul><li class="card"><a href="../dijkstra/">
  <span class="thumb" data-flip="thumbs/dijkstra" data-frames="${frames}"><picture><source srcset="thumbs/dijkstra-dark.svg" media="(prefers-color-scheme: dark)" /><img src="thumbs/dijkstra-light.svg" alt="" /></picture></span>
  <span class="card-title">Dijkstra’s algorithm</span></a></li></ul>`;

/** A window whose media queries answer `matches`. */
function viewWith(matches: boolean): Window {
  return Object.assign(Object.create(window) as Window, {
    matchMedia: (query: string) =>
      ({ matches, media: query }) as MediaQueryList,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  });
}

describe('framesOf', () => {
  it('reads the frames a thumbnail flips through', () => {
    document.body.innerHTML = card('1,4,7,10');
    expect(framesOf(document.querySelector('.thumb')!)).toEqual([1, 4, 7, 10]);
  });

  it('ignores what is not a frame number', () => {
    document.body.innerHTML = card('1,x,,7');
    expect(framesOf(document.querySelector('.thumb')!)).toEqual([1, 7]);
  });
});

describe('flipUrl', () => {
  it('names a frame’s drawing in a theme', () => {
    expect(flipUrl('thumbs/dijkstra', 7, 'light')).toBe(
      'thumbs/dijkstra-f7-light.svg',
    );
    expect(flipUrl('../algorithms/thumbs/bfs', 2, 'dark')).toBe(
      '../algorithms/thumbs/bfs-f2-dark.svg',
    );
  });
});

describe('setUpFlip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flips through the frames while the pointer is on the card, and goes back after', async () => {
    document.body.innerHTML = card();
    setUpFlip(document, viewWith(true), () => Promise.resolve());
    const link = document.querySelector('a')!;
    const img = document.querySelector('img')!;
    const source = document.querySelector('source')!;
    link.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(0);
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-f1-light.svg');
    expect(source.getAttribute('srcset')).toBe('thumbs/dijkstra-f1-dark.svg');
    expect(
      document.querySelector('.thumb')!.classList.contains('flipping'),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-f4-light.svg');
    // It loops: after the last frame comes the first again.
    await vi.advanceTimersByTimeAsync(700 * 3);
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-f1-light.svg');
    link.dispatchEvent(new Event('pointerleave'));
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-light.svg');
    expect(source.getAttribute('srcset')).toBe('thumbs/dijkstra-dark.svg');
    expect(
      document.querySelector('.thumb')!.classList.contains('flipping'),
    ).toBe(false);
  });

  it('marks the frame on a ruler under the thumbnail', async () => {
    document.body.innerHTML = card();
    setUpFlip(document, viewWith(true), () => Promise.resolve());
    document.querySelector('a')!.dispatchEvent(new Event('focusin'));
    await vi.advanceTimersByTimeAsync(700);
    const cells = [...document.querySelectorAll('.thumb-ruler span')];
    expect(cells.map((c) => c.className)).toEqual(['done', 'now', '', '']);
  });

  it('runs one loop for hover and focus together, and stops when both have gone', async () => {
    document.body.innerHTML = card();
    setUpFlip(document, viewWith(true), () => Promise.resolve());
    const link = document.querySelector('a')!;
    const img = document.querySelector('img')!;
    link.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(0);
    link.dispatchEvent(new Event('focusin'));
    await vi.advanceTimersByTimeAsync(0);
    // Still the first frame: focus did not start a second loop.
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-f1-light.svg');
    link.dispatchEvent(new Event('pointerleave'));
    // Focus is still on the card: it keeps flipping.
    expect(
      document.querySelector('.thumb')!.classList.contains('flipping'),
    ).toBe(true);
    link.dispatchEvent(new Event('focusout'));
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-light.svg');
    // No loop survives to draw over the still.
    await vi.advanceTimersByTimeAsync(700 * 4);
    expect(img.getAttribute('src')).toBe('thumbs/dijkstra-light.svg');
  });

  it('does not start if the pointer leaves before the frames load', async () => {
    document.body.innerHTML = card();
    let loaded: () => void = () => {};
    setUpFlip(
      document,
      viewWith(true),
      () => new Promise<void>((resolve) => (loaded = resolve)),
    );
    const link = document.querySelector('a')!;
    link.dispatchEvent(new Event('pointerenter'));
    link.dispatchEvent(new Event('pointerleave'));
    loaded();
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector('img')!.getAttribute('src')).toBe(
      'thumbs/dijkstra-light.svg',
    );
  });

  it('stays still for readers who ask for less motion, or have no hover', async () => {
    document.body.innerHTML = card();
    setUpFlip(document, viewWith(false), () => Promise.resolve());
    document.querySelector('a')!.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector('img')!.getAttribute('src')).toBe(
      'thumbs/dijkstra-light.svg',
    );
    expect(document.querySelector('.thumb-ruler')).toBeNull();
  });
});

describe('nameTitleFor', () => {
  it('lends the page title’s transition name to the card being opened', () => {
    document.body.innerHTML = `<main><h1>Algorithms</h1>${card()}</main>`;
    const restore = nameTitleFor(
      document,
      new URL('../dijkstra/', 'https://example.org/algorithms/').href,
      'https://example.org/algorithms/',
    );
    const h1 = document.querySelector('h1')!;
    const title = document.querySelector<HTMLElement>('.card-title')!;
    expect(title.style.viewTransitionName).toBe('page-title');
    expect(h1.style.viewTransitionName).toBe('none');
    restore();
    expect(title.style.viewTransitionName).toBe('');
    expect(h1.style.viewTransitionName).toBe('');
  });

  it('does nothing for a page no card links to', () => {
    document.body.innerHTML = `<main><h1>Algorithms</h1>${card()}</main>`;
    nameTitleFor(
      document,
      'https://example.org/guide/',
      'https://example.org/algorithms/',
    )();
    expect(document.querySelector('h1')!.style.viewTransitionName).toBe('');
  });
});
