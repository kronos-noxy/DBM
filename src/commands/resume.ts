import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const resumeCommand: Command = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    await interaction.reply(player.resume() ? '▶️ Resumed.' : 'Nothing to resume.');
  },
};
