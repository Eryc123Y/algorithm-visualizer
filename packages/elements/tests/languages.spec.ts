import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../src/define.ts';
import type { AlgoPlayer } from '../src/index.ts';
import { chooseLanguage, LANGUAGE_KEY } from '../src/languages.ts';

const sources = [
  {
    language: 'pseudocode',
    code: 'SORT-TWO(a)\n    if a[0] > a[1]\n        exchange a[0] with a[1]',
    anchors: { compare: 2, swap: 3 },
  },
  {
    language: 'python',
    code: 'def sort_two(a):\n    if a[0] > a[1]:\n        # put them in order\n        a[0], a[1] = a[1], a[0]',
    anchors: { compare: 2, swap: 4 },
  },
];

const doc = {
  version: '0.3',
  sources,
  structures: { a: { kind: 'array', initial: [2, 1] } },
  steps: [
    {
      actions: [{ target: 'a', type: 'compare', i: 0, j: 1 }],
      meta: { at: 'compare', narration: 'Compare 2 and 1.' },
    },
    {
      actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
      meta: { at: 'swap', narration: 'Swap them.' },
    },
  ],
};

async function mount(setup: (el: AlgoPlayer) => void): Promise<AlgoPlayer> {
  const el = document.createElement('algo-player');
  setup(el);
  document.body.append(el);
  await el.updateComplete;
  await el.updateComplete;
  return el;
}

const root = (el: AlgoPlayer) => el.shadowRoot!;
const current = (el: AlgoPlayer) =>
  root(el).querySelector('.line.current')?.textContent?.trim();
const buttons = (el: AlgoPlayer) => [
  ...root(el).querySelectorAll<HTMLButtonElement>('.languages button'),
];
/** Storage that refuses, starting from pseudocode chosen on this page. */
function refuseStorage() {
  const refuse = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
  chooseLanguage('pseudocode');
}

const pressed = (el: AlgoPlayer) =>
  buttons(el)
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent?.trim());

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('<algo-player> code languages (ADR 0017)', () => {
  it('shows pseudocode first, with a switcher of every language', async () => {
    const el = await mount((e) => (e.visualization = doc));
    const group = root(el).querySelector('.languages')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Code language');
    expect(buttons(el).map((b) => b.textContent?.trim())).toEqual([
      'Pseudocode',
      'Python',
    ]);
    expect(pressed(el)).toEqual(['Pseudocode']);
    expect(el.currentLanguage).toBe('pseudocode');
  });

  it('keeps the frame and moves the marker when the reader switches', async () => {
    const el = await mount((e) => (e.visualization = doc));
    el.seek(2);
    await el.updateComplete;
    expect(current(el)).toBe('exchange a[0] with a[1]');
    buttons(el)[1]!.click();
    await el.updateComplete;
    expect(el.frame).toBe(2);
    expect(current(el)).toBe('a[0], a[1] = a[1], a[0]');
    expect(pressed(el)).toEqual(['Python']);
    expect(el.currentLanguage).toBe('python');
  });

  it('remembers the choice for the site, and other players follow it', async () => {
    const first = await mount((e) => (e.visualization = doc));
    const second = await mount((e) => (e.visualization = doc));
    buttons(first)[1]!.click();
    await first.updateComplete;
    await second.updateComplete;
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('python');
    expect(second.currentLanguage).toBe('python');
    const later = await mount((e) => (e.visualization = doc));
    expect(later.currentLanguage).toBe('python');
  });

  it('starts with the language attribute, unless the reader chose another', async () => {
    const el = await mount((e) => {
      e.setAttribute('language', 'python');
      e.visualization = doc;
    });
    expect(el.currentLanguage).toBe('python');
    localStorage.setItem(LANGUAGE_KEY, 'pseudocode');
    const chosen = await mount((e) => {
      e.setAttribute('language', 'python');
      e.visualization = doc;
    });
    expect(chosen.currentLanguage).toBe('pseudocode');
  });

  it('falls back to pseudocode for a language the document does not have', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'java');
    const el = await mount((e) => {
      e.setAttribute('language', 'c');
      e.visualization = doc;
    });
    expect(el.currentLanguage).toBe('pseudocode');
  });

  it('works when storage throws, keeping the choice for the page', async () => {
    refuseStorage();
    const el = await mount((e) => (e.visualization = doc));
    expect(el.currentLanguage).toBe('pseudocode');
    buttons(el)[1]!.click();
    await el.updateComplete;
    expect(el.currentLanguage).toBe('python');
  });

  it('catches up on a choice made while it was detached', async () => {
    const away = await mount((e) => (e.visualization = doc));
    away.remove();
    const other = await mount((e) => (e.visualization = doc));
    buttons(other)[1]!.click();
    document.body.append(away);
    await away.updateComplete;
    expect(away.currentLanguage).toBe('python');
  });

  it('follows a choice made in another tab', async () => {
    const el = await mount((e) => (e.visualization = doc));
    localStorage.setItem(LANGUAGE_KEY, 'python');
    window.dispatchEvent(
      new StorageEvent('storage', { key: LANGUAGE_KEY, newValue: 'python' }),
    );
    await el.updateComplete;
    expect(el.currentLanguage).toBe('python');
  });

  it('keeps the choice for later players on the page when storage throws', async () => {
    refuseStorage();
    const first = await mount((e) => (e.visualization = doc));
    buttons(first)[1]!.click();
    const later = await mount((e) => (e.visualization = doc));
    expect(later.currentLanguage).toBe('python');
  });

  it('reads the language attribute in any case and by its short name', async () => {
    for (const language of ['Python', 'py', ' PYTHON ']) {
      const el = await mount((e) => {
        e.setAttribute('language', language);
        e.visualization = doc;
      });
      expect(el.currentLanguage, language).toBe('python');
    }
  });

  it('shows no switcher for a single language', async () => {
    const el = await mount(
      (e) => (e.visualization = { ...doc, sources: sources.slice(1) }),
    );
    expect(root(el).querySelector('.languages')).toBeNull();
    expect(el.currentLanguage).toBe('python');
  });

  it('sets procedure names in small capitals, keeping their text', async () => {
    const el = await mount((e) => (e.visualization = doc));
    const name = root(el).querySelector('.tok-procedure')!;
    expect(name.textContent).toBe('SORT-TWO');
    expect(
      [...name.querySelectorAll('.small-caps')].map((s) => s.textContent),
    ).toEqual(['ORT', 'WO']);
  });
});
