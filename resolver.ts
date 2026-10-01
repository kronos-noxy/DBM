import { playlist_info, search, validate, video_basic_info } from 'play-dl';
import type { Requester, Track } from './types';

/** An error whose message is safe to show to end users. */
export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolveError';
  }
}

interface VideoLike {
  url: string;
  title?: string;
  durationInSec: number;
  thumbnails?: Array<{ url: string }>;
}

export function toTrack(video: VideoLike, requester: Requester): Track {
  return {
    url: video.url,
    title: video.title?.trim() || 'Unknown title',
    durationSec: video.durationInSec || 0,
    thumbnail: video.thumbnails?.[0]?.url,
    requestedBy: requester.name,
    requestedById: requester.id,
  };
}

/** Turns a YouTube URL, YouTube playlist URL, or free-text search into tracks. */
export async function resolveTracks(query: string, requester: Requester, limit = 100): Promise<Track[]> {
  const kind = await validate(query);

  if (kind === 'yt_video') {
    const info = await video_basic_info(query);
    return [toTrack(info.video_details, requester)];
  }

  if (kind === 'yt_playlist') {
    const playlist = await playlist_info(query, { incomplete: true });
    const videos = await playlist.all_videos();
    if (videos.length === 0) throw new ResolveError('That playlist is empty or private.');
    return videos.slice(0, limit).map((v) => toTrack(v, requester));
  }

  if (kind === 'search' || (kind === false && !/^https?:\/\//i.test(query))) {
    const results = await search(query, { limit: 1, source: { youtube: 'video' } });
    if (!results[0]) throw new ResolveError(`No results found for "${query}".`);
    return [toTrack(results[0], requester)];
  }

  throw new ResolveError('Only YouTube links/playlists and search terms are supported.');
}
