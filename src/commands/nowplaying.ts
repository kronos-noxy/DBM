import { SlashCommandBuilder } from 'discord.js';
import { trackEmbed } from '../embeds';
import type { Command } from '../types';
import { formatDuration, progressBar, trackDuration } from '../utils';
import { replyEphemeral } from './guards';

export const nowPlayingCommand: Command = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track'),
  async execute(interaction, ctx) {
    const player = ctx.players.get(interaction.guildId);
    const track = player?.queue.current;
    if (!player || !track) {
      await replyEphemeral(interaction, 'Nothing is playing.');
      return;
    }
    const elapsed = player.elapsedSec;
    const ratio = track.durationSec > 0 ? elapsed / track.durationSec : 0;
    const embed = trackEmbed('Now playing', track).addFields(
      {
        name: 'Progress',
        value: `${progressBar(ratio)}\n${formatDuration(elapsed)} / ${trackDuration(track.durationSec)}`,
      },
      { name: 'Volume', value: `${player.volume}%`, inline: true },
      { name: 'Loop', value: player.queue.loop, inline: true },
    );
    await interaction.reply({ embeds: [embed] });
  },
};
