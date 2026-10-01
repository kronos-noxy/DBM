import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { QueueFullError } from '../queue';
import type { GuildPlayer, TextSink } from '../player';
import type { BotContext, GuildInteraction, Track } from '../types';

export function replyEphemeral(interaction: GuildInteraction, content: string) {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

/**
 * Returns the guild's player if the caller is in the same voice channel as the bot.
 * Otherwise replies with an explanation and returns null.
 */
export async function requirePlayer(
  interaction: GuildInteraction,
  ctx: BotContext,
): Promise<GuildPlayer | null> {
  const player = ctx.players.get(interaction.guildId);
  if (!player) {
    await replyEphemeral(interaction, 'Nothing is playing right now.');
    return null;
  }
  const userChannelId = interaction.member.voice.channelId;
  if (!userChannelId || userChannelId !== player.channelId) {
    await replyEphemeral(interaction, 'Join my voice channel to use this command.');
    return null;
  }
  return player;
}

/** Joins the caller's voice channel (if needed) and queues tracks. */
export async function joinAndEnqueue(
  interaction: GuildInteraction,
  ctx: BotContext,
  tracks: Track[],
): Promise<{ player: GuildPlayer; added: number } | { error: string }> {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) return { error: 'Join a voice channel first.' };

  const existing = ctx.players.get(interaction.guildId);
  if (existing?.channelId && existing.channelId !== voiceChannel.id) {
    return { error: "I'm already playing in a different voice channel." };
  }

  const me = interaction.guild.members.me;
  const perms = me ? voiceChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return { error: 'I need **Connect** and **Speak** permissions in your voice channel.' };
  }

  const player = existing ?? ctx.players.getOrCreate(interaction.guildId);
  if (interaction.channel && 'send' in interaction.channel) {
    player.textChannel = interaction.channel as unknown as TextSink;
  }

  try {
    await player.connect(voiceChannel);
  } catch (err) {
    if (!existing) player.destroy();
    return { error: err instanceof Error ? err.message : 'Could not join the voice channel.' };
  }

  try {
    return { player, added: player.enqueue(tracks) };
  } catch (err) {
    if (err instanceof QueueFullError) return { error: err.message };
    throw err;
  }
}
