/**
 * A typed recorder for building visualization documents from running code.
 *
 * ```ts
 * const r = new Recorder({ title: 'Swap' });
 * const a = r.add('a', { kind: 'array', initial: [2, 1] });
 * r.step({ narration: 'Swap the two values.' });
 * a.swap({ i: 0, j: 1 });
 * const doc = r.build();
 * ```
 *
 * Each structure handle has one method per action of its kind, typed from
 * the protocol registry, so new kinds get handles without any code here.
 */
import {
  actionTypesOf,
  formatErrors,
  minimumVersion,
  parseVisualization,
  type KindTypeMap,
  type Source,
  type StepMeta,
  type StructureDeclInput,
  type StructureKindName,
  type VisualizationInput,
} from '@algoviz/spec';

type ActionInputOf<K extends StructureKindName> = KindTypeMap[K]['actionInput'];

/** The fields of action `T` of kind `K`, without `type`. */
export type ActionFields<
  K extends StructureKindName,
  T extends ActionInputOf<K>['type'],
> = Omit<Extract<ActionInputOf<K>, { type: T }>, 'type'>;

/**
 * Methods that record actions on one structure. Methods whose fields are
 * all optional, such as `pop`, can be called without an argument. Each
 * returns the handle, so calls can be chained.
 */
export type Handle<K extends StructureKindName> = {
  readonly [T in ActionInputOf<K>['type']]: object extends ActionFields<K, T>
    ? (fields?: ActionFields<K, T>) => Handle<K>
    : (fields: ActionFields<K, T>) => Handle<K>;
};

type Step = VisualizationInput['steps'][number];
type Action = Step['actions'][number];

export interface RecorderOptions {
  readonly title?: string;
  /** Source code whose lines steps refer to with `line`. */
  readonly source?: Source;
}

export class Recorder {
  readonly #options: RecorderOptions;
  readonly #structures: Record<string, StructureDeclInput> = {};
  readonly #steps: Step[] = [];

  constructor(options: RecorderOptions = {}) {
    this.#options = options;
  }

  /** Declares a structure and returns the handle that records its actions. */
  add<const D extends StructureDeclInput>(
    name: string,
    decl: D,
  ): Handle<D['kind']> {
    if (Object.hasOwn(this.#structures, name))
      throw new Error(`Structure "${name}" is already declared`);
    if (this.#steps.length > 0)
      throw new Error('Declare every structure before the first step');
    // defineProperty, not assignment: a name such as "__proto__" must
    // become a key, not change the object's prototype.
    Object.defineProperty(this.#structures, name, {
      value: decl,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const methods = actionTypesOf(decl.kind).map((type) => [
      type,
      (fields: object = {}) => {
        this.#push({ ...fields, target: name, type } as Action);
        return handle;
      },
    ]);
    const handle = Object.freeze(Object.fromEntries(methods)) as Handle<
      D['kind']
    >;
    return handle;
  }

  /**
   * Starts a new step; actions recorded until the next call belong to it.
   * A string is shorthand for the narration.
   */
  step(meta: StepMeta | string = {}): this {
    const m = typeof meta === 'string' ? { narration: meta } : meta;
    this.#steps.push(
      Object.keys(m).length === 0 ? { actions: [] } : { actions: [], meta: m },
    );
    return this;
  }

  /** Number of steps recorded so far. */
  get length(): number {
    return this.#steps.length;
  }

  #push(action: Action): void {
    if (this.#steps.length === 0) this.step();
    this.#steps.at(-1)!.actions.push(action);
  }

  /**
   * The document. It is checked against the protocol: an input too large
   * or too unusual to show (more steps or elements than allowed, ids too
   * long) throws a RangeError instead of giving a document that does not
   * load.
   */
  build(): VisualizationInput {
    const doc = this.#document();
    const parsed = parseVisualization(doc);
    if (!parsed.ok)
      throw new RangeError(
        `This input cannot be shown:\n${formatErrors(parsed.error, { max: 3 })}`,
      );
    return doc;
  }

  #document(): VisualizationInput {
    const { title, source } = this.#options;
    const content = {
      ...(title === undefined ? {} : { title }),
      ...(source === undefined ? {} : { source }),
      structures: { ...this.#structures },
      steps: [...this.#steps],
    };
    // The oldest version that has what this document uses (ADR 0021), so
    // older players can show it too.
    return { version: minimumVersion(content), ...content };
  }
}
