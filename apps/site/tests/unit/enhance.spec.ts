/**
 * What the documentation pages add in the browser: a copy button on each
 * snippet, and a filter over the catalogue. The pages work without them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCopyButtons,
  filterCatalog,
  setUpTabs,
} from '../../src/docs/enhance.ts';

describe('copy buttons', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="snippet" data-snippet="cli"><h3>On the command line</h3><pre><code>algomotion export x</code></pre></section>
      <section class="snippet" data-snippet="link"><h3>As a share link</h3><pre><code>../play/#v=1&amp;alg=x</code></pre></section>`;
  });

  it('copies a snippet’s code, and a link as a whole address', async () => {
    const copied: string[] = [];
    const clipboard = {
      writeText: vi.fn((t: string) => {
        copied.push(t);
        return Promise.resolve();
      }),
    };
    addCopyButtons(document, clipboard, 'https://example.org/dijkstra/');
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('button.copy'),
    ];
    expect(buttons.map((b) => b.textContent)).toEqual(['Copy', 'Copy']);
    expect(buttons[0]!.getAttribute('aria-label')).toBe(
      'Copy: On the command line',
    );
    buttons[0]!.click();
    buttons[1]!.click();
    await vi.waitFor(() => expect(copied).toHaveLength(2));
    expect(copied).toEqual([
      'algomotion export x',
      'https://example.org/play/#v=1&alg=x',
    ]);
    await vi.waitFor(() => expect(buttons[0]!.textContent).toBe('Copied'));
    expect(document.querySelector('[role="status"]')!.textContent).toBe(
      'Copied',
    );
  });

  it('restarts its reset when clicked again', async () => {
    vi.useFakeTimers();
    addCopyButtons(
      document,
      { writeText: () => Promise.resolve() },
      'https://example.org/',
    );
    const button = document.querySelector<HTMLButtonElement>('button.copy')!;
    button.click();
    await vi.advanceTimersByTimeAsync(1000);
    button.click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(button.textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(1000);
    expect(button.textContent).toBe('Copy');
    vi.useRealTimers();
  });

  it('says so when the clipboard refuses', async () => {
    addCopyButtons(
      document,
      { writeText: () => Promise.reject(new Error('no')) },
      'https://example.org/',
    );
    const button = document.querySelector<HTMLButtonElement>('button.copy')!;
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Select and copy'));
  });

  it('adds nothing without a clipboard', () => {
    addCopyButtons(document, undefined, 'https://example.org/');
    expect(document.querySelector('button.copy')).toBeNull();
  });
});

describe('output tabs', () => {
  let tabs: HTMLButtonElement[];
  let panels: HTMLElement[];

  beforeEach(() => {
    document.body.innerHTML = `<div role="tablist">${['web', 'typst', 'latex'].map((name, i) => `<button role="tab" id="tab-${name}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name}</button>`).join('')}</div>
      ${['web', 'typst', 'latex'].map((name, i) => `<div role="tabpanel" aria-labelledby="tab-${name}"${i === 0 ? '' : ' hidden="until-found"'}>${name}</div>`).join('')}`;
    tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    panels = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    setUpTabs(document);
  });

  const selected = (index: number) => {
    tabs.forEach((tab, i) => {
      expect(tab.getAttribute('aria-selected')).toBe(String(i === index));
      expect(tab.tabIndex).toBe(i === index ? 0 : -1);
      expect(tab.hasAttribute('focusgroupstart')).toBe(i === index);
      expect(panels[i]!.getAttribute('hidden')).toBe(
        i === index ? null : 'until-found',
      );
    });
  };
  const press = (index: number, key: string) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    tabs[index]!.dispatchEvent(event);
    return event;
  };

  it('selects the clicked tab and hides the other panels until found', () => {
    tabs[1]!.click();
    selected(1);
  });

  it('moves selection and focus with arrow keys, wrapping at both ends', () => {
    tabs[0]!.focus();
    expect(press(0, 'ArrowLeft').defaultPrevented).toBe(true);
    selected(2);
    expect(document.activeElement).toBe(tabs[2]);
    press(2, 'ArrowRight');
    selected(0);
    press(0, 'ArrowRight');
    selected(1);
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('moves to Home and End and leaves unrelated keys alone', () => {
    press(0, 'End');
    selected(2);
    expect(document.activeElement).toBe(tabs[2]);
    press(2, 'Home');
    selected(0);
    expect(document.activeElement).toBe(tabs[0]);
    expect(press(0, 'Escape').defaultPrevented).toBe(false);
    selected(0);
  });

  it('selects a panel found by the browser without moving focus', () => {
    tabs[0]!.focus();
    panels[2]!.dispatchEvent(new Event('beforematch', { bubbles: true }));
    selected(2);
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('follows focus changes supplied by the browser', () => {
    tabs[1]!.focus();
    selected(1);
  });
});

describe('the catalogue filter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="filter" />
      <p class="filter-status" role="status"></p>
      <section class="topic"><h3>Sorting</h3><ul class="entries">
        <li data-search="insertion-sort insertion sort">a</li>
        <li data-search="heapsort heapsort heap">b</li>
      </ul></section>
      <section class="topic"><h3>Graphs</h3><ul class="entries">
        <li data-search="dijkstra dijkstra’s algorithm">c</li>
      </ul></section>`;
  });

  const shown = () =>
    [...document.querySelectorAll<HTMLElement>('[data-search]')]
      .filter((li) => !li.hidden)
      .map((li) => li.textContent);

  it('shows the entries whose words match, and hides empty topics', () => {
    filterCatalog(document, 'heap');
    expect(shown()).toEqual(['b']);
    const [sorting, graphs] = document.querySelectorAll<HTMLElement>('.topic');
    expect(sorting!.hidden).toBe(false);
    expect(graphs!.hidden).toBe(true);
    filterCatalog(document, '  ');
    expect(shown()).toEqual(['a', 'b', 'c']);
  });

  it('matches every word given', () => {
    filterCatalog(document, 'SORT insertion');
    expect(shown()).toEqual(['a']);
  });

  it('says how many match, and when nothing does', () => {
    const status = () =>
      document.querySelector<HTMLElement>('.filter-status')!.textContent;
    filterCatalog(document, 'heap');
    expect(status()).toBe('1 of 3 shown.');
    filterCatalog(document, 'zzz');
    expect(status()).toBe('Nothing matches; try fewer words.');
    filterCatalog(document, '');
    expect(status()).toBe('');
  });
});
