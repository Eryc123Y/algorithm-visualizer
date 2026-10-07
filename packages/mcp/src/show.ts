/**
 * Showing a document to the user as an interactive player, in hosts that
 * support MCP Apps: the tool checks the document and hands it to the
 * player page, which the host draws in the conversation.
 */
import { readFileSync } from 'node:fs';

import { formatErrors } from '@algoviz/spec';

import { loadDocument, resolveFrame } from './document.ts';
import { formatReport, validate } from './validate.ts';

export const PLAYER_URI = 'ui://algoviz/player.html';

/** What the player page receives as the tool's structured result. */
export interface ShowContent {
  readonly document: unknown;
  /** The frame to open on, from 0 to the number of steps. */
  readonly frame: number;
}

export type ShowResult =
  | { readonly ok: true; readonly text: string; readonly content: ShowContent }
  | { readonly ok: false; readonly text: string };

export function show(input: unknown, frame = 0): ShowResult {
  const report = validate(input);
  if (!report.valid) return { ok: false, text: formatReport(report) };
  const loaded = loadDocument(input);
  if (!loaded.ok) return { ok: false, text: formatErrors(loaded.error) };
  const trace = loaded.value;
  const at = resolveFrame(trace, frame);
  if (!at.ok) return { ok: false, text: formatErrors(at.error) };
  return {
    ok: true,
    text: `Shown to the user as an interactive player, at frame ${at.value}. ${formatReport(report)}`,
    content: { document: trace.visualization, frame: at.value },
  };
}

/** The player page: one HTML file with every script inlined. */
export function playerHtml(): string {
  const file = new URL('../ui/player.html', import.meta.url);
  try {
    return readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `The player page is missing at ${file.pathname}; build it with "npm run build -w @algoviz/mcp".`,
    );
  }
}
