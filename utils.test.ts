import { describe, expect, it } from 'vitest';
import { clamp, formatDuration, progressBar, trackDuration, truncate } from '../src/utils';

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
  });
  it('handles invalid input', () => {
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('trackDuration', () => {
  it('shows LIVE for unknown length', () => {
    expect(trackDuration(0)).toBe('LIVE');
    expect(trackDuration(90)).toBe('1:30');
  });
});

describe('truncate / clamp / progressBar', () => {
  it('truncates with an ellipsis', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world', 6)).toBe('hello…');
  });
  it('clamps', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 1, 3)).toBe(1);
  });
  it('places the marker proportionally', () => {
    expect(progressBar(0, 5)).toBe('🔘▬▬▬▬');
    expect(progressBar(1, 5)).toBe('▬▬▬▬🔘');
    expect(progressBar(5, 5)).toBe('▬▬▬▬🔘');
  });
});
