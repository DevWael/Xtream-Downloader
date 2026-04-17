import { getStoredAuthConfig } from '../hooks/useAuth';

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface Stream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating?: string;
  rating_5based?: number;
  added?: string;
  is_adult?: string;
  category_id: string;
  container_extension: string;
  custom_sid?: string;
  direct_source?: string;
}

export interface Series {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface SeriesEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    movie_image: string;
    plot: string;
    releasedate: string;
    rating: string;
    duration: string;
  };
  custom_sid: string;
  added: string;
  season: number;
  direct_source: string;
}

export interface SeriesInfo {
  seasons: number[];
  info: any;
  episodes: Record<string, SeriesEpisode[]>;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

export const fetchFromApi = async (action: string, extraParams: Record<string, string> = {}) => {
  const config = getStoredAuthConfig();
  if (!config) {
    throw new Error('Not authenticated');
  }

  const cacheKey = `${action}_${JSON.stringify(extraParams)}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Ensure host doesn't end with a slash
  const baseUrl = config.host.replace(/\/$/, '');
  const targetUrl = new URL(`${baseUrl}/player_api.php`);
  
  targetUrl.searchParams.append('username', config.username);
  targetUrl.searchParams.append('password', config.password);
  targetUrl.searchParams.append('action', action);
  
  for (const [key, value] of Object.entries(extraParams)) {
    targetUrl.searchParams.append(key, value);
  }

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl.toString())}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  apiCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};

export const getVodCategories = async (): Promise<Category[]> => {
  return fetchFromApi('get_vod_categories');
};

export const getVodStreams = async (categoryId?: string): Promise<Stream[]> => {
  const params: Record<string, string> = {};
  if (categoryId) params.category_id = categoryId;
  return fetchFromApi('get_vod_streams', params);
};

export const getSeriesCategories = async (): Promise<Category[]> => {
  return fetchFromApi('get_series_categories');
};

export const getSeries = async (categoryId?: string): Promise<Series[]> => {
  const params: Record<string, string> = {};
  if (categoryId) params.category_id = categoryId;
  return fetchFromApi('get_series', params);
};

export const getSeriesInfo = async (seriesId: string): Promise<SeriesInfo> => {
  return fetchFromApi('get_series_info', { series_id: seriesId });
};

export const getStreamUrl = (streamId: number | string, extension: string, type: 'movie' | 'series' = 'movie'): string => {
  const config = getStoredAuthConfig();
  if (!config) return '';
  const baseUrl = config.host.replace(/\/$/, '');
  return `${baseUrl}/${type}/${config.username}/${config.password}/${streamId}.${extension}`;
};

export const getMovieDownloadUrl = (streamId: number, extension: string, title?: string): string => {
  const originalUrl = getStreamUrl(streamId, extension, 'movie');
  if (!originalUrl) return '';
  const filename = title ? `${title}.${extension}` : `movie_${streamId}.${extension}`;
  return `/api/download?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(filename)}`;
};

export const getSeriesDownloadUrl = (streamId: string, extension: string, title?: string): string => {
  const originalUrl = getStreamUrl(streamId, extension, 'series');
  if (!originalUrl) return '';
  const filename = title ? `${title}.${extension}` : `episode_${streamId}.${extension}`;
  return `/api/download?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(filename)}`;
};

export const downloadMedia = async (streamId: number | string, extension: string, title: string, type: 'movie' | 'series', location?: string, subfolder?: string) => {
  const originalUrl = getStreamUrl(streamId, extension, type);
  if (!originalUrl) return;
  const filename = title ? `${title}.${extension}` : `${type}_${streamId}.${extension}`;
  
  // Append subfolder to location for organized directory structure
  const finalLocation = location && subfolder ? `${location.replace(/\/$/, '')}/${subfolder}` : location;
  
  if (finalLocation) {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl, filename, location: finalLocation })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      console.log('Server download queued:', data.id);
      return true;
    } catch (err) {
      console.error('Failed to queue server download:', err);
      alert('Failed to add to download queue');
    }
  } else {
    const url = `/api/download?url=${encodeURIComponent(originalUrl)}&filename=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Queue & Settings APIs
export const getSettings = async () => {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const saveSettings = async (settings: any) => {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
};

export const getQueue = async () => {
  const res = await fetch('/api/queue');
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
};

export const removeQueueItem = async (id: string) => {
  const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove queue item');
  return res.json();
};

export const clearCompletedQueue = async () => {
  const res = await fetch(`/api/queue`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear queue');
  return res.json();
};

export const pauseQueueItem = async (id: string) => {
  const res = await fetch(`/api/queue/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'pause' })
  });
  if (!res.ok) throw new Error('Failed to pause item');
  return res.json();
};

export const resumeQueueItem = async (id: string) => {
  const res = await fetch(`/api/queue/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resume' })
  });
  if (!res.ok) throw new Error('Failed to resume item');
  return res.json();
};
