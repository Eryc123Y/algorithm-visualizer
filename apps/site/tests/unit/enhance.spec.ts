/**
 * What the documentation pages add in the browser: a copy button on each
 * snippet, and a filter over the catalogue. The pages work without them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addCopyButtons, filterCatalog } from '../../src/docs/enhance.ts';

describe('copy buttons', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="snippet" data-snippet="cli"><h3>On the command line</h3><pre><code>algoviz export x</code></pre></section>
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
      'algoviz export x',
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
