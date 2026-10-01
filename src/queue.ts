import type { LoopMode, Track } from './types';

export class QueueFullError extends Error {
  constructor(max: number) {
    super(`The queue is full (max ${max} tracks).`);
    this.name = 'QueueFullError';
  }
}

/** Pure queue state: no Discord or audio dependencies, so it is trivially testable. */
export class TrackQueue {
  private items: Track[] = [];
  current: Track | null = null;
  loop: LoopMode = 'off';

  constructor(
    readonly maxSize = 200,
    private readonly random: () => number = Math.random,
  ) {}

  get upcoming(): readonly Track[] {
    return this.items;
  }

  get length(): number {
    return this.items.length;
  }

  /** Adds as many tracks as fit and returns how many were added. Throws if the queue is already full. */
  add(tracks: Track | Track[]): number {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    const room = this.maxSize - this.items.length;
    if (list.length > 0 && room <= 0) throw new QueueFullError(this.maxSize);
    const accepted = list.slice(0, room);
    this.items.push(...accepted);
    return accepted.length;
  }

  /**
   * Moves to the next track according to the loop mode and returns it (null when finished).
   * `skip` bypasses single-track looping so /skip always moves on.
   */
  advance(skip = false): Track | null {
    if (this.current && !skip && this.loop === 'track') return this.current;
    if (this.current && this.loop === 'queue') this.items.push(this.current);
    this.current = this.items.shift() ?? null;
    return this.current;
  }

  /** Removes by 0-based index into the upcoming list. */
  remove(index: number): Track | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.items.length) return null;
    return this.items.splice(index, 1)[0] ?? null;
  }

  shuffle(): void {
    for (let i = this.items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
  }

  clear(): void {
    this.items = [];
  }

  reset(): void {
    this.items = [];
    this.current = null;
  }
}
