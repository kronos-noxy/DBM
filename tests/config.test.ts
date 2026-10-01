import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const base = { DISCORD_TOKEN: 'tok', DISCORD_CLIENT_ID: '123' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({
      token: 'tok',
      clientId: '123',
      dbPath: './data/bot.db',
      defaultVolume: 50,
      maxQueueSize: 200,
      idleTimeoutMs: 300_000,
      logLevel: 'info',
    });
    expect(c.guildId).toBeUndefined();
  });

  it('reports every missing required variable', () => {
    expect(() => loadConfig({})).toThrow(/DISCORD_TOKEN, DISCORD_CLIENT_ID/);
  });

  it('parses overrides', () => {
    const c = loadConfig({ ...base, DEFAULT_VOLUME: '75', IDLE_TIMEOUT_SECONDS: '60', LOG_LEVEL: 'DEBUG', GUILD_ID: ' 9 ' });
    expect(c.defaultVolume).toBe(75);
    expect(c.idleTimeoutMs).toBe(60_000);
    expect(c.logLevel).toBe('debug');
    expect(c.guildId).toBe('9');
  });

  it('rejects invalid numbers and log levels', () => {
    expect(() => loadConfig({ ...base, DEFAULT_VOLUME: '500' })).toThrow(/DEFAULT_VOLUME/);
    expect(() => loadConfig({ ...base, MAX_QUEUE_SIZE: 'abc' })).toThrow(/MAX_QUEUE_SIZE/);
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
