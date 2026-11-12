/**
 * The documentation's catalogue (roadmap 3.4), derived from the registry
 * (requirement R7): a page for every module, grouped by topic, and a data
 * structure's operations under the structure. Nothing here is written by
 * hand, so a new module appears without changes to the site.
 */
import {
  TOPIC_TITLES,
  TOPICS,
  type Algorithm,
  type Topic,
} from '@algomotion/recipes';

/** One module's page. */
export interface Entry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly topic: Topic;
  /** The page's folder, relative to the site's root, such as `bst/delete/`. */
  readonly path: string;
  /** For an operation, the structure it belongs to. */
  readonly structure?: string;
}

/** A data structure: its own page, then one per operation. */
export interface Structure {
  readonly entry: Entry;
  readonly operations: readonly Entry[];
}

export interface TopicGroup {
  readonly topic: Topic;
  readonly title: string;
  readonly algorithms: readonly Entry[];
  readonly structures: readonly Structure[];
}

/** A module's folder: `dijkstra/`, and `bst/delete/` for an operation. */
export const pathOf = (id: string): string => `${id.split('.').join('/')}/`;

/** How many folders deep a page's path is. */
export const depthOf = (path: string): number =>
  path.split('/').filter((part) => part !== '').length;

/** The pages of `modules`, by topic and then by structure. */
export function catalog(modules: readonly Algorithm[]): TopicGroup[] {
  const entryOf = (a: Algorithm): Entry => {
    const [structure, operation] = a.id.split('.');
    return {
      id: a.id,
      title: a.title,
      summary: a.summary,
      topic: a.topic,
      path: pathOf(a.id),
      ...(operation === undefined ? {} : { structure: structure! }),
    };
  };
  const entries = modules.map(entryOf);
  const operationsOf = (id: string) =>
    entries.filter((e) => e.structure === id);
  const isStructure = (e: Entry) =>
    e.structure === undefined && operationsOf(e.id).length > 0;

  return TOPICS.map((topic) => {
    const own = entries.filter(
      (e) => e.topic === topic && e.structure === undefined,
    );
    return {
      topic,
      title: TOPIC_TITLES[topic],
      algorithms: own.filter((e) => !isStructure(e)),
      structures: own
        .filter(isStructure)
        .map((entry) => ({ entry, operations: operationsOf(entry.id) })),
    };
  }).filter((g) => g.algorithms.length + g.structures.length > 0);
}
