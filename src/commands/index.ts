import type { Command } from '../types';
import { historyCommand } from './history';
import { loopCommand } from './loop';
import { nowPlayingCommand } from './nowplaying';
import { pauseCommand } from './pause';
import { playCommand } from './play';
import { playlistCommand } from './playlist';
import { queueCommand } from './queue';
import { removeCommand } from './remove';
import { resumeCommand } from './resume';
import { shuffleCommand } from './shuffle';
import { skipCommand } from './skip';
import { stopCommand } from './stop';
import { volumeCommand } from './volume';

export const commands: Command[] = [
  playCommand,
  pauseCommand,
  resumeCommand,
  skipCommand,
  stopCommand,
  queueCommand,
  nowPlayingCommand,
  volumeCommand,
  loopCommand,
  shuffleCommand,
  removeCommand,
  playlistCommand,
  historyCommand,
];

export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
