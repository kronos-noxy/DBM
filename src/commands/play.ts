import { EmbedBuilder, SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import { BRAND_COLOR, trackEmbed } from '../embeds';
import { logger } from '../logger';
import { ResolveError, resolveTracks } from '../resolver';
import type { Command, Track } from '../types';
import { joinAndEnqueue, replyEphemeral } from './guards';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue')
    .addStringOption((o) =>
      o.setName('query').setDescription('YouTube URL, playlist URL, or search terms').setRequired(true).setMaxLength(300),
    ),

  async execute(interaction, ctx) {
    if (!interaction.member.voice.channel) {
      await replyEphemeral(interaction, 'Join a voice channel first.');
      return;
    }
    await interaction.deferReply();

    const query = interaction.options.getString('query', true).trim();
    let tracks: Track[];
    try {
      tracks = await resolveTracks(
        query,
        { id: interaction.user.id, name: interaction.member.displayName },
        ctx.config.maxQueueSize,
      );
    } catch (err) {
      if (!(err instanceof ResolveError)) logger.warn(`Resolve failed for "${query}"`, err);
      await interaction.editReply(
        `❌ ${err instanceof ResolveError ? err.message : 'Could not load that. It may be private, age-restricted or region-locked.'}`,
      );
      return;
    }

    const result = await joinAndEnqueue(interaction, ctx, tracks);
    if ('error' in result) {
      await interaction.editReply(`❌ ${result.error}`);
      return;
    }

    if (tracks.length === 1) {
      await interaction.editReply({ embeds: [trackEmbed('Added to queue', tracks[0])] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({ name: 'Playlist added' })
        .setDescription(
          `Queued **${result.added}** of ${tracks.length} tracks, starting with **${escapeMarkdown(tracks[0].title)}**.`,
        );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
