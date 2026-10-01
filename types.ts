import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Config } from './config';
import type { BotDatabase } from './db';
import type { PlayerManager } from './player';

export interface Track {
  url: string;
  title: string;
  /** 0 means unknown / live. */
  durationSec: number;
  thumbnail?: string;
  requestedBy: string;
  requestedById: string;
}

export interface Requester {
  id: string;
  name: string;
}

export type LoopMode = 'off' | 'track' | 'queue';

export type GuildInteraction = ChatInputCommandInteraction<'cached'>;

export interface BotContext {
  config: Config;
  db: BotDatabase;
  players: PlayerManager;
}

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: GuildInteraction, ctx: BotContext): Promise<void>;
}
