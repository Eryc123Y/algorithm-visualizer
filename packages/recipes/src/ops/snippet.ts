/**
 * Python code for operations, with `# @name` markers on the lines that
 * steps refer to. Markers are stripped from the shown code, so line numbers
 * are never written by hand (the mechanism ADR 0017 proposes for other
 * languages).
 */
import type { Source } from '@algoviz/spec';

import { python } from '../source.ts';

export interface Snippet {
  /** The code without markers. */
  readonly code: string;
  /** The 1-based line of a marker; throws for an unknown one. */
  line(anchor: string): number;
}

const MARKER = /\s*#\s*@([a-z][a-z-]*)\s*$/;

/** Dedents `code` like `python()` and reads its markers. */
export function snippet(code: string): Snippet {
  const anchors = new Map<string, number>();
  const lines = python(code)
    .code.split('\n')
    .map((text, k) => {
      const match = MARKER.exec(text);
      if (match === null) return text;
      const name = match[1]!;
      if (anchors.has(name)) throw new Error(`Marker @${name} is used twice`);
      anchors.set(name, k + 1);
      return text.slice(0, match.index);
    });
  return {
    code: lines.join('\n'),
    line(anchor) {
      const line = anchors.get(anchor);
      if (line === undefined) throw new Error(`No marker @${anchor}`);
      return line;
    },
  };
}

export interface JoinedSnippets {
  readonly source: Source;
  /** A line of the joined code: a marker, or the snippet's first line. */
  line(s: Snippet, anchor?: string): number;
}

/** Joins distinct snippets, in order of first use, with a blank line. */
export function joinSnippets(snippets: readonly Snippet[]): JoinedSnippets {
  const offsets = new Map<Snippet, number>();
  const parts: string[] = [];
  let lines = 0;
  for (const s of snippets) {
    if (offsets.has(s)) continue;
    if (parts.length > 0) lines += 1;
    offsets.set(s, lines);
    parts.push(s.code);
    lines += s.code.split('\n').length;
  }
  return {
    source: { language: 'python', code: parts.join('\n\n') },
    line(s, anchor) {
      const offset = offsets.get(s);
      if (offset === undefined) throw new Error('Snippet is not joined');
      return offset + (anchor === undefined ? 1 : s.line(anchor));
    },
  };
}
