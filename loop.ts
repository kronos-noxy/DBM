import { SlashCommandBuilder } from 'discord.js';
import type { Command, LoopMode } from '../types';
import { requirePlayer } from './guards';

export const loopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode')
    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Current track', value: 'track' },
          { name: 'Whole queue', value: 'queue' },
        ),
    ),
  async execute(interaction, ctx) {
    const player = await requirePlayer(interaction, ctx);
    if (!player) return;
    const mode = interaction.options.getString('mode', true) as LoopMode;
    player.queue.loop = mode;
    await interaction.reply(`🔁 Loop mode: **${mode}**.`);
  },
};
