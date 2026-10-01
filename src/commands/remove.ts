import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const removeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue')
    .addIntegerOption((o) =>
      o.setName('position').setDescription('Position shown in /queue').setRequired(true).setMinValue(1),
    ),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    const removed = player.queue.remove(interaction.options.getInteger('position', true) - 1);
    await interaction.reply(
      removed ? `🗑️ Removed **${escapeMarkdown(removed.title)}**.` : "There's no track at that position.",
    );
  },
};
