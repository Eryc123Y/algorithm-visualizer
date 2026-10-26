/**
 * The guide is what models learn the protocol from, so it must not drift
 * from it: every example must validate, and every action must be listed.
 */
import { kinds, kindNames } from '@algoviz/spec';
import { describe, expect, it } from 'vitest';

import { guide, guideOverview, guideSection } from '../src/guide.ts';
import { validate } from '../src/validate.ts';

/** The JSON code blocks of a Markdown text. */
const jsonBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe('guide', () => {
  it('includes the overview and every kind by default', () => {
    const text = guide();
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    for (const kind of kindNames) expect(text.value).toContain(`## ${kind}\n`);
  });

  it('includes only the kinds asked for', () => {
    const text = guide(['stack']);
    expect(text.ok && text.value).toContain('## stack');
    expect(text.ok && text.value).not.toContain('## graph');
  });

  it('rejects unknown kinds and lists the real ones', () => {
    const text = guide(['heap']);
    expect(text.ok).toBe(false);
    if (text.ok) return;
    expect(text.error[0]!.code).toBe('UNKNOWN_KIND');
    expect(text.error[0]!.hint).toContain('hashTable');
  });

  it.each(kindNames)('documents every %s action in its table', (kind) => {
    const section = guideSection(kind);
    for (const type of kinds[kind].actionTypes)
      expect(section, `${kind}.${type}`).toMatch(
        new RegExp(`^\\| \`${type}\` +\\|`, 'm'),
      );
  });

  it.each(kindNames)('has a valid example for %s', (kind) => {
    const blocks = jsonBlocks(guideSection(kind));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const report = validate(JSON.parse(block));
      expect(report.valid ? [] : report.errors).toEqual([]);
      expect(report.valid && report.warnings).toEqual([]);
    }
  });

  it.each(kindNames)('uses only %s in its example', (kind) => {
    for (const block of jsonBlocks(guideSection(kind))) {
      const doc = JSON.parse(block) as {
        structures: Record<string, { kind: string }>;
      };
      for (const decl of Object.values(doc.structures))
        expect(decl.kind).toBe(kind);
    }
  });

  it('has a valid example in the overview', () => {
    const [block] = jsonBlocks(guideOverview());
    const report = validate(JSON.parse(block!));
    expect(report.valid && report.warnings).toEqual([]);
  });
});
