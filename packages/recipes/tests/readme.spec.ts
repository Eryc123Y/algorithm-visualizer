/**
 * The READMEs say what the registry holds: every algorithm and structure
 * in the root README's list, and the counts both READMEs give. The list
 * is written by hand for readers, so this keeps it from drifting.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { kindNames } from '@algomotion/spec';

import { algorithms } from '../src/index.ts';

const read = (name: string) =>
  readFileSync(new URL(`../../../${name}`, import.meta.url), 'utf8');
const readme = read('README.md');
const readmeZh = read('README.zh-CN.md');

/** The root README's list of modules, by topic. */
const list = (() => {
  const start = readme.indexOf('The registry holds these modules');
  const end = readme.indexOf('\n\n', readme.indexOf('\n- **', start));
  return readme.slice(start, end);
})();

describe('the README’s list of modules', () => {
  const families = [...new Set(algorithms.map((a) => a.id.split('.')[0]!))];

  it('names every algorithm and data structure of the registry', () => {
    const listed = new Set(
      [...list.matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1]!),
    );
    expect(families.filter((id) => !listed.has(id))).toEqual([]);
    expect([...listed].filter((id) => !families.includes(id))).toEqual([]);
  });

  it('names each structure’s operations', () => {
    const structures = families.filter((id) =>
      algorithms.some((a) => a.id.startsWith(`${id}.`)),
    );
    expect(structures.length).toBeGreaterThan(10);
    for (const id of structures) {
      const own = algorithms
        .filter((a) => a.id.startsWith(`${id}.`))
        .map((a) => a.id.slice(id.length + 1))
        .sort();
      // `stack` (push, pop), or a line of several that share their
      // operations: "…, each with insert and search".
      const ownList = new RegExp(`\`${id}\` \\(([a-z, -]+)\\)`).exec(list);
      const line = list.split('\n').find((l) => l.includes(`\`${id}\``)) ?? '';
      const shared =
        /each with ([a-z -]+(?:, [a-z -]+)*) and ([a-z -]+)\./.exec(line);
      const listed =
        ownList !== null
          ? ownList[1]!.split(', ')
          : shared !== null
            ? [...shared[1]!.split(', '), shared[2]!]
            : [];
      expect(listed.sort(), id).toEqual(own);
    }
  });
});

describe('the counts the READMEs give', () => {
  const modules = String(algorithms.length);

  it('match the registry', () => {
    expect(readme).toContain(`${modules} algorithms</a>`);
    expect(readme).toContain(
      `${modules} algorithms and data structure operations`,
    );
    expect(readme).toContain(`every module: ${modules} of them`);
    expect(readmeZh).toContain(`${modules} 个算法</a>`);
    expect(readmeZh).toContain(`${modules} 个算法及数据结构操作`);
  });

  it('match the structure kinds', () => {
    expect(kindNames).toHaveLength(11);
    expect(readme).toContain('eleven structure kinds');
    expect(readmeZh).toContain('十一种数据结构');
  });
});
