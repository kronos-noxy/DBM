import { EmbedBuilder, MessageFlags, SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import { BRAND_COLOR } from '../embeds';
import type { Command } from '../types';
import { clamp, trackDuration, truncate } from '../utils';

const PAGE_SIZE = 10;

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the queue')
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction, ctx) {
    const player = ctx.players.get(interaction.guildId);
    const current = player?.queue.current;
    const upcoming = player?.queue.upcoming ?? [];
    if (!player || (!current && upcoming.length === 0)) {
      await interaction.reply({ content: 'The queue is empty.', flags: MessageFlags.Ephemeral });
      return;
    }

    const pages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
    const page = clamp(interaction.options.getInteger('page') ?? 1, 1, pages);
    const start = (page - 1) * PAGE_SIZE;
    const lines = upcoming
      .slice(start, start + PAGE_SIZE)
      .map((t, i) => `**${start + i + 1}.** ${truncate(escapeMarkdown(t.title), 60)} \`${trackDuration(t.durationSec)}\``);

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('Queue')
      .setDescription(lines.join('\n') || '*Nothing up next.*')
      .setFooter({ text: `Page ${page}/${pages} • ${upcoming.length} queued • loop: ${player.queue.loop}` });
    if (current) {
      embed.addFields({ name: 'Now playing', value: truncate(escapeMarkdown(current.title), 200) });
    }
    await interaction.reply({ embeds: [embed] });
  },
};
