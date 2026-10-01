import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const skipCommand: Command = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    const skipped = player.skip();
    await interaction.reply(skipped ? `⏭️ Skipped **${escapeMarkdown(skipped.title)}**.` : 'Nothing is playing.');
  },
};
