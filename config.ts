import type { LogLevel } from './logger';

export interface Config {
  token: string;
  clientId: string;
  guildId?: string;
  dbPath: string;
  defaultVolume: number;
  maxQueueSize: number;
  idleTimeoutMs: number;
  logLevel: LogLevel;
  youtubeCookie?: string;
}

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

function readInt(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'].filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const logLevel = (env.LOG_LEVEL?.trim().toLowerCase() || 'info') as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}`);
  }

  return {
    token: env.DISCORD_TOKEN!.trim(),
    clientId: env.DISCORD_CLIENT_ID!.trim(),
    guildId: env.GUILD_ID?.trim() || undefined,
    dbPath: env.DB_PATH?.trim() || './data/bot.db',
    defaultVolume: readInt(env, 'DEFAULT_VOLUME', 50, 1, 200),
    maxQueueSize: readInt(env, 'MAX_QUEUE_SIZE', 200, 1, 5000),
    idleTimeoutMs: readInt(env, 'IDLE_TIMEOUT_SECONDS', 300, 10, 86_400) * 1000,
    logLevel,
    youtubeCookie: env.YOUTUBE_COOKIE?.trim() || undefined,
  };
}
