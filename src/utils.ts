/** Formats seconds as m:ss or h:mm:ss. Invalid/negative input yields 0:00. */
export function formatDuration(totalSec: number): string {
  const s = Number.isFinite(totalSec) && totalSec > 0 ? Math.floor(totalSec) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Track length for display; unknown/zero length is shown as LIVE. */
export function trackDuration(durationSec: number): string {
  return durationSec > 0 ? formatDuration(durationSec) : 'LIVE';
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function progressBar(ratio: number, width = 18): string {
  const pos = Math.round(clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1) * (width - 1));
  return Array.from({ length: width }, (_, i) => (i === pos ? '🔘' : '▬')).join('');
}
