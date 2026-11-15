/**
 * Showing a document to the user as an interactive player, in hosts that
 * support MCP Apps: the tool checks the document and hands it to the
 * player page, which the host draws in the conversation.
 */
import { formatErrors, type Locale } from '@algomotion/spec';

import { loadDocument, resolveFrame, type FrameSelector } from './document.ts';
import { readPlayerFile } from './player-file.ts';
import { sourceOf, type SourceArgs } from './source.ts';
import { formatReport, validate } from './validate.ts';

export const PLAYER_URI = 'ui://algomotion/player.html';

/** What the player page receives as the tool's structured result. */
export interface ShowContent {
  readonly document: unknown;
  /** The frame to open on, from 0 to the number of steps. */
  readonly frame: number;
  /** The language of the player's chrome, when the caller named one (ADR 0045). */
  readonly locale?: Locale;
}

export type ShowResult =
  | { readonly ok: true; readonly text: string; readonly content: ShowContent }
  | { readonly ok: false; readonly text: string };

/** Shows a document, or a recipe run on its input (ADR 0032). */
export function showSource(
  source: SourceArgs,
  frame: FrameSelector = 0,
): ShowResult {
  const document = sourceOf(source);
  if (!document.ok) return { ok: false, text: formatErrors(document.error) };
  const shown = show(document.value, frame);
  return shown.ok && source.locale !== undefined
    ? { ...shown, content: { ...shown.content, locale: source.locale } }
    : shown;
}

/** Checks a document and opens it at `frame`, a number or a selector. */
export function show(input: unknown, frame: FrameSelector = 0): ShowResult {
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
export const playerHtml = (): string => readPlayerFile();
