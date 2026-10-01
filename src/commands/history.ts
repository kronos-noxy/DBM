import { EmbedBuilder, MessageFlags, SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import { BRAND_COLOR } from '../embeds';
import type { Command } from '../types';
import { truncate } from '../utils';

export const historyCommand: Command = {
  data: new SlashCommandBuilder().setName('history').setDescription('Show recently played tracks in this server'),
  async execute(interaction, ctx) {
    const entries = ctx.db.getHistory(interaction.guildId, 10);
    if (entries.length === 0) {
      await interaction.reply({ content: 'Nothing has been played yet.', flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = entries.map(
      (e) =>
        `• ${truncate(escapeMarkdown(e.title), 60)} — <@${e.userId}> <t:${Math.floor(e.playedAt / 1000)}:R>`,
    );
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('Recently played').setDescription(lines.join('\n'))],
      allowedMentions: { parse: [] },
    });
  },
};
