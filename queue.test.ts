import { describe, expect, it } from 'vitest';
import { QueueFullError, TrackQueue } from '../src/queue';
import { track } from './fixtures';

const titles = (q: TrackQueue) => q.upcoming.map((t) => t.title);

describe('TrackQueue', () => {
  it('plays tracks in FIFO order and ends with null', () => {
    const q = new TrackQueue();
    q.add([track(1), track(2)]);
    expect(q.advance()?.title).toBe('Track 1');
    expect(q.advance()?.title).toBe('Track 2');
    expect(q.advance()).toBeNull();
    expect(q.current).toBeNull();
  });

  it('adds only what fits and throws once full', () => {
    const q = new TrackQueue(2);
    expect(q.add([track(1), track(2), track(3)])).toBe(2);
    expect(() => q.add(track(4))).toThrow(QueueFullError);
    expect(q.length).toBe(2);
  });

  it('repeats the current track in track-loop mode, but skip moves on', () => {
    const q = new TrackQueue();
    q.add([track(1), track(2)]);
    q.loop = 'track';
    q.advance();
    expect(q.advance()?.title).toBe('Track 1');
    expect(q.advance(true)?.title).toBe('Track 2');
  });

  it('recycles finished tracks in queue-loop mode', () => {
    const q = new TrackQueue();
    q.add([track(1), track(2)]);
    q.loop = 'queue';
    expect([q.advance(), q.advance(), q.advance()].map((t) => t?.title)).toEqual([
      'Track 1',
      'Track 2',
      'Track 1',
    ]);
  });

  it('removes by index and rejects invalid indexes', () => {
    const q = new TrackQueue();
    q.add([track(1), track(2), track(3)]);
    expect(q.remove(1)?.title).toBe('Track 2');
    expect(titles(q)).toEqual(['Track 1', 'Track 3']);
    expect(q.remove(5)).toBeNull();
    expect(q.remove(-1)).toBeNull();
  });

  it('shuffles using the injected RNG without losing tracks', () => {
    const q = new TrackQueue(200, () => 0);
    q.add([track(1), track(2), track(3), track(4)]);
    q.shuffle();
    expect(titles(q)).toEqual(['Track 2', 'Track 3', 'Track 4', 'Track 1']);
  });

  it('reset clears everything', () => {
    const q = new TrackQueue();
    q.add([track(1), track(2)]);
    q.advance();
    q.reset();
    expect(q.current).toBeNull();
    expect(q.length).toBe(0);
  });
});
