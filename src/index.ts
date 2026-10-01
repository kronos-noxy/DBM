import http from 'http';
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { setToken } from 'play-dl';
import { commandMap } from './commands';
import { loadConfig } from './config';
import { BotDatabase } from './db';
import { registerHandlers, wirePlayer } from './handlers';
import { logger, setLogLevel } from './logger';
import { PlayerManager } from './player';
import type { BotContext } from './types';
const port = process.env.PORT || 3000;

http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(port, () => {
  console.log(`Port listener active on port ${port}`);
});

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  if (config.youtubeCookie) {
    await setToken({ youtube: { cookie: config.youtubeCookie } });
  }

  const db = new BotDatabase(config.dbPath);
  const players = new PlayerManager({
    maxQueueSize: config.maxQueueSize,
    idleTimeoutMs: config.idleTimeoutMs,
    getInitialVolume: (guildId) => db.getVolume(guildId) ?? config.defaultVolume,
    onCreate: (player, guildId) => wirePlayer(player, guildId, db),
  });

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const ctx: BotContext = { config, db, players };
  registerHandlers(client, ctx, commandMap);

  let shuttingDown = false;
  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Shutting down (${reason})`);
    try {
      players.destroyAll();
      await client.destroy();
      db.close();
    } catch (err) {
      logger.error('Error during shutdown', err);
    } finally {
      process.exit(exitCode);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    void shutdown('uncaughtException', 1);
  });

  await client.login(config.token);
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
