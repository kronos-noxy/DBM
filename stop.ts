import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const stopCommand: Command = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback, clear the queue and leave'),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    player.destroy();
    await interaction.reply('⏹️ Stopped and left the voice channel.');
  },
};
