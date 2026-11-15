import { describe, expect, it } from 'vitest';

import {
  nameFigure,
  nearestStep,
  renderRuler,
  setUpStory,
  statusOf,
} from '../../src/docs/story.ts';

const markup = (
  count: number,
) => `<section class="story" data-step="Step {n} of {length}">
  <ol>${Array.from({ length: count }, (_, k) => `<li class="story-step" data-frame="${k + 1}"></li>`).join('')}</ol>
  <div class="story-figure">
    <div class="story-sheet">${Array.from({ length: count }, (_, k) => `<div class="story-frame${k === 0 ? ' now' : ''}" data-frame="${k + 1}"></div>`).join('')}</div>
    <div class="ruler">${'<span></span>'.repeat(count)}</div>
    <p><b class="ruler-step"></b></p>
  </div>
</section>`;

describe('renderRuler', () => {
  it('marks the steps before the current one done and the current one now', () => {
    document.body.innerHTML = `<div class="ruler">${'<span></span>'.repeat(5)}</div>`;
    const ruler = document.querySelector<HTMLElement>('.ruler')!;
    renderRuler(ruler, 3);
    const cells = [...ruler.children];
    expect(cells.map((c) => c.className)).toEqual([
      'done',
      'done',
      'now',
      '',
      '',
    ]);
  });
});

describe('statusOf', () => {
  it('fills the template', () => {
    expect(statusOf('Step {n} of {length}', 3, 14)).toBe('Step 3 of 14');
    expect(statusOf('第 {n} 步，共 {length} 步', 3, 14)).toBe(
      '第 3 步，共 14 步',
    );
  });
});

describe('nearestStep', () => {
  it('picks the step whose middle is nearest the window’s middle', () => {
    const tops = [0, 300, 600, 900];
    expect(nearestStep(tops, 200, 400)).toBe(1);
    expect(nearestStep(tops, 200, 1400)).toBe(3);
    expect(nearestStep(tops, 200, 100)).toBe(0);
  });
});

describe('setUpStory', () => {
  it('marks the story as live, so the pinned sheet shows and the inline figures hide', () => {
    document.body.innerHTML = markup(4);
    setUpStory(document, window);
    const story = document.querySelector('.story')!;
    expect(story.classList.contains('live')).toBe(true);
    expect(document.querySelector('.ruler-step')!.textContent).toBe(
      'Step 1 of 4',
    );
  });

  it('does nothing on a page without a story', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => setUpStory(document, window)).not.toThrow();
  });
});

describe('nameFigure', () => {
  it('names the hero figure after the chosen algorithm', () => {
    document.body.innerHTML = `<section class="hero"><p><span class="fig-title"></span></p></section>
      <select id="pg-algorithm"><option value="a">Dijkstra’s algorithm</option><option value="b">Insertion sort</option></select>`;
    nameFigure(document);
    const title = document.querySelector('.fig-title')!;
    expect(title.textContent).toBe('Dijkstra’s algorithm');
    const select = document.querySelector<HTMLSelectElement>('#pg-algorithm')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(title.textContent).toBe('Insertion sort');
  });
});
