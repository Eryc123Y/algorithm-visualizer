/**
 * The home page's playground (roadmap 5.1): the run an address asks for,
 * where an error points in the input, the menu and its markup, runs in
 * the browser that match the build's snippets, and the page's wiring.
 *
 * Run the properties bigger with `FUZZ_RUNS=2000 npx vitest run --project
 * site playground`; replay a failure with its `FUZZ_SEED`.
 */
import { algorithms, readInput, runAlgorithm } from '@algomotion/recipes';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import { catalog } from '../../src/docs/catalog.ts';
import {
  FEATURED,
  playgroundGroups,
  playgroundMarkup,
} from '../../src/docs/playground.ts';
import { runPlayground } from '../../src/docs/playground-run.ts';
import {
  inputError,
  runFromSearch,
  searchOf,
} from '../../src/docs/playground-state.ts';
import {
  setUpPlayground,
  type PlaygroundRunner,
} from '../../src/docs/playground-ui.ts';
import { shortInput } from '../../src/docs/short-input.ts';
import { inputText, slidesCode, snippetsFor } from '../../src/docs/snippets.ts';

const settings = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED'] === undefined
    ? {}
    : { seed: Number(process.env['FUZZ_SEED']) }),
};

const DEFAULT = { algorithm: 'dijkstra', input: 'A-B 4, B-C 1' };
const examples: Record<string, string> = {
  dijkstra: 'A-B 7, A-C 9',
  'insertion-sort': '5 3 8 1',
};
const exampleOf = (id: string) => examples[id];

describe('the address of a run', () => {
  it('reads a known algorithm, with its input or its example', () => {
    expect(
      runFromSearch(
        '?algorithm=insertion-sort&input=3+1+2',
        exampleOf,
        DEFAULT,
      ),
    ).toEqual({ algorithm: 'insertion-sort', input: '3 1 2' });
    expect(
      runFromSearch('?algorithm=insertion-sort', exampleOf, DEFAULT),
    ).toEqual({ algorithm: 'insertion-sort', input: '5 3 8 1' });
  });

  it('falls back to the default for anything else', () => {
    for (const search of ['', '?input=1', '?algorithm=nope&input=1', '?x=1'])
      expect(runFromSearch(search, exampleOf, DEFAULT)).toBe(DEFAULT);
  });

  it('is empty for the default run, and leaves out an example input', () => {
    expect(searchOf(DEFAULT, 'A-B 7, A-C 9', DEFAULT)).toBe('');
    expect(
      searchOf(
        { algorithm: 'insertion-sort', input: '5 3 8 1' },
        '5 3 8 1',
        DEFAULT,
      ),
    ).toBe('?algorithm=insertion-sort');
    expect(searchOf(DEFAULT, undefined, DEFAULT, '?utm=x&input=old')).toBe(
      '?utm=x',
    );
  });

  it('reads back every run it writes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('dijkstra', 'insertion-sort'),
        fc.string(),
        (algorithm, input) => {
          const run = { algorithm, input };
          const search = searchOf(run, exampleOf(algorithm), DEFAULT);
          expect(runFromSearch(search, exampleOf, DEFAULT)).toEqual(run);
        },
      ),
      settings,
    );
  });
});

describe('where an error points', () => {
  const errorOf = (id: string, input: string) => {
    const read = readInput(input);
    if (!read.ok) return inputError(input, read.error[0]!);
    const ran = runAlgorithm(id, read.value);
    if (ran.ok) throw new Error(`${input} runs`);
    return inputError(input, ran.error[0]!);
  };

  it('marks the token a notation names by its character', () => {
    expect(errorOf('dijkstra', 'A-B 4, B-C x').at).toEqual({
      before: 'A-B 4, B-C ',
      token: 'x',
      after: '',
    });
    expect(errorOf('insertion-sort', '5 2 abc 3').at).toEqual({
      before: '5 2 ',
      token: 'abc',
      after: ' 3',
    });
  });

  it('marks a quoted name the input holds as a word', () => {
    const error = errorOf(
      'dijkstra',
      '"source": "Z", "graph": "A-B 1, ZZ-B 2"',
    );
    expect(error.message).toContain('"Z"');
    expect(error.at?.before).toBe('"source": "');
    expect(error.at?.token).toBe('Z');
  });

  it('marks a token inside a field by its name, not its character', () => {
    const error = errorOf('dijkstra', '"source": "A", "graph": "A-B 4, B-C x"');
    expect(error.at?.token).toBe('x');
    expect(error.at?.after).toBe('"');
  });

  it('marks the text an error at the end follows', () => {
    const error = errorOf('dijkstra', 'A-B 4, B-');
    expect(error.message).toContain('at the end');
    expect(error.at).toEqual({ before: 'A-B 4, ', token: 'B-', after: '' });
  });

  it('gives the message and hint alone when it names nothing', () => {
    const error = inputError('5 3', {
      code: 'X',
      path: '$.input',
      message: 'Too few "values"',
      hint: 'More.',
    });
    expect(error).toEqual({ message: 'Too few "values"', hint: 'More.' });
  });

  it('always splits the input it was given', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (input) => {
        const read = readInput(input);
        const diagnostics = read.ok
          ? (() => {
              const ran = runAlgorithm('insertion-sort', read.value);
              return ran.ok ? [] : ran.error;
            })()
          : read.error;
        for (const d of diagnostics) {
          const { at } = inputError(input, d);
          if (at !== undefined) {
            expect(at.before + at.token + at.after).toBe(input);
            expect(at.token).not.toBe('');
          }
        }
      }),
      settings,
    );
  });
});

const groups = catalog(algorithms);
const inputOf = (id: string) =>
  inputText(shortInput(id, algorithms.find((a) => a.id === id)!.examples[0]));
const menu = playgroundGroups(groups, inputOf);

describe('the menu', () => {
  it('starts with a dozen featured modules from different topics', () => {
    expect(menu[0]!.label).toBe('Featured');
    expect(menu[0]!.choices.map((c) => c.id)).toEqual(FEATURED);
    expect(FEATURED).toHaveLength(12);
    const topics = new Set(
      FEATURED.map((id) => algorithms.find((a) => a.id === id)!.topic),
    );
    expect(topics.size).toBeGreaterThanOrEqual(8);
  });

  it('then offers every module once, by topic', () => {
    const rest = menu.slice(1).flatMap((g) => g.choices.map((c) => c.id));
    expect([...rest].sort()).toEqual(algorithms.map((a) => a.id).sort());
    expect(menu.slice(1).map((g) => g.label)).toEqual(
      groups.map((g) => g.title),
    );
  });

  it('writes the markup with the run selected and escaped', () => {
    const html = playgroundMarkup(
      [
        {
          label: 'A & B',
          choices: [
            { id: 'x', title: 'X <one>', input: '"a": "<b>"' },
            { id: 'dijkstra', title: 'Dijkstra', input: 'A-B 1' },
          ],
        },
        {
          label: 'C',
          choices: [{ id: 'dijkstra', title: 'Dijkstra', input: 'A-B 1' }],
        },
      ],
      { algorithm: 'dijkstra', input: 'A-B 1 <&>', title: 'D <i>' },
      '<algo-player></algo-player>',
      'play/#v=1&a=b',
    );
    document.body.innerHTML = html;
    const select = document.querySelector('select')!;
    expect(select.value).toBe('dijkstra');
    expect(document.querySelectorAll('option[selected]')).toHaveLength(1);
    expect(document.querySelector('optgroup')!.label).toBe('A & B');
    expect(select.options[0]!.textContent).toBe('X <one>');
    expect(select.options[0]!.dataset['input']).toBe('"a": "<b>"');
    expect(document.querySelector('textarea')!.value).toBe('A-B 1 <&>');
    expect(document.querySelector('.pg-caption')!.textContent).toBe(
      'D <i> on A-B 1 <&>.',
    );
    expect(document.querySelector('.pg-share')!.getAttribute('href')).toBe(
      'play/#v=1&a=b',
    );
    expect(document.querySelector('label[for="pg-input"]')?.textContent).toBe(
      'Input',
    );
  });
});

describe('a run in the browser', () => {
  it('writes the same snippets as the build', async () => {
    const result = await runPlayground(
      'dijkstra',
      'Dijkstra’s algorithm',
      'A-B 4, B-C 1, A-C 7, C-D 2',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const built = await snippetsFor(
      'dijkstra',
      'A-B 4, B-C 1, A-C 7, C-D 2',
      0,
    );
    expect(result.snippets.map((s) => s.code)).toEqual(
      built.map((s) => s.code),
    );
    expect(result.slides).toBe(
      slidesCode(
        'Dijkstra’s algorithm',
        'dijkstra',
        'A-B 4, B-C 1, A-C 7, C-D 2',
      ),
    );
    expect(result.link).toMatch(/^play\/#/);
  });

  it('runs the example of every module in the menu', async () => {
    for (const choice of menu.slice(1).flatMap((g) => g.choices)) {
      const result = await runPlayground(choice.id, choice.title, choice.input);
      expect(result.ok, choice.id).toBe(true);
    }
  });

  it('gives an error, with its token, for an input that does not run', async () => {
    const result = await runPlayground(
      'insertion-sort',
      'Insertion sort',
      '5 x',
    );
    expect(result).toMatchObject({
      ok: false,
      error: { at: { before: '5 ', token: 'x', after: '' } },
    });
    expect(
      await runPlayground('insertion-sort', 'Insertion sort', '  '),
    ).toMatchObject({
      ok: false,
      error: { message: 'The input is empty.' },
    });
  });
});

describe('the page', () => {
  const page = () => {
    document.body.innerHTML = `${playgroundMarkup(
      menu,
      {
        algorithm: 'dijkstra',
        input: 'A-B 4, B-C 1',
        title: 'Dijkstra’s algorithm',
      },
      '<algo-player algorithm="dijkstra"></algo-player>',
      'play/#old',
    )}
    <div id="panel-web"><div class="snippet"><pre><code>old</code></pre></div></div>
    <div id="panel-slides"><div class="snippet"><pre><code>old</code></pre></div></div>
    <div id="panel-link"><div class="snippet"><pre><code>old</code></pre></div></div>`;
  };
  const env = (search = '') => {
    const replaceState = vi.fn();
    const runner: PlaygroundRunner = { runPlayground };
    return {
      replaceState,
      env: {
        location: { search, hash: '', pathname: '/' },
        history: { replaceState },
        load: () => Promise.resolve(runner),
        delay: 5,
      },
    };
  };
  const player = () =>
    document.querySelector('algo-player') as HTMLElement & {
      visualization?: unknown;
    };
  const code = (id: string) =>
    document.querySelector(`#panel-${id} code`)!.textContent;

  it('follows the algorithm chosen, with its example', async () => {
    page();
    const { env: e, replaceState } = env();
    const playground = setUpPlayground(document, e)!;
    const select = document.querySelector('select')!;
    select.value = 'insertion-sort';
    select.dispatchEvent(new Event('change'));
    await playground.settled();
    const input = document.querySelector('textarea')!;
    expect(input.value).toBe(inputOf('insertion-sort'));
    const ran = runAlgorithm('insertion-sort', input.value);
    expect(ran.ok && player().visualization).toEqual(
      ran.ok && ran.value.document,
    );
    expect(code('web')).toContain('algorithm="insertion-sort"');
    expect(code('slides')).toContain('{insertion-sort}');
    expect(code('link')).toMatch(/^play\/#/);
    expect(document.querySelector('.pg-share')!.getAttribute('href')).toBe(
      code('link'),
    );
    expect(document.querySelector('.pg-caption')!.textContent).toBe(
      `Insertion sort on ${inputOf('insertion-sort')}.`,
    );
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      '',
      '/?algorithm=insertion-sort',
    );
  });

  it('runs typed input after a pause, and keeps the last good run on an error', async () => {
    page();
    const { env: e, replaceState } = env();
    const playground = setUpPlayground(document, e)!;
    const input = document.querySelector('textarea')!;
    input.value = 'A-B 2';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(code('web')).toContain('A-B 2'));
    await playground.settled();
    const good = player().visualization;
    expect(good).toBeDefined();
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      '',
      '/?algorithm=dijkstra&input=A-B+2',
    );

    input.value = 'A-B 2, B-C x';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await playground.settled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const box = document.querySelector('.pg-error')!;
    expect(box.querySelector('mark')!.textContent).toBe('x');
    expect(box.textContent).toContain('This input does not run.');
    expect(player().visualization).toBe(good);
    expect(code('web')).toContain('A-B 2');
    expect(replaceState).toHaveBeenCalledTimes(1);

    document.querySelector<HTMLButtonElement>('.pg-reset')!.click();
    await playground.settled();
    expect(input.value).toBe(inputOf('dijkstra'));
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(box.textContent).toBe('');
  });

  it('opens on the run its address asks for', async () => {
    page();
    const { env: e } = env('?algorithm=bfs&input=A-B%2C+B-C');
    const playground = setUpPlayground(document, e)!;
    await playground.settled();
    expect(document.querySelector('select')!.value).toBe('bfs');
    expect(document.querySelector('textarea')!.value).toBe('A-B, B-C');
    expect(code('web')).toContain('algorithm="bfs"');
  });

  it('does nothing on a page without a playground', () => {
    document.body.innerHTML = '<p>No playground</p>';
    expect(setUpPlayground(document, env().env)).toBeUndefined();
  });
});
