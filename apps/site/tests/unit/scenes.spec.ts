/**
 * The real scenes (roadmap 5.3): the committed files match their
 * manifest, the scene sources match what the pages tell readers to write,
 * and the terminal drawing escapes and wraps what the commands printed.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseScenes,
  sceneFigure,
  type SceneManifest,
} from '../../src/docs/scenes.ts';
import {
  expandTabs,
  TERMINAL_THEMES,
  terminalSvg,
  wrap,
} from '../../src/docs/terminal.ts';
import { WALKTHROUGHS } from '../../src/docs/why.ts';

const SITE = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(SITE, path), 'utf8');
const manifest = parseScenes(read('public/scenes/scenes.json'));
const all = (m: SceneManifest) => [m.notes, ...m.beamer, m.terminal, m.chat];

describe('the committed scenes', () => {
  it('exist, in both schemes, at the sizes the manifest gives', () => {
    for (const art of all(manifest))
      for (const file of [art.light, art.dark]) {
        const path = join(SITE, 'public', file);
        expect(existsSync(path), file).toBe(true);
        if (file.endsWith('.svg')) {
          const box = /viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/.exec(
            readFileSync(path, 'utf8'),
          )!;
          const scale = file.includes('terminal') ? 1 : 4 / 3;
          expect(Math.round(Number(box[1]) * scale), file).toBe(art.width);
        }
      }
    expect(manifest.beamer).toHaveLength(3);
  });

  it('stay light: under 800 KB together', () => {
    const files = new Set(all(manifest).flatMap((a) => [a.light, a.dark]));
    const bytes = [...files].reduce(
      (n, f) => n + statSync(join(SITE, 'public', f)).size,
      0,
    );
    expect(bytes).toBeLessThan(800_000);
  });

  it('compile the very slides the Beamer walk-through shows', () => {
    const shown = WALKTHROUGHS.find((w) => w.id === 'slides')!.steps.find(
      (s) => s.label === 'slides.tex',
    )!.code!;
    expect(read('scenes/slides.tex').trimEnd()).toBe(shown);
  });

  it('compile notes that use the walk-through’s figure call', () => {
    const shown = WALKTHROUGHS.find((w) => w.id === 'notes')!.steps.find(
      (s) => s.label === 'notes.typ',
    )!.code!;
    const call = /algomotion\("dijkstra".*\)/.exec(shown)![0];
    expect(read('scenes/notes.typ')).toContain(call);
  });

  it('rejects a manifest that is missing a scene', () => {
    const broken = JSON.parse(read('public/scenes/scenes.json')) as Record<
      string,
      unknown
    >;
    delete broken['chat'];
    expect(() => parseScenes(JSON.stringify(broken))).toThrow(/chat/);
    expect(() =>
      parseScenes(
        JSON.stringify({ ...broken, chat: manifest.chat, beamer: [] }),
      ),
    ).toThrow(/beamer/);
  });
});

describe('a scene as a figure', () => {
  it('follows the colour scheme and keeps its size and alternative text', () => {
    document.body.innerHTML = sceneFigure(manifest, 'terminal', '../', 'Cap');
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(`../${manifest.terminal.light}`);
    expect(document.querySelector('source')!.getAttribute('srcset')).toBe(
      `../${manifest.terminal.dark}`,
    );
    expect(img.getAttribute('width')).toBe(String(manifest.terminal.width));
    expect(img.getAttribute('alt')).toBe(manifest.terminal.alt);
  });

  it('numbers the Beamer pages as overlays, in order', () => {
    document.body.innerHTML = sceneFigure(manifest, 'beamer', '', 'Cap');
    // The home page's loop plays the first .overlays list it finds.
    expect(document.querySelector('ol.overlays')).not.toBeNull();
    expect(
      [...document.querySelectorAll('.overlay-n')].map((n) => n.textContent),
    ).toEqual(['1', '2', '3']);
  });
});

describe('the terminal drawing', () => {
  it('shows tabs as spaces to the next stop of eight', () => {
    expect(expandTabs('ab\tc')).toBe('ab      c');
    expect(expandTabs('12345678\tx')).toBe('12345678        x');
  });

  it('wraps long lines at the terminal’s width, by characters', () => {
    expect(wrap('abcdef', 4)).toEqual(['abcd', 'ef']);
    expect(wrap('', 4)).toEqual(['']);
    expect(wrap('∞∞∞', 2)).toEqual(['∞∞', '∞']);
  });

  it('escapes what the commands printed, and marks commands and errors', () => {
    const { svg, width, height } = terminalSvg(
      [
        { kind: 'command', text: `echo '<b>&"x"'` },
        { kind: 'output', text: '<b>&"x"' },
        { kind: 'error', text: 'INVALID_NOTATION at $.input' },
      ],
      TERMINAL_THEMES.dark,
      'A <session>',
      40,
    );
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;&amp;&quot;x&quot;');
    expect(svg).toContain(
      `<tspan fill="${TERMINAL_THEMES.dark.prompt}">$</tspan>`,
    );
    expect(svg).toContain(`fill="${TERMINAL_THEMES.dark.error}"`);
    expect(svg).toContain('<title>A &lt;session&gt;</title>');
    expect(width).toBeGreaterThan(40 * 7);
    expect(height).toBeGreaterThan(3 * 13);
  });
});
