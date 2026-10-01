import { Events, MessageFlags, escapeMarkdown, type Client } from 'discord.js';
import type { BotDatabase } from './db';
import { trackEmbed } from './embeds';
import { logger } from './logger';
import type { GuildPlayer, TextSink } from './player';
import type { BotContext, Command } from './types';

async function announce(sink: TextSink | null, payload: Parameters<TextSink['send']>[0]): Promise<void> {
  if (!sink) return;
  try {
    await sink.send(payload);
  } catch (err) {
    logger.debug('Failed to send announcement', err);
  }
}

/** Connects a freshly created GuildPlayer to chat announcements and play history. */
export function wirePlayer(player: GuildPlayer, guildId: string, db: BotDatabase): void {
  player.hooks = {
    onTrackStart(track) {
      try {
        db.addHistory(guildId, track.requestedById, track);
      } catch (err) {
        logger.warn('Failed to record play history', err);
      }
      void announce(player.textChannel, { embeds: [trackEmbed('Now playing', track)] });
    },
    onTrackError(track) {
      void announce(
        player.textChannel,
        `⚠️ Couldn't play **${escapeMarkdown(track.title)}** — skipping it.`,
      );
    },
    onFinished() {
      void announce(player.textChannel, '✅ Queue finished.');
    },
    onIdleTimeout() {
      void announce(player.textChannel, '👋 Leaving the voice channel due to inactivity.');
    },
  };
}

export function registerHandlers(client: Client, ctx: BotContext, commands: Map<string, Command>): void {
  client.once(Events.ClientReady, (ready) => {
    ready.user.setActivity('/play');
    logger.info(`Logged in as ${ready.user.tag} (${ready.guilds.cache.size} guilds)`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, ctx);
    } catch (err) {
      logger.error(`Command /${interaction.commandName} failed`, err);
      const payload = { content: '❌ Something went wrong running that command.', flags: MessageFlags.Ephemeral } as const;
      try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
      } catch (replyErr) {
        logger.debug('Failed to send error reply', replyErr);
      }
    }
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const player = ctx.players.get(newState.guild.id);
    if (!player) return;

    // The bot itself was disconnected (kicked or channel deleted).
    if (oldState.id === client.user?.id && !newState.channelId) {
      player.destroy();
      return;
    }

    const channel = newState.guild.members.me?.voice.channel;
    if (!channel) return;
    player.setAlone(channel.members.filter((m) => !m.user.bot).size === 0);
  });

  client.on(Events.Error, (err) => logger.error('Discord client error', err));
  client.on(Events.Warn, (msg) => logger.warn(msg));
}
