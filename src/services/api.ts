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

export const fetchFromApi = async (action: string, extraParams: Record<string, string> = {}) => {
  const config = getStoredAuthConfig();
  if (!config) {
    throw new Error('Not authenticated');
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
  return response.json();
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
