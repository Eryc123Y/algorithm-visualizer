/**
 * The authoring guide: how to write documents, written for models. It is
 * Markdown in `guide/`, one overview plus one section per structure kind,
 * so a model can read only the kinds it needs.
 */
import { readFileSync } from 'node:fs';

import {
  err,
  kindNames,
  ok,
  type Diagnostic,
  type Result,
  type StructureKindName,
} from '@algoviz/spec';

// `guide/` sits next to both `src/` and `dist/`.
const read = (path: string) =>
  readFileSync(new URL(`../guide/${path}`, import.meta.url), 'utf8').trim();

let overview: string | undefined;
const sections = new Map<StructureKindName, string>();

export const guideOverview = (): string => (overview ??= read('overview.md'));

export function guideSection(kind: StructureKindName): string {
  let text = sections.get(kind);
  if (text === undefined) {
    text = read(`kinds/${kind}.md`);
    sections.set(kind, text);
  }
  return text;
}

const isKind = (name: string): name is StructureKindName =>
  (kindNames as readonly string[]).includes(name);

/**
 * The overview followed by the sections for `kinds` (default: every kind).
 */
export function guide(
  kinds: readonly string[] = kindNames,
): Result<string, Diagnostic[]> {
  const unknown = kinds.filter((k) => !isKind(k));
  if (unknown.length > 0)
    return err([
      {
        code: 'UNKNOWN_KIND',
        path: '$.kinds',
        message: `Unknown structure kind: ${unknown.join(', ')}`,
        hint: `Kinds: ${kindNames.join(', ')}.`,
      },
    ]);
  const chosen = kindNames.filter((k) => kinds.includes(k));
  return ok(
    [guideOverview(), '# Structure kinds', ...chosen.map(guideSection)].join(
      '\n\n',
    ),
  );
}
