import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { requirePlayer } from './guards';

export const volumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume (saved per server)')
    .addIntegerOption((o) =>
      o.setName('percent').setDescription('1-200').setRequired(true).setMinValue(1).setMaxValue(200),
    ),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    const percent = interaction.options.getInteger('percent', true);
    player.setVolume(percent);
    ctx.db.setVolume(interaction.guildId, percent);
    await interaction.reply(`🔊 Volume set to **${percent}%**.`);
  },
};
