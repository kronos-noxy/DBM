import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const pauseCommand: Command = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    await interaction.reply(player.pause() ? '⏸️ Paused.' : 'Nothing to pause.');
  },
};
