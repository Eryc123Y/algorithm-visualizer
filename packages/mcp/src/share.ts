/**
 * Share links in tool results (ADR 0040): what a result links to, and the
 * text item that carries the link. The server makes links only when it
 * knows the share page's address, which no code assumes: it comes from
 * `ALGOMOTION_SHARE_URL` or the `shareUrl` option.
 */
import { writeInput } from '@algomotion/recipes';
import { checkShareBase, shareLink, type ShareContent } from '@algomotion/spec';

import { readDocument, type FrameSelector } from './document.ts';
import type { SourceArgs } from './source.ts';

export const SHARE_URL_VARIABLE = 'ALGOMOTION_SHARE_URL';

/** The share page's address from the environment; empty is none. */
export function shareBaseFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const value = env[SHARE_URL_VARIABLE]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** Checks a share page's address, or throws: links from it would break. */
export function checkShareUrl(base: string): string {
  const checked = checkShareBase(base);
  if (checked.ok) return checked.value;
  throw new Error(
    `${SHARE_URL_VARIABLE}: ${checked.error.map((e) => `${e.message}. ${e.hint ?? ''}`).join(' ')}`.trim(),
  );
}

/** The input of a recipe as a link carries it: text, or none. */
export function recipeShare(
  algorithm: string,
  input: unknown,
  frame?: FrameSelector,
): ShareContent {
  const text = writeInput(input);
  return {
    algorithm,
    ...(text === undefined ? {} : { input: text }),
    ...(frame === undefined ? {} : { frame }),
  };
}

/** What a shown source links to: its recipe and input, or its document. */
export function sourceShare(
  source: SourceArgs,
  frame?: FrameSelector,
): ShareContent | undefined {
  if (source.recipe !== undefined)
    return recipeShare(source.recipe, source.input, frame);
  const document = readDocument(source.document);
  if (!document.ok) return undefined;
  return {
    document: document.value,
    ...(frame === undefined ? {} : { frame }),
  };
}

/**
 * The text item that gives the link, or says why there is none; nothing
 * when the server has no share page.
 */
export async function shareText(
  base: string | undefined,
  content: ShareContent | undefined,
): Promise<string | undefined> {
  if (base === undefined || content === undefined) return undefined;
  const link = await shareLink(base, content);
  if (link.ok)
    return `Share link (opens it in the algomotion player in any browser): ${link.value}`;
  const [first] = link.error;
  return `No share link. ${first?.message ?? 'The link could not be made'}. Give the user the document instead, or show a recipe, whose link carries only its input.`;
}
