/**
 * The project pages (roadmap 5.5): the changelog, the roadmap and the
 * contributing page, built from the repository's own files, and the
 * version and commit in every page's footer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { page, REPOSITORY } from '../../src/docs/html.ts';
import {
  changelogPage,
  contributingPage,
  ISSUE_FORMS,
  roadmapPage,
  roadmapSummary,
} from '../../src/docs/project.ts';
import { parse } from '../../src/docs/markdown.ts';

const file = (path: string) =>
  readFileSync(join(import.meta.dirname, '../../../..', path), 'utf8');
const ROADMAP = file('docs/roadmap.md');
const CHANGELOG = file('CHANGELOG.md');
const CONTRIBUTING = file('CONTRIBUTING.md');
const assets = { scripts: [], styles: [], preloads: [] };

const load = (html: string) => {
  document.documentElement.innerHTML = html;
  return document;
};

describe('the footer', () => {
  it('shows the version and links the commit the site was built from', () => {
    const doc = load(
      page({
        title: 't',
        description: 'd',
        root: '../',
        assets: {
          ...assets,
          build: {
            version: '0.1.0',
            commit: 'abcdef1234567',
            date: '2026-11-14',
          },
        },
        body: '',
      }),
    );
    const build = doc.querySelector('footer .build')!;
    expect(build.textContent).toContain('Version 0.1.0');
    expect(build.textContent).toContain('2026-11-14');
    expect(
      build.querySelector('a[href$="/commit/abcdef1234567"]')!.textContent,
    ).toBe('abcdef1');
  });

  it('links the project pages from every page, at any depth', () => {
    const doc = load(
      page({ title: 't', description: 'd', root: '../../', assets, body: '' }),
    );
    for (const path of ['changelog/', 'roadmap/', 'contributing/'])
      expect(
        doc.querySelector(`footer a[href="../../${path}"]`),
        path,
      ).not.toBeNull();
    expect(doc.querySelector('footer .build')).toBeNull();
  });
});

describe('the roadmap', () => {
  const summary = roadmapSummary(parse(ROADMAP));

  it('counts every top-level item of the file', () => {
    const marks = ROADMAP.match(/^- \[[ x~]\]/gm)!;
    expect(summary.total).toBe(marks.length);
    expect(summary.done).toBe(marks.filter((m) => m.includes('x')).length);
    expect(summary.phases.map((p) => p.title)).toEqual(
      ROADMAP.match(/^## Phase .*$/gm)!.map((h) => h.slice(3)),
    );
  });

  it('separates what waits for the owner from what comes next', () => {
    const open = ROADMAP.match(/^- \[ \].*$/gm)!;
    const owner = open.filter((l) => l.includes('_owner_'));
    expect(summary.owner).toHaveLength(owner.length);
    expect(summary.next).toHaveLength(open.length - owner.length);
    expect(summary.owner.some((i) => i.title.startsWith('4.3 Publish'))).toBe(
      true,
    );
    expect(summary.next.every((i) => !i.text.includes('_owner_'))).toBe(true);
  });

  it('reads the item titles from their bold lead', () => {
    const item = roadmapSummary(
      parse(
        '## Phase 9: x\n\n- [ ] **9.1 Thing.** More text (#3).\n- [x] plain item (#4)',
      ),
    );
    expect(item.next[0]!.title).toBe('9.1 Thing');
    expect(item.phases[0]!.items[1]!.title).toBe('plain item (#4)');
  });

  it('renders the page with the summary, phases and links to the repository', () => {
    const doc = load(roadmapPage(ROADMAP, assets));
    expect(doc.querySelector('h1')!.textContent).toBe('Roadmap');
    expect(doc.querySelectorAll('section.phase')).toHaveLength(
      summary.phases.length,
    );
    expect(doc.querySelectorAll('progress')).toHaveLength(
      summary.phases.length,
    );
    for (const p of doc.querySelectorAll('progress'))
      expect(p.getAttribute('aria-label')).toMatch(/done$/);
    expect(
      doc.querySelector(
        `a[href="${REPOSITORY}/blob/main/docs/adr/0021-protocol-versioning.md"]`,
      ),
    ).not.toBeNull();
    expect(
      doc.querySelector(`a[href="${REPOSITORY}/pull/141"]`),
    ).not.toBeNull();
    expect(doc.querySelector('#owner-items li')!.textContent).toContain('4.3');
    // Long details of done items fold away.
    expect(doc.querySelectorAll('.phase details').length).toBeGreaterThan(5);
  });
});

describe('the changelog', () => {
  it('says plainly what is published, and with which tag', () => {
    expect(CHANGELOG).toMatch(/^# Changelog/);
    expect(CHANGELOG).toMatch(/## \[?Unreleased\]?/);
    expect(CHANGELOG).toMatch(/## 1\.0\.0-alpha\.1/);
    expect(CHANGELOG).toMatch(/published with the `alpha` tag/);
    expect(CHANGELOG).toMatch(/Typst Universe and CTAN wait for 1\.0/);
  });

  it('cites only pull requests that the roadmap or history knows', () => {
    const cited = new Set(
      CHANGELOG.match(/#\d+/g)!.map((n) => Number(n.slice(1))),
    );
    for (const n of cited) expect(n).toBeLessThanOrEqual(200);
    expect(cited.size).toBeGreaterThan(50);
  });

  it('renders the file under the site’s own heading, with linked pull requests', () => {
    const doc = load(changelogPage(CHANGELOG, assets));
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelector('h1')!.textContent).toBe('Changelog');
    expect(doc.querySelector(`a[href="${REPOSITORY}/pull/14"]`)).not.toBeNull();
    expect(
      doc.querySelector(`a[href="${REPOSITORY}/blob/main/CHANGELOG.md"]`),
    ).not.toBeNull();
  });
});

describe('the contributing page', () => {
  it('takes the setup and the steps to add an algorithm from CONTRIBUTING.md', () => {
    const doc = load(contributingPage(CONTRIBUTING, assets));
    const body = doc.querySelector('main')!.textContent;
    expect(body).toContain('defineAlgorithm');
    expect(body).toContain('npm run check');
    expect(body).toMatch(/GNU General Public License, version 3 or later/);
  });

  it('links each issue form', () => {
    const doc = load(contributingPage(CONTRIBUTING, assets));
    for (const form of ISSUE_FORMS) {
      const yml = file(`.github/ISSUE_TEMPLATE/${form.file}`);
      expect(yml).toMatch(/^name: /m);
      expect(
        doc.querySelector(
          `a[href="${REPOSITORY}/issues/new?template=${form.file}"]`,
        ),
        form.file,
      ).not.toBeNull();
    }
  });

  it('fails the build if a section it needs is renamed', () => {
    expect(() =>
      contributingPage(
        CONTRIBUTING.replace('## Adding an algorithm', '## X'),
        assets,
      ),
    ).toThrow(/Adding an algorithm/);
  });
});
