import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import type { Command, Track } from '../types';
import { joinAndEnqueue, replyEphemeral } from './guards';

const nameOption = (o: import('discord.js').SlashCommandStringOption) =>
  o.setName('name').setDescription('Playlist name').setRequired(true).setMinLength(1).setMaxLength(50);

export const playlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your saved playlists')
    .addSubcommand((s) => s.setName('save').setDescription('Save the current queue as a playlist').addStringOption(nameOption))
    .addSubcommand((s) => s.setName('load').setDescription('Queue a saved playlist').addStringOption(nameOption))
    .addSubcommand((s) => s.setName('list').setDescription('List your playlists'))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete a playlist').addStringOption(nameOption)),

  async execute(interaction, ctx) {
    const { guildId } = interaction;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const lists = ctx.db.listPlaylists(guildId, userId);
      await replyEphemeral(
        interaction,
        lists.length
          ? lists.map((l) => `• **${escapeMarkdown(l.name)}** (${l.trackCount} tracks)`).join('\n')
          : 'You have no saved playlists.',
      );
      return;
    }

    const name = interaction.options.getString('name', true).trim();

    if (sub === 'save') {
      const player = ctx.players.get(guildId);
      const tracks = [player?.queue.current, ...(player?.queue.upcoming ?? [])].filter((t): t is Track => !!t);
      if (tracks.length === 0) {
        await replyEphemeral(interaction, 'There is nothing in the queue to save.');
        return;
      }
      try {
        ctx.db.savePlaylist(guildId, userId, name, tracks);
      } catch (err) {
        await replyEphemeral(interaction, `❌ ${err instanceof Error ? err.message : 'Could not save playlist.'}`);
        return;
      }
      await replyEphemeral(interaction, `💾 Saved **${escapeMarkdown(name)}** (${tracks.length} tracks).`);
      return;
    }

    if (sub === 'delete') {
      const ok = ctx.db.deletePlaylist(guildId, userId, name);
      await replyEphemeral(interaction, ok ? `🗑️ Deleted **${escapeMarkdown(name)}**.` : 'Playlist not found.');
      return;
    }

    // load
    const stored = ctx.db.getPlaylist(guildId, userId, name);
    if (!stored || stored.length === 0) {
      await replyEphemeral(interaction, 'Playlist not found.');
      return;
    }
    await interaction.deferReply();
    const tracks: Track[] = stored.map((t) => ({
      ...t,
      requestedBy: interaction.member.displayName,
      requestedById: userId,
    }));
    const result = await joinAndEnqueue(interaction, ctx, tracks);
    await interaction.editReply(
      'error' in result
        ? `❌ ${result.error}`
        : `📂 Queued **${result.added}** tracks from **${escapeMarkdown(name)}**.`,
    );
  },
};
