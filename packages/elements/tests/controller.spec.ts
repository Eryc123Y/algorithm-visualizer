import { describe, expect, it } from 'vitest';

import {
  PlayerController,
  type PlaybackState,
  type Scheduler,
} from '../src/controller.ts';

/** A manual clock: `advance` fires due timers in order. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const scheduler: Scheduler = {
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id as number);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers]
        .filter(([, t]) => t.at <= end)
        .sort(([, a], [, b]) => a.at - b.at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  return { scheduler, advance, pending: () => timers.size };
}

function setup(length = 3, options: { loop?: boolean } = {}) {
  const clock = fakeClock();
  const states: PlaybackState[] = [];
  const c = new PlayerController({
    interval: 100,
    scheduler: clock.scheduler,
    onChange: (s) => states.push(s),
    ...options,
  });
  c.reset(length);
  return { c, clock, states };
}

describe('PlayerController', () => {
  it('advances one frame per interval and stops at the end', () => {
    const { c, clock } = setup(3);
    c.play();
    clock.advance(250);
    expect(c.state).toEqual({ index: 2, length: 3, playing: true });
    clock.advance(1000);
    expect(c.state).toEqual({ index: 3, length: 3, playing: false });
    expect(clock.pending()).toBe(0);
  });

  it('wraps to the start when looping', () => {
    const { c, clock } = setup(2, { loop: true });
    c.play();
    clock.advance(200);
    expect(c.state).toEqual({ index: 2, length: 2, playing: true });
    clock.advance(100); // the last frame stays up for one interval
    expect(c.state).toEqual({ index: 0, length: 2, playing: true });
    clock.advance(100);
    expect(c.state.index).toBe(1);
  });

  it('holds the last frame longer before looping when endHold is set', () => {
    const clock = fakeClock();
    const c = new PlayerController({
      interval: 100,
      loop: true,
      endHold: 500,
      scheduler: clock.scheduler,
    });
    c.reset(1);
    c.play();
    clock.advance(100);
    expect(c.state.index).toBe(1);
    clock.advance(500);
    expect(c.state.index).toBe(1);
    clock.advance(100);
    expect(c.state).toEqual({ index: 0, length: 1, playing: true });
  });

  it('restarts from the beginning when played at the end', () => {
    const { c } = setup(3);
    c.seek(3);
    c.play();
    expect(c.state).toEqual({ index: 0, length: 3, playing: true });
  });

  it('clamps seeks and restarts the timer after a manual step', () => {
    const { c, clock } = setup(5);
    c.seek(99);
    expect(c.state.index).toBe(5);
    c.seek(-4);
    expect(c.state.index).toBe(0);
    c.play();
    clock.advance(90);
    c.next(); // at 1; the next tick is a full interval away again
    clock.advance(90);
    expect(c.state.index).toBe(1);
    clock.advance(20);
    expect(c.state.index).toBe(2);
  });

  it('pauses and cancels the pending tick', () => {
    const { c, clock } = setup(3);
    c.play();
    c.pause();
    clock.advance(1000);
    expect(c.state).toEqual({ index: 0, length: 3, playing: false });
  });

  it('does not play an empty timeline and rewinds on reset', () => {
    const { c, clock, states } = setup(0);
    c.play();
    expect(c.state.playing).toBe(false);
    c.reset(4);
    c.play();
    clock.advance(100);
    c.reset(2);
    expect(c.state).toEqual({ index: 0, length: 2, playing: false });
    expect(clock.pending()).toBe(0);
    expect(states.at(-1)).toEqual(c.state);
  });
});
