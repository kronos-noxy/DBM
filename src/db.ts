import BetterSqlite3 from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface StoredTrack {
  url: string;
  title: string;
  durationSec: number;
  thumbnail?: string;
}

export interface HistoryEntry {
  url: string;
  title: string;
  userId: string;
  playedAt: number;
}

const MAX_PLAYLISTS_PER_USER = 25;
const MAX_HISTORY_PER_GUILD = 500;

/** Append-only list; the index + 1 is the schema version stored in PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE guild_settings (
    guild_id   TEXT PRIMARY KEY,
    volume     INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL COLLATE NOCASE,
    created_at INTEGER NOT NULL,
    UNIQUE (guild_id, user_id, name)
  );
  CREATE TABLE playlist_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    url         TEXT NOT NULL,
    title       TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    thumbnail   TEXT
  );
  CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks (playlist_id, position);
  CREATE TABLE play_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    url       TEXT NOT NULL,
    title     TEXT NOT NULL,
    played_at INTEGER NOT NULL
  );
  CREATE INDEX idx_history_guild ON play_history (guild_id, id DESC);
  `,
];

export class BotDatabase {
  private readonly db: BetterSqlite3.Database;

  /** Pass ':memory:' for an ephemeral database (used in tests). */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new BetterSqlite3(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    const current = this.db.pragma('user_version', { simple: true }) as number;
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.db.transaction(() => {
        this.db.exec(MIGRATIONS[v]);
        this.db.pragma(`user_version = ${v + 1}`);
      })();
    }
  }

  // ---- guild settings ----

  getVolume(guildId: string): number | null {
    const row = this.db.prepare('SELECT volume FROM guild_settings WHERE guild_id = ?').get(guildId) as
      | { volume: number }
      | undefined;
    return row?.volume ?? null;
  }

  setVolume(guildId: string, volume: number): void {
    this.db
      .prepare(
        `INSERT INTO guild_settings (guild_id, volume, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET volume = excluded.volume, updated_at = excluded.updated_at`,
      )
      .run(guildId, volume, Date.now());
  }

  // ---- playlists ----

  /** Creates or overwrites the named playlist (names are case-insensitive). */
  savePlaylist(guildId: string, userId: string, name: string, tracks: StoredTrack[]): void {
    this.db.transaction(() => {
      const existing = this.db
        .prepare('SELECT id FROM playlists WHERE guild_id = ? AND user_id = ? AND name = ?')
        .get(guildId, userId, name) as { id: number } | undefined;

      let id: number;
      if (existing) {
        id = existing.id;
        this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
      } else {
        const { n } = this.db
          .prepare('SELECT COUNT(*) AS n FROM playlists WHERE guild_id = ? AND user_id = ?')
          .get(guildId, userId) as { n: number };
        if (n >= MAX_PLAYLISTS_PER_USER) {
          throw new Error(`You can only keep ${MAX_PLAYLISTS_PER_USER} playlists. Delete one first.`);
        }
        id = Number(
          this.db
            .prepare('INSERT INTO playlists (guild_id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
            .run(guildId, userId, name, Date.now()).lastInsertRowid,
        );
      }

      const insert = this.db.prepare(
        `INSERT INTO playlist_tracks (playlist_id, position, url, title, duration_sec, thumbnail)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      tracks.forEach((t, i) =>
        insert.run(id, i, t.url, t.title, Math.round(t.durationSec), t.thumbnail ?? null),
      );
    })();
  }

  getPlaylist(guildId: string, userId: string, name: string): StoredTrack[] | null {
    const playlist = this.db
      .prepare('SELECT id FROM playlists WHERE guild_id = ? AND user_id = ? AND name = ?')
      .get(guildId, userId, name) as { id: number } | undefined;
    if (!playlist) return null;

    const rows = this.db
      .prepare(
        `SELECT url, title, duration_sec AS durationSec, thumbnail
         FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`,
      )
      .all(playlist.id) as Array<{ url: string; title: string; durationSec: number; thumbnail: string | null }>;

    return rows.map((r) => ({
      url: r.url,
      title: r.title,
      durationSec: r.durationSec,
      ...(r.thumbnail ? { thumbnail: r.thumbnail } : {}),
    }));
  }

  listPlaylists(guildId: string, userId: string): Array<{ name: string; trackCount: number }> {
    return this.db
      .prepare(
        `SELECT p.name AS name, COUNT(t.id) AS trackCount
         FROM playlists p LEFT JOIN playlist_tracks t ON t.playlist_id = p.id
         WHERE p.guild_id = ? AND p.user_id = ?
         GROUP BY p.id ORDER BY p.name`,
      )
      .all(guildId, userId) as Array<{ name: string; trackCount: number }>;
  }

  deletePlaylist(guildId: string, userId: string, name: string): boolean {
    return (
      this.db
        .prepare('DELETE FROM playlists WHERE guild_id = ? AND user_id = ? AND name = ?')
        .run(guildId, userId, name).changes > 0
    );
  }

  // ---- history ----

  addHistory(guildId: string, userId: string, track: { url: string; title: string }): void {
    this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO play_history (guild_id, user_id, url, title, played_at) VALUES (?, ?, ?, ?, ?)')
        .run(guildId, userId, track.url, track.title, Date.now());
      this.db
        .prepare(
          `DELETE FROM play_history WHERE guild_id = ? AND id NOT IN
           (SELECT id FROM play_history WHERE guild_id = ? ORDER BY id DESC LIMIT ?)`,
        )
        .run(guildId, guildId, MAX_HISTORY_PER_GUILD);
    })();
  }

  getHistory(guildId: string, limit = 10): HistoryEntry[] {
    return this.db
      .prepare(
        `SELECT url, title, user_id AS userId, played_at AS playedAt
         FROM play_history WHERE guild_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(guildId, limit) as HistoryEntry[];
  }

  close(): void {
    this.db.close();
  }
}
