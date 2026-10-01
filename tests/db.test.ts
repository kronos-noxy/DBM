import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BotDatabase } from '../src/db';
import { track } from './fixtures';

let db: BotDatabase;
beforeEach(() => {
  db = new BotDatabase(':memory:');
});
afterEach(() => db.close());

describe('guild settings', () => {
  it('returns null for unknown guilds and upserts volume', () => {
    expect(db.getVolume('g1')).toBeNull();
    db.setVolume('g1', 80);
    db.setVolume('g1', 120);
    expect(db.getVolume('g1')).toBe(120);
    expect(db.getVolume('g2')).toBeNull();
  });
});

describe('playlists', () => {
  it('saves, loads in order, and overwrites case-insensitively', () => {
    db.savePlaylist('g', 'u', 'Chill', [track(1), track(2)]);
    expect(db.getPlaylist('g', 'u', 'chill')?.map((t) => t.title)).toEqual(['Track 1', 'Track 2']);

    db.savePlaylist('g', 'u', 'CHILL', [track(3)]);
    expect(db.getPlaylist('g', 'u', 'Chill')?.map((t) => t.title)).toEqual(['Track 3']);
    expect(db.listPlaylists('g', 'u')).toHaveLength(1);
  });

  it('scopes playlists by guild and user', () => {
    db.savePlaylist('g', 'u1', 'mix', [track(1)]);
    expect(db.getPlaylist('g', 'u2', 'mix')).toBeNull();
    expect(db.getPlaylist('other', 'u1', 'mix')).toBeNull();
  });

  it('lists with track counts and deletes (cascading tracks)', () => {
    db.savePlaylist('g', 'u', 'a', [track(1), track(2)]);
    db.savePlaylist('g', 'u', 'b', []);
    expect(db.listPlaylists('g', 'u')).toEqual([
      { name: 'a', trackCount: 2 },
      { name: 'b', trackCount: 0 },
    ]);
    expect(db.deletePlaylist('g', 'u', 'a')).toBe(true);
    expect(db.deletePlaylist('g', 'u', 'a')).toBe(false);
    expect(db.getPlaylist('g', 'u', 'a')).toBeNull();
  });

  it('enforces the per-user playlist limit', () => {
    for (let i = 0; i < 25; i++) db.savePlaylist('g', 'u', `p${i}`, [track(i)]);
    expect(() => db.savePlaylist('g', 'u', 'one-too-many', [track(1)])).toThrow(/25 playlists/);
    // overwriting an existing one is still allowed
    expect(() => db.savePlaylist('g', 'u', 'p0', [track(2)])).not.toThrow();
  });
});

describe('history', () => {
  it('returns most recent first and respects the limit', () => {
    for (let i = 1; i <= 5; i++) db.addHistory('g', 'u', track(i));
    db.addHistory('other', 'u', track(99));
    const history = db.getHistory('g', 3);
    expect(history.map((h) => h.title)).toEqual(['Track 5', 'Track 4', 'Track 3']);
  });
});
