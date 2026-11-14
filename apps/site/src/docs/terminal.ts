/**
 * A terminal session as an SVG image, for the site's real scenes
 * (roadmap 5.3). The scene script runs the commands and passes their real
 * output here; this only lays it out: a plain panel, a `$` before each
 * command, and lines wrapped at a terminal's width, as a terminal wraps
 * them. It draws no product's window chrome.
 */

/** One line the session shows: a command typed, or what it printed. */
export interface TerminalLine {
  readonly kind: 'command' | 'output' | 'error';
  readonly text: string;
}

export interface TerminalColours {
  readonly background: string;
  readonly border: string;
  readonly text: string;
  readonly prompt: string;
  readonly error: string;
}

export const TERMINAL_THEMES: Readonly<
  Record<'light' | 'dark', TerminalColours>
> = {
  light: {
    background: '#ffffff',
    border: '#dcdcda',
    text: '#161616',
    prompt: '#8a5500',
    error: '#a3261b',
  },
  dark: {
    background: '#141416',
    border: '#26262a',
    text: '#ececee',
    prompt: '#f0b44c',
    error: '#ff9c8f',
  },
};

/** The size of the type and the grid it sits on, in SVG units. */
const FONT = 13;
const ADVANCE = 7.8;
const LEADING = 20;
const PAD = 18;

const escape = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

/** Splits `text` into rows of at most `columns` characters. */
export function wrap(text: string, columns: number): string[] {
  const chars = [...text];
  if (chars.length === 0) return [''];
  const rows: string[] = [];
  for (let k = 0; k < chars.length; k += columns)
    rows.push(chars.slice(k, k + columns).join(''));
  return rows;
}

export interface TerminalSvg {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

/** The session as a standalone SVG. */
export function terminalSvg(
  lines: readonly TerminalLine[],
  colours: TerminalColours,
  title: string,
  columns = 78,
): TerminalSvg {
  const rows = lines.flatMap((line) => {
    const prefix = line.kind === 'command' ? '$ ' : '';
    return wrap(prefix + line.text, columns).map((row, k) => ({
      kind: line.kind,
      row,
      first: k === 0,
    }));
  });
  const width = Math.ceil(PAD * 2 + columns * ADVANCE);
  const height = PAD * 2 + rows.length * LEADING - (LEADING - FONT);
  const text = rows
    .map(({ kind, row, first }, k) => {
      const y = PAD + FONT + k * LEADING - 3;
      const fill = kind === 'error' ? colours.error : colours.text;
      if (kind === 'command' && first)
        return `<text x="${PAD}" y="${y}" fill="${fill}"><tspan fill="${colours.prompt}">$</tspan>${escape(row.slice(1))}</text>`;
      return `<text x="${PAD}" y="${y}" fill="${fill}">${escape(row)}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6" fill="${colours.background}" stroke="${colours.border}"/><g font-family="'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="${FONT}" xml:space="preserve" style="white-space:pre">${text}</g></svg>`;
  return { svg, width, height };
}
