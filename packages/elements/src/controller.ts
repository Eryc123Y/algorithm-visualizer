/**
 * Playback state machine for a trace, independent of the DOM so it can be
 * tested with a fake clock.
 *
 * States: paused or playing, at a frame index in [0, length]. While playing,
 * a timer advances one frame per `interval`; at the end it stops, or wraps
 * to frame 0 when `loop` is set.
 */

export interface PlaybackState {
  readonly index: number;
  readonly length: number;
  readonly playing: boolean;
}

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
};

export interface ControllerOptions {
  /** Milliseconds per frame while playing. */
  readonly interval?: number;
  readonly loop?: boolean;
  /** Extra milliseconds to hold the last frame before looping. */
  readonly endHold?: number;
  readonly scheduler?: Scheduler;
  /** Called after every change, with the new state. */
  readonly onChange?: (state: PlaybackState) => void;
}

export class PlayerController {
  #index = 0;
  #length = 0;
  #playing = false;
  #interval: number;
  #loop: boolean;
  #endHold: number;
  #timer: unknown = undefined;
  readonly #scheduler: Scheduler;
  readonly #onChange: (state: PlaybackState) => void;

  constructor(options: ControllerOptions = {}) {
    this.#interval = options.interval ?? 900;
    this.#loop = options.loop ?? false;
    this.#endHold = Math.max(0, options.endHold ?? 0);
    this.#scheduler = options.scheduler ?? defaultScheduler;
    this.#onChange = options.onChange ?? (() => {});
  }

  get state(): PlaybackState {
    return { index: this.#index, length: this.#length, playing: this.#playing };
  }

  /** Replaces the timeline (e.g. a new trace was loaded) and rewinds. */
  reset(length: number): void {
    this.#stopTimer();
    this.#length = Math.max(0, Math.floor(length));
    this.#index = 0;
    this.#playing = false;
    this.#emit();
  }

  set interval(ms: number) {
    this.#interval = Math.max(16, ms);
  }

  set loop(value: boolean) {
    this.#loop = value;
  }

  set endHold(ms: number) {
    this.#endHold = Math.max(0, ms);
  }

  /** Moves to a frame, clamped to the timeline. Does not change play state. */
  seek(index: number): void {
    const next = Math.min(this.#length, Math.max(0, Math.round(index)));
    if (next === this.#index) return;
    this.#index = next;
    if (this.#playing) this.#schedule();
    this.#emit();
  }

  next(): void {
    this.seek(this.#index + 1);
  }

  prev(): void {
    this.seek(this.#index - 1);
  }

  play(): void {
    if (this.#playing || this.#length === 0) return;
    // Playing from the end starts over.
    if (this.#index === this.#length) this.#index = 0;
    this.#playing = true;
    this.#schedule();
    this.#emit();
  }

  pause(): void {
    if (!this.#playing) return;
    this.#playing = false;
    this.#stopTimer();
    this.#emit();
  }

  toggle(): void {
    if (this.#playing) this.pause();
    else this.play();
  }

  dispose(): void {
    this.#stopTimer();
    this.#playing = false;
  }

  #tick = (): void => {
    this.#timer = undefined;
    if (this.#index < this.#length) {
      this.#index += 1;
    } else if (this.#loop) {
      this.#index = 0;
    }
    const atEnd = this.#index === this.#length;
    if (atEnd && !this.#loop) this.#playing = false;
    else this.#schedule(atEnd ? this.#endHold : 0);
    this.#emit();
  };

  #schedule(extra = 0): void {
    this.#stopTimer();
    this.#timer = this.#scheduler.setTimeout(
      this.#tick,
      this.#interval + extra,
    );
  }

  #stopTimer(): void {
    if (this.#timer !== undefined) this.#scheduler.clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #emit(): void {
    this.#onChange(this.state);
  }
}
