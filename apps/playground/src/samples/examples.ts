/**
 * The example picker's entries: the first example of every module in the
 * registry (ADR 0019), grouped by topic.
 */
import {
  algorithms,
  runModule,
  TOPIC_TITLES,
  TOPICS,
  type Algorithm,
  type Topic,
} from '@algomotion/recipes';
import type { VisualizationInput } from '@algomotion/spec';

export interface Example {
  readonly topic: Topic;
  /** Unique in the menu. */
  readonly label: string;
  readonly build: () => VisualizationInput;
}

/** A module's entry: its title, and its run on its first example. */
function exampleOf(algorithm: Algorithm): Example {
  return {
    topic: algorithm.topic,
    label: algorithm.title,
    build() {
      const run = runModule(algorithm, algorithm.examples[0]);
      // The registry's tests run every example, so this is a bug.
      if (!run.ok) throw new Error(run.error.map((e) => e.message).join('; '));
      return run.value.document;
    },
  };
}

/** Every entry, grouped by topic in menu order, as the registry lists them. */
export const examples: readonly Example[] = algorithms.map(exampleOf);

/** The menu's groups: the topics that have entries, with their headings. */
export const exampleGroups = TOPICS.filter((topic) =>
  examples.some((e) => e.topic === topic),
).map((topic) => ({ topic, title: TOPIC_TITLES[topic] }));
