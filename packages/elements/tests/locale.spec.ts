/**
 * The player in a locale (ADR 0045): it follows the `lang` it inherits, as
 * HTML does. Its chrome is in that locale, and a run of an algorithm is
 * recorded in it; a document shows its text as written.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { Trace } from '@algomotion/core';

import '../src/define.ts';
import type { AlgoPlayer } from '../src/index.ts';

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('lang');
});

async function mount(html: string): Promise<AlgoPlayer> {
  document.body.innerHTML = html;
  const el = document.querySelector('algo-player')!;
  await settled(el);
  await el.updateComplete;
  return el;
}

const settled = (el: AlgoPlayer) =>
  new Promise<void>((resolve) => {
    el.addEventListener('algo-load', () => resolve(), { once: true });
    el.addEventListener('algo-error', () => resolve(), { once: true });
  });

const shadow = (el: AlgoPlayer) => el.shadowRoot!;
const narration = (el: AlgoPlayer) =>
  shadow(el).querySelector('.narration')!.textContent.trim();
const label = (el: AlgoPlayer, selector: string) =>
  shadow(el).querySelector(selector)!.getAttribute('aria-label');

const CJK = /[\u{4e00}-\u{9fff}]/u;
/** The first step's narration, read from the run rather than by seeking. */
const firstStep = (el: AlgoPlayer) =>
  (el as unknown as { trace: Trace }).trace.visualization.steps[0]!.meta
    ?.narration ?? '';
const DIJKSTRA = '<algo-player algorithm="dijkstra"></algo-player>';

describe('<algo-player> in a locale', () => {
  it('is English with no lang anywhere', async () => {
    const el = await mount(DIJKSTRA);
    expect(el.locale).toBe('en');
    expect(narration(el)).toBe('Initial state.');
    expect(label(el, '.controls .primary')).toBe('Play');
  });

  it('follows the lang of an ancestor, the page’s too', async () => {
    document.documentElement.lang = 'zh-Hans';
    const el = await mount(DIJKSTRA);
    expect(el.locale).toBe('zh');
    expect(narration(el)).toBe('初始状态。');
    expect(label(el, '.controls .primary')).toBe('播放');
    expect(label(el, '.controls input[type=range]')).toBe('时间轴');
    // The run itself is in Chinese.
    expect(firstStep(el)).toMatch(CJK);
  });

  it('takes its own lang over its ancestors’', async () => {
    const el = await mount(
      `<div lang="zh-CN"><algo-player lang="en" algorithm="dijkstra"></algo-player></div>`,
    );
    expect(el.locale).toBe('en');
  });

  it('runs the algorithm again when its lang changes', async () => {
    const el = await mount(DIJKSTRA);
    expect(firstStep(el)).not.toMatch(CJK);
    const reloaded = settled(el);
    el.lang = 'zh';
    await reloaded;
    await el.updateComplete;
    expect(el.locale).toBe('zh');
    expect(firstStep(el)).toMatch(CJK);
    expect(narration(el)).toBe('初始状态。');
  });

  it('follows a change of the page’s lang', async () => {
    const el = await mount(DIJKSTRA);
    const reloaded = settled(el);
    document.documentElement.lang = 'zh';
    await reloaded;
    await el.updateComplete;
    expect(el.locale).toBe('zh');
    expect(label(el, '.controls .primary')).toBe('播放');
  });

  it('follows a new ancestor when it is moved', async () => {
    document.body.innerHTML = `<div lang="en" id="a"><algo-player algorithm="dijkstra"></algo-player></div><div lang="zh" id="b"></div>`;
    const el = document.querySelector('algo-player')!;
    await settled(el);
    await el.updateComplete;
    expect(el.locale).toBe('en');
    const reloaded = settled(el);
    document.querySelector('#b')!.append(el);
    await reloaded;
    await el.updateComplete;
    expect(el.locale).toBe('zh');
    expect(firstStep(el)).toMatch(CJK);
    expect(label(el, '.controls .primary')).toBe('播放');
  });

  it('reads the lang of the host when it is inside a shadow root', async () => {
    document.body.innerHTML = '<div lang="zh-Hans" id="host"></div>';
    const root = document
      .querySelector('#host')!
      .attachShadow({ mode: 'open' });
    root.innerHTML = '<algo-player algorithm="dijkstra"></algo-player>';
    const el = root.querySelector('algo-player')!;
    await settled(el);
    await el.updateComplete;
    expect(el.locale).toBe('zh');
    expect(firstStep(el)).toMatch(CJK);
  });

  it('shows a document’s own text as written, in Chinese chrome', async () => {
    document.documentElement.lang = 'zh';
    const doc = {
      version: '1.0',
      structures: { a: { kind: 'array', initial: [2, 1] } },
      steps: [
        {
          meta: { narration: 'Swap them.' },
          actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
        },
      ],
    };
    document.body.innerHTML = '<algo-player></algo-player>';
    const el = document.querySelector('algo-player')!;
    const loaded = settled(el);
    el.visualization = doc;
    await loaded;
    await el.updateComplete;
    expect(firstStep(el)).toBe('Swap them.');
    expect(narration(el)).toBe('初始状态。');
    expect(label(el, '.controls .primary')).toBe('播放');
  });
});
