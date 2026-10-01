import type { Track } from '../src/types';

export const track = (n: number): Track => ({
  url: `https://www.youtube.com/watch?v=${n}`,
  title: `Track ${n}`,
  durationSec: 100 + n,
  requestedBy: 'tester',
  requestedById: '42',
});
