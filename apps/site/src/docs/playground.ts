/**
 * The home page's playground (roadmap 5.1), as the build writes it: a
 * choice of algorithm, an input field holding the choice's first example
 * in its shortest notation, the player, and a link to the share page.
 * Without script the page shows the default run and hides the controls;
 * with it, `playground-ui.ts` makes them work.
 */
import type { TopicGroup } from './catalog.ts';
import { attribute, text } from './html.ts';
import { PREFIX, type Locale } from './locale.ts';
import { CHROME } from './text/chrome.ts';
import { HOME } from './text/home.ts';
import type { PlaygroundRun } from './playground-state.ts';

/** A module the playground offers, and the text of its first example. */
export interface PlaygroundChoice {
  readonly id: string;
  readonly title: string;
  readonly input: string;
}

/** The choices under one heading of the menu. */
export interface PlaygroundGroup {
  readonly label: string;
  readonly choices: readonly PlaygroundChoice[];
}

/**
 * The dozen the menu starts with: one or two from each topic a course
 * meets first, each drawing a different kind of structure.
 */
export const FEATURED: readonly string[] = [
  'dijkstra',
  'bfs',
  'kruskal',
  'insertion-sort',
  'quicksort',
  'binary-search',
  'stack',
  'bst',
  'min-heap',
  'linear-probing',
  'lcs',
  'kmp',
];

/**
 * The menu: the featured modules, then every module by topic, a data
 * structure followed by its operations. `inputOf` gives a module's text.
 */
export function playgroundGroups(
  groups: readonly TopicGroup[],
  inputOf: (id: string) => string,
  locale: Locale = 'en',
): PlaygroundGroup[] {
  const entries = groups.map((g) => ({
    label: CHROME[locale].topics[g.topic],
    entries: [
      ...g.algorithms,
      ...g.structures.flatMap((s) => [s.entry, ...s.operations]),
    ],
  }));
  const all = entries.flatMap((g) => g.entries);
  const choiceOf = (e: { id: string; title: string }): PlaygroundChoice => ({
    id: e.id,
    title: e.title,
    input: inputOf(e.id),
  });
  const featured = FEATURED.map((id) => {
    const entry = all.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`No module ${id} to feature`);
    return choiceOf(entry);
  });
  return [
    { label: HOME[locale].playground.featured, choices: featured },
    ...entries.map((g) => ({
      label: g.label,
      choices: g.entries.map(choiceOf),
    })),
  ];
}

/** The playground's markup around `player`, which shows `run`. */
export function playgroundMarkup(
  groups: readonly PlaygroundGroup[],
  run: PlaygroundRun & { readonly title: string },
  player: string,
  link: string,
  locale: Locale = 'en',
): string {
  const t = HOME[locale].playground;
  const [before, after] = t.caption(run.title);
  // The share link is relative to the site's root; the script needs to
  // know how far that is when it writes a new one.
  const depth = PREFIX[locale] === '' ? 0 : 1;
  let selected = false;
  const options = groups
    .map((g) => {
      const items = g.choices
        .map((c) => {
          // The first option of the run is the selected one.
          const on = !selected && c.id === run.algorithm;
          selected ||= on;
          return `<option value="${attribute(c.id)}" data-input="${attribute(c.input)}"${on ? ' selected' : ''}>${text(c.title)}</option>`;
        })
        .join('');
      return `<optgroup label="${attribute(g.label)}">${items}</optgroup>`;
    })
    .join('\n        ');
  return `<div class="playground" role="group" aria-label="${attribute(t.label)}" data-depth="${depth}">
  <div class="pg-controls">
    <div class="pg-field pg-pick">
      <label for="pg-algorithm">${text(t.algorithm)}</label>
      <select id="pg-algorithm">
        ${options}
      </select>
    </div>
    <div class="pg-field pg-text">
      <label for="pg-input">${text(t.input)}</label>
      <div class="pg-row">
        <textarea id="pg-input" rows="1" spellcheck="false" autocomplete="off" autocapitalize="off" aria-invalid="false">${text(run.input)}</textarea>
        <button type="button" class="pg-reset">${text(t.useExample)}</button>
      </div>
    </div>
  </div>
  <div id="pg-error" class="pg-error"></div>
  <p class="pg-announce visually-hidden" aria-live="polite"></p>
  <div class="pg-stage">
    ${player}
  </div>
  <p class="player-caption"><span class="pg-caption">${text(before)}<code>${text(run.input)}</code>${text(after)}</span> ${text(t.pressPlay)} <a class="pg-share" href="${attribute(link)}">${text(t.openShare)}</a></p>
</div>`;
}
