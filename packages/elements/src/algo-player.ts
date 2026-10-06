/**
 * <algo-player>: an interactive, embeddable player for algoviz documents
 * (ADR 0006, 0010).
 *
 * Content, in order of precedence:
 * - the `visualization` property (a document object),
 * - the `src` attribute (URL of a JSON document),
 * - an inline `<script type="application/json">` child.
 *
 * Events: `algo-load` ({ length }), `algo-error` ({ errors }) and
 * `algo-frame` ({ index, length, playing }).
 */
import { html, LitElement, nothing, type PropertyValues } from 'lit';

import {
  layoutTrace,
  loadTrace,
  type Trace,
  type TraceLayout,
} from '@algoviz/core';
import { formatErrors, type Diagnostic } from '@algoviz/spec';
import { paintScene, type SvgTheme, type ThemeName } from '@algoviz/svg';

import { PlayerController, type PlaybackState } from './controller.ts';
import {
  nextIcon,
  pauseIcon,
  playIcon,
  prevIcon,
  restartIcon,
} from './icons.ts';
import { SceneStage } from './stage.ts';
import { playerStyles } from './styles.ts';

export type PlayerTheme = ThemeName | 'auto';

export interface AlgoFrameDetail {
  readonly index: number;
  readonly length: number;
  readonly playing: boolean;
}

const MAX_ANIMATION_MS = 450;

const mediaQuery = (query: string): MediaQueryList | undefined =>
  typeof matchMedia === 'function' ? matchMedia(query) : undefined;

export class AlgoPlayer extends LitElement {
  static override styles = playerStyles;

  static override properties = {
    src: { type: String },
    visualization: { attribute: false },
    frame: { type: Number, reflect: true },
    theme: { type: String },
    customTheme: { attribute: false },
    speed: { type: Number },
    autoplay: { type: Boolean },
    loop: { type: Boolean },
    hideControls: { type: Boolean, attribute: 'hide-controls' },
    hideCode: { type: Boolean, attribute: 'hide-code' },
    playback: { state: true },
    errors: { state: true },
    trace: { state: true },
    darkScheme: { state: true },
  };

  /** URL of a JSON document. */
  declare src: string | undefined;
  /** A document object; takes precedence over `src` and inline JSON. */
  declare visualization: unknown;
  /** Current frame: 0 is the initial state, `length` the last. */
  declare frame: number;
  /** `light`, `dark`, `print`, or `auto` to follow the system. */
  declare theme: PlayerTheme;
  /** A full SVG theme (e.g. from `createTheme`); overrides `theme` for the scene. */
  declare customTheme: SvgTheme | undefined;
  /** Milliseconds per step while playing. */
  declare speed: number;
  declare autoplay: boolean;
  declare loop: boolean;
  declare hideControls: boolean;
  declare hideCode: boolean;

  declare protected playback: PlaybackState;
  declare protected errors: readonly Diagnostic[] | null;
  declare protected trace: Trace | null;
  declare protected darkScheme: boolean;

  #layout: TraceLayout | null = null;
  #stage: SceneStage | null = null;
  #inline: unknown = undefined;
  #inlineText: string | null = null;
  #request = 0;
  #rendered = false;
  #requestedFrame = 0;
  readonly #controller: PlayerController;
  readonly #colorScheme = mediaQuery('(prefers-color-scheme: dark)');
  readonly #reducedMotion = mediaQuery('(prefers-reduced-motion: reduce)');

  constructor() {
    super();
    this.src = undefined;
    this.visualization = undefined;
    this.frame = 0;
    this.theme = 'auto';
    this.customTheme = undefined;
    this.speed = 900;
    this.autoplay = false;
    this.loop = false;
    this.hideControls = false;
    this.hideCode = false;
    this.errors = null;
    this.trace = null;
    this.darkScheme = this.#colorScheme?.matches ?? false;
    this.#controller = new PlayerController({
      interval: this.speed,
      onChange: (state) => this.#onPlayback(state),
    });
    this.playback = this.#controller.state;
  }

  // --- Public API ----------------------------------------------------------

  play(): void {
    this.#controller.play();
  }

  pause(): void {
    this.#controller.pause();
  }

  next(): void {
    this.#controller.next();
  }

  prev(): void {
    this.#controller.prev();
  }

  seek(index: number): void {
    this.#controller.seek(index);
  }

  /** Number of steps in the loaded trace (frames are 0 to `length`). */
  get length(): number {
    return this.trace?.length ?? 0;
  }

  // --- Lifecycle -------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.addEventListener('keydown', this.#onKeyDown);
    this.#colorScheme?.addEventListener('change', this.#onColorScheme);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onKeyDown);
    this.#colorScheme?.removeEventListener('change', this.#onColorScheme);
    this.#controller.dispose();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('speed')) this.#controller.interval = this.speed;
    if (changed.has('loop')) this.#controller.loop = this.loop;
    if (changed.has('frame') && this.frame !== this.playback.index) {
      // Before a trace is loaded, remember the frame to show once it is.
      if (this.trace === null) this.#requestedFrame = this.frame;
      else this.#controller.seek(this.frame);
    }
    if (changed.has('visualization') || changed.has('src')) void this.#load();
    const resolved = this.#resolvedTheme();
    if (this.dataset['resolvedTheme'] !== resolved)
      this.dataset['resolvedTheme'] = resolved;
  }

  protected override firstUpdated(): void {
    const svg = this.renderRoot.querySelector('svg.scene');
    if (svg instanceof SVGSVGElement) this.#stage = new SceneStage(svg);
    // Children parsed before the element upgraded produce no slotchange.
    this.#readInline();
  }

  protected override updated(): void {
    this.#drawScene();
    this.#scrollCodeLine();
  }

  // --- Loading ---------------------------------------------------------------

  async #load(): Promise<void> {
    const request = ++this.#request;
    let input: unknown;
    if (this.visualization !== undefined) {
      input = this.visualization;
    } else if (this.src) {
      try {
        const response = await fetch(this.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        input = await response.json();
      } catch (error) {
        if (request === this.#request) this.#fail([loadError(this.src, error)]);
        return;
      }
    } else {
      input = this.#inline;
    }
    if (request !== this.#request || input === undefined) return;

    const result = loadTrace(input);
    if (!result.ok) {
      this.#fail(result.error);
      return;
    }
    this.errors = null;
    this.trace = result.value;
    this.#layout = layoutTrace(result.value);
    this.#rendered = false;
    this.#controller.reset(result.value.length);
    if (this.#requestedFrame > 0) this.#controller.seek(this.#requestedFrame);
    this.#requestedFrame = 0;
    this.dispatchEvent(
      new CustomEvent('algo-load', { detail: { length: result.value.length } }),
    );
    if (this.autoplay) this.#controller.play();
  }

  #fail(errors: readonly Diagnostic[]): void {
    this.trace = null;
    this.#layout = null;
    this.errors = errors;
    this.#controller.reset(0);
    this.dispatchEvent(new CustomEvent('algo-error', { detail: { errors } }));
  }

  #onSlotChange = (): void => {
    this.#readInline();
  };

  /** Reads the first `<script type="application/json">` child, if any. */
  #readInline(): void {
    const script = [...this.children].find(
      (el): el is HTMLScriptElement =>
        el instanceof HTMLScriptElement && el.type === 'application/json',
    );
    if (script === undefined || script.textContent === this.#inlineText) return;
    this.#inlineText = script.textContent;
    try {
      this.#inline = JSON.parse(script.textContent ?? '');
    } catch (error) {
      this.#fail([
        {
          code: 'INVALID_JSON',
          path: '$',
          message: error instanceof Error ? error.message : String(error),
          hint: 'The inline <script type="application/json"> must contain valid JSON.',
        },
      ]);
      return;
    }
    if (this.visualization === undefined && !this.src) void this.#load();
  }

  // --- Playback --------------------------------------------------------------

  #onPlayback(state: PlaybackState): void {
    const previous = this.playback;
    this.playback = state;
    this.frame = state.index;
    if (state.index !== previous.index || state.playing !== previous.playing) {
      const detail: AlgoFrameDetail = { ...state };
      this.dispatchEvent(new CustomEvent('algo-frame', { detail }));
    }
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    // Let the timeline slider handle its own keys.
    if (event.composedPath()[0] instanceof HTMLInputElement) return;
    const actions: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.prev(),
      ' ': () => this.#controller.toggle(),
      k: () => this.#controller.toggle(),
      Home: () => this.seek(0),
      End: () => this.seek(this.length),
    };
    const action = actions[event.key];
    if (action === undefined) return;
    event.preventDefault();
    action();
  };

  #onColorScheme = (event: MediaQueryListEvent): void => {
    this.darkScheme = event.matches;
  };

  #resolvedTheme(): ThemeName {
    if (this.theme === 'auto') return this.darkScheme ? 'dark' : 'light';
    return this.theme;
  }

  // --- Rendering -------------------------------------------------------------

  #drawScene(): void {
    if (this.#stage === null || this.#layout === null) return;
    const scene = this.#layout.sceneAt(this.playback.index);
    const painted = paintScene(
      scene,
      this.customTheme ?? this.#resolvedTheme(),
    );
    const animate = this.#rendered && !(this.#reducedMotion?.matches ?? false);
    this.#stage.render(painted, {
      duration: animate ? Math.min(MAX_ANIMATION_MS, this.speed * 0.55) : 0,
    });
    this.#rendered = true;
  }

  #scrollCodeLine(): void {
    const code = this.renderRoot.querySelector<HTMLElement>('.code');
    const line = code?.querySelector<HTMLElement>('.line.current');
    if (!code || !line) return;
    const top = line.offsetTop - code.clientHeight / 2 + line.clientHeight / 2;
    code.scrollTop = Math.max(0, top);
  }

  protected override render() {
    const trace = this.trace;
    const { index, length, playing } = this.playback;
    const step = trace?.frame(index).step;
    const source = trace?.visualization.source;
    const showCode = source !== undefined && !this.hideCode;
    const vars = Object.entries(step?.meta?.vars ?? {});

    return html`
      <div class="player" part="container">
        ${
          this.errors
            ? html`<div class="errors" role="alert" part="errors">
                <strong>This visualization could not be loaded.</strong>
                <pre>${formatErrors(this.errors)}</pre>
              </div>`
            : nothing
        }
        <div
          class="body ${showCode ? 'with-code' : ''}"
          ?hidden=${trace === null}
        >
          <div class="stage" part="stage"><svg class="scene"></svg></div>
          ${
            showCode
              ? html`<pre class="code" part="code" aria-label="Source code">
${source.code
                    .split('\n')
                    .map(
                      (text, k) =>
                        html`<span
                          class="line ${step?.meta?.line === k + 1 ? 'current' : ''}"
                          >${text}</span
                        >`,
                    )}</pre>`
              : nothing
          }
        </div>
        <div class="caption" part="caption" ?hidden=${trace === null}>
          <p class="narration" aria-live="polite">
            ${step?.meta?.narration ?? (index === 0 ? 'Initial state.' : '')}
          </p>
          ${
            vars.length > 0
              ? html`<ul class="vars" aria-label="Variables">
                  ${vars.map(([name, value]) => html`<li>${name} = ${JSON.stringify(value)}</li>`)}
                </ul>`
              : nothing
          }
        </div>
        <div
          class="controls"
          part="controls"
          ?hidden=${this.hideControls || trace === null}
        >
          <button
            type="button"
            aria-label="Previous step"
            ?disabled=${index === 0}
            @click=${() => this.prev()}
          >
            ${prevIcon}
          </button>
          <button
            type="button"
            class="primary"
            aria-label=${playing ? 'Pause' : index === length ? 'Replay' : 'Play'}
            ?disabled=${length === 0}
            @click=${() => this.#controller.toggle()}
          >
            ${playing ? pauseIcon : index === length ? restartIcon : playIcon}
          </button>
          <button
            type="button"
            aria-label="Next step"
            ?disabled=${index === length}
            @click=${() => this.next()}
          >
            ${nextIcon}
          </button>
          <input
            type="range"
            min="0"
            max=${length}
            .value=${String(index)}
            aria-label="Timeline"
            @input=${(event: Event) => this.seek(Number((event.target as HTMLInputElement).value))}
          />
          <span class="counter" aria-live="off">${index} / ${length}</span>
        </div>
      </div>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `;
  }
}

function loadError(src: string, error: unknown): Diagnostic {
  return {
    code: 'LOAD_FAILED',
    path: '$',
    message: `Could not load ${src}: ${error instanceof Error ? error.message : String(error)}`,
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'algo-player': AlgoPlayer;
  }
  interface HTMLElementEventMap {
    'algo-frame': CustomEvent<AlgoFrameDetail>;
    'algo-load': CustomEvent<{ length: number }>;
    'algo-error': CustomEvent<{ errors: readonly Diagnostic[] }>;
  }
}
