/**
 * What must hold for a structure's state after any sequence of valid
 * actions: data is well formed, and every mark refers to something that
 * exists. Returns a list of problems, empty if none.
 */
import type { KindedState, TreeState } from '../../src/index.ts';

const unique = (xs: readonly string[], what: string): string[] => {
  const seen = new Set<string>();
  const dup = xs.filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
  return dup.length === 0 ? [] : [`duplicate ${what}: ${dup.join(', ')}`];
};

const within = (values: Iterable<number>, n: number, what: string): string[] =>
  [...values]
    .filter((v) => !(Number.isInteger(v) && v >= 0 && v < n))
    .map((v) => `${what} ${v} outside [0, ${n})`);

const known = (
  values: Iterable<string>,
  ids: ReadonlySet<string>,
  what: string,
): string[] =>
  [...values]
    .filter((v) => !ids.has(v))
    .map((v) => `${what} refers to missing "${v}"`);

export function stateProblems(entry: KindedState): string[] {
  switch (entry.kind) {
    case 'array': {
      const { data, marks } = entry.state;
      const n = data.length;
      const ids = new Set(data.map((e) => e.id));
      return [
        ...unique(
          data.map((e) => e.id),
          'ids',
        ),
        ...within(marks.compare ?? [], n, 'compare'),
        ...within(marks.swapped ?? [], n, 'swapped'),
        ...within(marks.highlight, n, 'highlight'),
        // Pointers may also point one past the end.
        ...within(Object.values(marks.pointers), n + 1, 'pointer'),
        ...known(marks.settled, ids, 'settled'),
      ];
    }
    case 'stack':
    case 'queue': {
      const { data, marks } = entry.state;
      return [
        ...unique(
          data.map((e) => e.id),
          'ids',
        ),
        ...within(marks.highlight, data.length, 'highlight'),
      ];
    }
    case 'priorityQueue': {
      const { data, marks } = entry.state;
      const ids = data.items.map((item) => item.id);
      return [
        ...unique(ids, 'ids'),
        ...unique([...marks.highlight], 'highlights'),
        ...known(marks.highlight, new Set(ids), 'highlight'),
        ...(['min', 'max'].includes(data.order) ? [] : ['unknown order']),
      ];
    }
    case 'linkedList': {
      const { data, marks, doubly } = entry.state;
      const ids = new Set(data.map((e) => e.id));
      const links = data.flatMap((node) => [node.next, node.prev]);
      return [
        ...unique(
          data.map((e) => e.id),
          'ids',
        ),
        ...known(
          links.filter((l): l is string => l !== null),
          ids,
          'link',
        ),
        ...(doubly || data.every((node) => node.prev === null)
          ? []
          : ['singly linked list has prev links']),
        ...within(marks.highlight, data.length, 'highlight'),
        ...known(marks.visited, ids, 'visited'),
        ...known(marks.settled, ids, 'settled'),
        ...known(Object.values(marks.pointers), ids, 'pointer'),
      ];
    }
    case 'tree':
      return treeProblems(entry.state);
    case 'graph': {
      const { data, marks, layout } = entry.state;
      const nodes = new Set(data.nodes.map((n) => n.id));
      const edges = new Set(data.edges.map((e) => e.id));
      return [
        ...unique(
          [...data.nodes.map((n) => n.id), ...data.edges.map((e) => e.id)],
          'ids',
        ),
        ...known(
          data.edges.flatMap((e) => [e.from, e.to]),
          nodes,
          'edge end',
        ),
        ...(layout === 'manual'
          ? data.nodes
              .filter((n) => n.x === undefined || n.y === undefined)
              .map((n) => `manual node ${n.id} has no position`)
          : []),
        ...known(marks.highlightNodes, nodes, 'highlight'),
        ...known(marks.highlightEdges, edges, 'highlight'),
        ...known(marks.visited, nodes, 'visited'),
        ...known(marks.settled, nodes, 'settled'),
        ...known(Object.keys(marks.groups), nodes, 'group'),
        ...known(Object.values(marks.pointers), nodes, 'pointer'),
        ...known(Object.keys(marks.notes), nodes, 'note'),
        ...known(Object.keys(marks.edgeMarks), edges, 'edge mark'),
      ];
    }
    case 'table': {
      const { data, marks } = entry.state;
      const rows = data.length;
      const columns = data[0]?.length ?? 0;
      const cells = [
        ...marks.highlight,
        ...marks.settled,
        ...(marks.depend === null
          ? []
          : [marks.depend.cell, ...marks.depend.on]),
      ];
      return [
        ...data
          .filter((row) => row.length !== columns)
          .map(() => 'rows of different lengths'),
        ...cells
          .filter(([r, c]) => r >= rows || c >= columns)
          .map(([r, c]) => `cell [${r}, ${c}] outside ${rows}×${columns}`),
      ];
    }
    case 'hashTable': {
      const { data, marks } = entry.state;
      const all = data.flatMap((chain) => chain.map((e) => e.id));
      const ids = new Set(all);
      return [
        ...unique(all, 'ids'),
        ...(marks.bucket === null
          ? []
          : within([marks.bucket], data.length, 'bucket')),
        ...known(marks.highlight, ids, 'highlight'),
        ...known(marks.settled, ids, 'settled'),
      ];
    }
  }
}

function treeProblems(s: TreeState): string[] {
  const { nodes, roots } = s.data;
  const ids = new Set(nodes.map((n) => n.id));
  const problems = [
    ...unique(
      nodes.map((n) => n.id),
      'ids',
    ),
  ];
  const parents = new Map<string, string>();
  for (const node of nodes) {
    if (s.binary && node.children.length !== 2)
      problems.push(`binary node ${node.id} has ${node.children.length} slots`);
    if (!s.binary && node.children.includes(null))
      problems.push(`n-ary node ${node.id} has an empty slot`);
    for (const child of node.children) {
      if (child === null) continue;
      if (!ids.has(child))
        problems.push(`${node.id} has missing child ${child}`);
      else if (parents.has(child)) problems.push(`${child} has two parents`);
      else parents.set(child, node.id);
    }
  }
  problems.push(...unique([...roots], 'roots'));
  for (const root of roots) {
    if (!ids.has(root)) problems.push(`root ${root} is missing`);
    if (parents.has(root)) problems.push(`root ${root} has a parent`);
  }
  for (const node of nodes)
    if (!parents.has(node.id) && !roots.includes(node.id))
      problems.push(`${node.id} has no parent and is not a root`);
  // Every node is reached exactly once from the roots: no cycles.
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      problems.push(`${id} is reached twice`);
      continue;
    }
    seen.add(id);
    const node = nodes.find((n) => n.id === id);
    for (const c of node?.children ?? []) if (c !== null) stack.push(c);
  }
  if (seen.size !== nodes.length)
    problems.push(`${nodes.length - seen.size} nodes unreachable from roots`);
  const { marks } = s;
  problems.push(
    ...known(marks.highlight, ids, 'highlight'),
    ...known(marks.compare ?? [], ids, 'compare'),
    ...known(marks.visited, ids, 'visited'),
    ...known(marks.settled, ids, 'settled'),
    ...known(Object.keys(marks.groups), ids, 'group'),
    ...known(Object.values(marks.pointers), ids, 'pointer'),
    ...known(Object.keys(marks.notes), ids, 'note'),
  );
  return problems;
}

/** In-order values of a binary forest, root by root. */
export function forestInorder(s: TreeState): string[] {
  const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
  const walk = (id: string | null): string[] => {
    const node = id === null ? undefined : byId.get(id);
    if (node === undefined) return [];
    return [
      ...walk(node.children[0] ?? null),
      node.id,
      ...walk(node.children[1] ?? null),
    ];
  };
  return s.data.roots.flatMap(walk);
}
