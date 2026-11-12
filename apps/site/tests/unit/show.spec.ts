/**
 * The share page's wiring (ADR 0040): what it does with each fragment.
 * The player itself is left undefined here, so the tests see the
 * properties the page sets; the E2E tests run the real player.
 */
import { shareFragment } from '@algomotion/spec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { showFragment, type PlayPage } from '../../src/play/show.ts';

const doc = {
  version: '1.0',
  title: 'Two <b>pushes</b>',
  structures: { s: { kind: 'stack', initial: [] } },
  steps: [{ actions: [{ target: 's', type: 'push', element: 1 }] }],
};

let page: PlayPage;

beforeEach(() => {
  document.title = 'algomotion player';
  document.body.innerHTML = `
    <section id="intro"></section>
    <section id="problem"><ul id="errors"></ul></section>
    <div id="stage"></div>`;
  page = {
    intro: document.querySelector('#intro')!,
    problem: document.querySelector('#problem')!,
    errors: document.querySelector('#errors')!,
    stage: document.querySelector('#stage')!,
  };
});

interface Player extends HTMLElement {
  visualization?: unknown;
  algorithm?: string;
  input?: unknown;
  theme?: string;
}

const player = () => page.stage.querySelector<Player>('algo-player');

/** What the real player does once its content validated. */
const load = () => player()!.dispatchEvent(new CustomEvent('algo-load'));

async function fragmentOf(
  content: Parameters<typeof shareFragment>[0],
): Promise<string> {
  const f = await shareFragment(content);
  if (!f.ok) throw new Error('fragment');
  return `#${f.value}`;
}

describe('the share page', () => {
  it('explains itself when the link carries nothing', async () => {
    await showFragment('', page);
    expect(page.intro.hidden).toBe(false);
    expect(page.problem.hidden).toBe(true);
    expect(player()).toBeNull();
    expect(document.title).toBe('algomotion player');
  });

  it('plays a document', async () => {
    await showFragment(
      await fragmentOf({ document: doc, frame: -1, theme: 'dark' }),
      page,
    );
    const p = player()!;
    expect(p.visualization).toEqual(doc);
    expect(p.algorithm).toBeUndefined();
    expect(p.getAttribute('frame')).toBe('-1');
    expect(p.theme).toBe('dark');
    expect(page.intro.hidden).toBe(true);
    expect(page.problem.hidden).toBe(true);
    // The title waits for the player to accept the document.
    expect(document.title).toBe('algomotion player');
    load();
    expect(document.title).toBe('Two <b>pushes</b> · algomotion');
  });

  it('plays an algorithm on its input', async () => {
    await showFragment('#v=1&alg=dijkstra&in=A-B%204', page);
    const p = player()!;
    expect(p.visualization).toBeUndefined();
    expect(p.algorithm).toBe('dijkstra');
    expect(p.input).toBe('A-B 4');
    expect(p.hasAttribute('frame')).toBe(false);
    expect(p.theme).toBe('auto');
    load();
    expect(document.title).toBe('dijkstra · algomotion');
  });

  it('keeps a document’s title out of the tab until it validates, without control or direction characters', async () => {
    const titled = {
      ...doc,
      title: '\u202Egnp.exe\u202C\u0007 Sort\u200F\n',
    };
    await showFragment(await fragmentOf({ document: titled }), page);
    player()!.dispatchEvent(new CustomEvent('algo-error'));
    expect(document.title).toBe('algomotion player');
    load();
    expect(document.title).toBe('gnp.exe Sort · algomotion');
  });

  it('ignores a load from a player a later link replaced', async () => {
    await showFragment(await fragmentOf({ document: doc }), page);
    const first = player()!;
    await showFragment('#v=1&alg=bfs', page);
    first.dispatchEvent(new CustomEvent('algo-load'));
    expect(document.title).toBe('algomotion player');
  });

  it('shows an unexpected failure as an error, not a stale player', async () => {
    await showFragment('#v=1&alg=bfs', page);
    const create = vi
      .spyOn(document, 'createElement')
      .mockImplementationOnce(() => {
        throw new Error('no custom elements');
      });
    await showFragment('#v=1&alg=dfs', page);
    create.mockRestore();
    expect(player()).toBeNull();
    expect(page.problem.hidden).toBe(false);
    expect(page.errors.textContent).toContain('INTERNAL');
    expect(page.errors.textContent).toContain('no custom elements');
  });

  it('leaves the input out for the first example', async () => {
    await showFragment('#v=1&alg=bfs', page);
    expect(player()!.input).toBeUndefined();
  });

  it('starts a fresh player for each link', async () => {
    await showFragment('#v=1&alg=bfs&frame=3', page);
    const first = player();
    await showFragment('#v=1&alg=dfs&frame=3', page);
    expect(player()).not.toBe(first);
    expect(page.stage.querySelectorAll('algo-player')).toHaveLength(1);
    expect(player()!.algorithm).toBe('dfs');
  });

  it('shows the errors of a link it cannot read, as text', async () => {
    await showFragment('#v=1&alg=<img src=x onerror=alert(1)>&alg=x', page);
    expect(page.problem.hidden).toBe(false);
    expect(page.intro.hidden).toBe(true);
    expect(player()).toBeNull();
    const items = [...page.errors.querySelectorAll('li')];
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain('INVALID_LINK');
    expect(items[0]!.textContent).toContain('given twice');
    expect(page.errors.querySelector('img')).toBeNull();
    expect(document.title).toBe('algomotion player');
  });

  it('shows a version error with its hint', async () => {
    await showFragment('#v=9&alg=bfs', page);
    expect(page.errors.textContent).toMatch(/newer algomotion/);
    expect(page.errors.textContent).toMatch(/Open the link with a newer/);
  });

  it('keeps the later of two links that load at once', async () => {
    const slow = showFragment(await fragmentOf({ document: doc }), page);
    const fast = showFragment('#v=1&alg=bfs', page);
    await Promise.all([slow, fast]);
    expect(page.stage.querySelectorAll('algo-player')).toHaveLength(1);
    expect(player()!.algorithm).toBe('bfs');
  });

  it('clears an earlier player and error when the link empties', async () => {
    await showFragment('#v=1&alg=bfs', page);
    await showFragment('#', page);
    expect(player()).toBeNull();
    expect(page.intro.hidden).toBe(false);
  });
});
