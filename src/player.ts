import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioResource,
  type VoiceConnection,
} from '@discordjs/voice';
import type { MessageCreateOptions, VoiceBasedChannel } from 'discord.js';
import { stream as playStream } from 'play-dl';
import { logger } from './logger';
import { TrackQueue } from './queue';
import type { Track } from './types';

/** Minimal shape of a text channel we can announce into. */
export interface TextSink {
  send(options: string | MessageCreateOptions): Promise<unknown>;
}

export interface PlayerHooks {
  onTrackStart?(track: Track): void;
  onTrackError?(track: Track, error: unknown): void;
  /** Queue ran dry (nothing left to play). */
  onFinished?(): void;
  onIdleTimeout?(): void;
}

export interface PlayerOptions {
  guildId: string;
  /** Percent, 1-200. */
  volume: number;
  maxQueueSize: number;
  idleTimeoutMs: number;
  onDestroy: () => void;
}

const MAX_ERROR_STREAK = 5;

export class GuildPlayer {
  readonly queue: TrackQueue;
  textChannel: TextSink | null = null;
  hooks: PlayerHooks = {};

  private readonly audio = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  private connection: VoiceConnection | null = null;
  private resource: AudioResource | null = null;
  private volumeRatio: number;
  private busy = false;
  private destroyed = false;
  private forceAdvance = false;
  private errorStreak = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private aloneTimer: NodeJS.Timeout | null = null;

  constructor(private readonly opts: PlayerOptions) {
    this.queue = new TrackQueue(opts.maxQueueSize);
    this.volumeRatio = opts.volume / 100;

    this.audio.on(AudioPlayerStatus.Idle, () => {
      this.resource = null;
      void this.playNext();
    });

    // @discordjs/voice moves the player to Idle after an error, which advances the queue.
    this.audio.on('error', (err) => {
      logger.error('Audio player error', err);
      this.forceAdvance = true;
      const track = this.queue.current;
      if (track) this.hooks.onTrackError?.(track, err);
    });
  }

  // ---- state ----

  get channelId(): string | null {
    return this.connection?.joinConfig.channelId ?? null;
  }

  get volume(): number {
    return Math.round(this.volumeRatio * 100);
  }

  get elapsedSec(): number {
    return Math.floor((this.resource?.playbackDuration ?? 0) / 1000);
  }

  // ---- connection ----

  async connect(channel: VoiceBasedChannel): Promise<void> {
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) return;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    this.connection = connection;

    // Discord may move/kick the bot; give it a few seconds to reconnect before giving up.
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      this.connection = null;
      throw new Error('Could not join the voice channel in time. Please try again.');
    }
    connection.subscribe(this.audio);
  }

  // ---- playback ----

  enqueue(tracks: Track | Track[]): number {
    const added = this.queue.add(tracks);
    this.clearIdleTimer();
    this.ensurePlaying();
    return added;
  }

  skip(): Track | null {
    const current = this.queue.current;
    if (!current) return null;
    this.forceAdvance = true;
    if (this.audio.state.status === AudioPlayerStatus.Idle) this.ensurePlaying();
    else this.audio.stop(true); // Idle event -> playNext()
    return current;
  }

  pause(): boolean {
    return this.audio.pause(true);
  }

  resume(): boolean {
    return this.audio.unpause();
  }

  setVolume(percent: number): void {
    this.volumeRatio = Math.min(200, Math.max(1, percent)) / 100;
    this.resource?.volume?.setVolume(this.volumeRatio);
  }

  /** Stops playback, clears the queue and leaves the voice channel. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearIdleTimer();
    this.clearAloneTimer();
    this.queue.reset();
    this.audio.stop(true);
    this.audio.removeAllListeners();
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
    this.connection = null;
    this.opts.onDestroy();
  }

  /** Called when the last human leaves/joins the channel. */
  setAlone(alone: boolean): void {
    if (!alone) return this.clearAloneTimer();
    if (this.aloneTimer || this.destroyed) return;
    this.aloneTimer = setTimeout(() => {
      this.hooks.onIdleTimeout?.();
      this.destroy();
    }, this.opts.idleTimeoutMs);
  }

  // ---- internals ----

  private ensurePlaying(): void {
    if (!this.busy && !this.destroyed && this.audio.state.status === AudioPlayerStatus.Idle) {
      void this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.destroyed || this.busy) return;
    this.busy = true;
    try {
      for (;;) {
        const track = this.queue.advance(this.forceAdvance);
        this.forceAdvance = false;

        if (!track) {
          this.hooks.onFinished?.();
          this.startIdleTimer();
          return;
        }

        try {
          const source = await playStream(track.url, { quality: 2 });
          if (this.destroyed) {
            source.stream.destroy();
            return;
          }
          // Arbitrary => transcoded through ffmpeg, which is what makes inline volume work.
          const resource = createAudioResource(source.stream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
          });
          resource.volume?.setVolume(this.volumeRatio);
          this.resource = resource;
          this.audio.play(resource);
          this.errorStreak = 0;
          this.hooks.onTrackStart?.(track);
          return;
        } catch (err) {
          logger.warn(`Failed to stream "${track.title}"`, err);
          this.hooks.onTrackError?.(track, err);
          this.forceAdvance = true;
          if (++this.errorStreak >= MAX_ERROR_STREAK) {
            this.errorStreak = 0;
            this.queue.reset();
            this.hooks.onFinished?.();
            this.startIdleTimer();
            return;
          }
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.hooks.onIdleTimeout?.();
      this.destroy();
    }, this.opts.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private clearAloneTimer(): void {
    if (this.aloneTimer) clearTimeout(this.aloneTimer);
    this.aloneTimer = null;
  }
}

export interface PlayerManagerOptions {
  maxQueueSize: number;
  idleTimeoutMs: number;
  getInitialVolume(guildId: string): number;
  onCreate?(player: GuildPlayer, guildId: string): void;
}

export class PlayerManager {
  private readonly players = new Map<string, GuildPlayer>();

  constructor(private readonly opts: PlayerManagerOptions) {}

  get size(): number {
    return this.players.size;
  }

  get(guildId: string): GuildPlayer | undefined {
    return this.players.get(guildId);
  }

  getOrCreate(guildId: string): GuildPlayer {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    const player: GuildPlayer = new GuildPlayer({
      guildId,
      volume: this.opts.getInitialVolume(guildId),
      maxQueueSize: this.opts.maxQueueSize,
      idleTimeoutMs: this.opts.idleTimeoutMs,
      onDestroy: () => {
        if (this.players.get(guildId) === player) this.players.delete(guildId);
      },
    });
    this.players.set(guildId, player);
    this.opts.onCreate?.(player, guildId);
    return player;
  }

  destroyAll(): void {
    for (const player of [...this.players.values()]) player.destroy();
  }
}
