import { EmbedBuilder } from 'discord.js';
import type { Track } from './types';
import { trackDuration, truncate } from './utils';

export const BRAND_COLOR = 0x5865f2;

export function trackEmbed(heading: string, track: Track): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: heading })
    .setTitle(truncate(track.title, 256))
    .setURL(track.url)
    .addFields({ name: 'Duration', value: trackDuration(track.durationSec), inline: true })
    .setFooter({ text: `Requested by ${track.requestedBy}` });
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}
