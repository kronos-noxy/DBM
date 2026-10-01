import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { loadConfig } from './config';
import { logger } from './logger';

async function main(): Promise<void> {
  const config = loadConfig();
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = commands.map((c) => c.data.toJSON());

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body });
  logger.info(`Registered ${body.length} commands ${config.guildId ? `to guild ${config.guildId}` : 'globally'}`);
}

main().catch((err) => {
  logger.error('Failed to register commands', err);
  process.exit(1);
});
