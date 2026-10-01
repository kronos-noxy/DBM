import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const shuffleCommand: Command = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    if (player.queue.length < 2) {
      await interaction.reply('Need at least 2 queued tracks to shuffle.');
      return;
    }
    player.queue.shuffle();
    await interaction.reply(`🔀 Shuffled ${player.queue.length} tracks.`);
  },
};
