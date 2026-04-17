import React, { useEffect, useState } from 'react';
import { Download, ChevronLeft, Check, Play } from 'lucide-react';
import type { Category, Series as SeriesModel, SeriesInfo } from '../services/api';
import { getSeriesCategories, getSeries, getSeriesInfo, getSeriesDownloadUrl, getStreamUrl } from '../services/api';
import { Loader } from '../components/Loader';
import { MediaCard } from '../components/MediaCard';
import { useDownloaded } from '../hooks/useDownloaded';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

export const Series: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  
  const [allSeries, setAllSeries] = useState<SeriesModel[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedSeries, setSelectedSeries] = useState<SeriesModel | null>(null);
  
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewStream, setPreviewStream] = useState<{url: string, title: string} | null>(null);

  // New states for downloaded and bulk selection
  const { isDownloaded, toggleDownloaded } = useDownloaded();
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());

  // Derived state for currently visible series
  const seriesList = allSeries.filter(s => s.category_id === activeCategory);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch categories first
        const cats = await getSeriesCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setActiveCategory(cats[0].category_id);
        }
        setLoading(false);

        // Fetch all series to cache them and compute counts
        setLoadingContent(true);
        const allStr = await getSeries();
        
        const counts: Record<string, number> = {};
        allStr.forEach(s => {
          counts[s.category_id] = (counts[s.category_id] || 0) + 1;
        });
        
        setCategoryCounts(counts);
        setAllSeries(allStr);
      } catch (err) {
        setError('Failed to load series data');
      } finally {
        setLoading(false);
        setLoadingContent(false);
      }
    };
    
    fetchData();
  }, []);

  // Load Series Info (Episodes)
  useEffect(() => {
    if (!selectedSeries) return;

    const fetchInfo = async () => {
      setLoadingContent(true);
      setError(null);
      try {
        const data = await getSeriesInfo(selectedSeries.series_id.toString());
        setSeriesInfo(data);
        
        // Find first season that has episodes
        let firstAvailableSeason = null;
        if (data.episodes) {
           const seasons = Object.keys(data.episodes).map(Number).sort((a,b) => a-b);
           if(seasons.length > 0) firstAvailableSeason = seasons[0];
        }
        setActiveSeason(firstAvailableSeason);
      } catch (err) {
        setError('Failed to load series details');
      } finally {
        setLoadingContent(false);
      }
    };

    fetchInfo();
  }, [selectedSeries]);

  // Clear selections when season changes
  useEffect(() => {
    setSelectedEpisodes(new Set());
  }, [activeSeason]);

  const handleBack = () => {
    setSelectedSeries(null);
    setSeriesInfo(null);
    setActiveSeason(null);
    setSelectedEpisodes(new Set());
  };

  const toggleEpisodeSelection = (episodeId: string) => {
    setSelectedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!seriesInfo || activeSeason === null) return;
    const episodes = seriesInfo.episodes[activeSeason] || [];
    
    if (selectedEpisodes.size === episodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(episodes.map(ep => ep.id)));
    }
  };

  const handleBulkDownload = async () => {
    if (selectedEpisodes.size === 0 || !seriesInfo || activeSeason === null || !selectedSeries) return;

    const episodes = seriesInfo.episodes[activeSeason] || [];
    const selectedList = episodes.filter(ep => selectedEpisodes.has(ep.id));
    
    for (let i = 0; i < selectedList.length; i++) {
      const episode = selectedList[i];
      const title = `${selectedSeries.name} - S${activeSeason}E${episode.episode_num} - ${episode.title}`;
      const url = getSeriesDownloadUrl(episode.id, episode.container_extension, title);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = title;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Mark as downloaded automatically
      if (!isDownloaded(episode.id)) {
        toggleDownloaded(episode.id);
      }

      // Delay between downloads (500ms)
      if (i < selectedList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setSelectedEpisodes(new Set());
  };

  if (loading) return <Loader />;

  return (
    <div className="page-with-sidebar">
      <aside>
        <h2 style={{ marginBottom: '1rem' }}>Categories</h2>
        <div className="category-list">
          {categories.map((cat) => (
            <div
              key={cat.category_id}
              className={`category-item ${activeCategory === cat.category_id ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(cat.category_id);
                handleBack();
              }}
            >
              <span>{cat.category_name}</span>
              {categoryCounts[cat.category_id] !== undefined && (
                <span className="category-count">
                  {categoryCounts[cat.category_id]}
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>
      
      <section>
        {selectedSeries ? (
          <div>
            <button className="btn btn-secondary" onClick={handleBack} style={{ marginBottom: '1.5rem' }}>
              <ChevronLeft size={20} /> Back to Series
            </button>
            
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <img 
                src={selectedSeries.cover} 
                alt={selectedSeries.name} 
                style={{ width: '200px', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-md)' }} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiIC8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM3NzciIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                }}
              />
              <div>
                <h1 style={{ fontSize: '2rem' }}>{selectedSeries.name}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{selectedSeries.plot}</p>
                {selectedSeries.director && <p><strong>Director:</strong> {selectedSeries.director}</p>}
                {selectedSeries.cast && <p><strong>Cast:</strong> {selectedSeries.cast}</p>}
                {selectedSeries.genre && <p><strong>Genre:</strong> {selectedSeries.genre}</p>}
              </div>
            </div>

            {loadingContent ? (
              <Loader />
            ) : seriesInfo ? (
              <div className="episodes-container">
                <div className="season-tabs">
                  {Object.keys(seriesInfo.episodes).sort((a,b) => Number(a)-Number(b)).map(season => (
                    <button
                      key={season}
                      className={`season-tab ${activeSeason === Number(season) ? 'active' : ''}`}
                      onClick={() => setActiveSeason(Number(season))}
                    >
                      Season {season}
                    </button>
                  ))}
                </div>

                {activeSeason && seriesInfo.episodes[activeSeason]?.length > 0 && (
                  <div className="header-actions" style={{ background: 'var(--secondary-bg)', padding: 'var(--spacing-md)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--spacing-md)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedEpisodes.size === seriesInfo.episodes[activeSeason].length}
                        onChange={toggleSelectAll}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 500 }}>Select All Episodes</span>
                    </label>
                    <div className="header-actions-right">
                      {selectedEpisodes.size > 0 && (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {selectedEpisodes.size} selected
                        </span>
                      )}
                      <button 
                        className="btn btn-primary"
                        onClick={handleBulkDownload}
                        disabled={selectedEpisodes.size === 0}
                      >
                        <Download size={18} />
                        Download Selected
                      </button>
                    </div>
                  </div>
                )}

                <div className="episode-list">
                  {activeSeason && seriesInfo.episodes[activeSeason]?.map((episode) => (
                    <div 
                      key={episode.id} 
                      className={`episode-card ${selectedEpisodes.has(episode.id) ? 'selected' : ''}`}
                      style={{ 
                        opacity: isDownloaded(episode.id) ? 0.7 : 1,
                        border: selectedEpisodes.has(episode.id) ? '1px solid var(--primary-color)' : ''
                      }}
                      onClick={() => toggleEpisodeSelection(episode.id)}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedEpisodes.has(episode.id)}
                        onChange={() => {}} // Handled by card click
                        style={{ width: '20px', height: '20px', cursor: 'pointer', margin: '0 var(--spacing-sm)' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                        <div className="media-image-wrapper" style={{ width: '160px', height: '90px', padding: 0, borderRadius: 'var(--border-radius-sm)', flexShrink: 0 }}>
                          <img 
                            src={episode.info?.movie_image || selectedSeries.cover} 
                            alt={episode.title} 
                            className="media-image"
                            style={{ position: 'relative' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = selectedSeries.cover;
                            }}
                          />
                          <div className="media-image-overlay">
                            <button 
                              className="play-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewStream({
                                  url: getStreamUrl(episode.id, episode.container_extension, 'series'),
                                  title: `Episode ${episode.episode_num}: ${episode.title}`
                                });
                              }}
                              title="Preview Episode"
                              style={{ width: '36px', height: '36px' }}
                            >
                              <Play size={18} fill="currentColor" />
                            </button>
                          </div>
                        {isDownloaded(episode.id) ? (
                          <button 
                            className="downloaded-toggle active" 
                            style={{ top: 8, right: 8, width: 24, height: 24 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDownloaded(episode.id);
                            }}
                            title="Unmark as downloaded"
                          >
                            <Check size={14} strokeWidth={3} />
                          </button>
                        ) : (
                          <button 
                            className="downloaded-toggle" 
                            style={{ top: 8, right: 8, width: 24, height: 24 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDownloaded(episode.id);
                            }}
                            title="Mark as downloaded"
                          >
                            <Check size={14} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                      
                      <div className="episode-info">
                        <h4 className="episode-title">
                          Episode {episode.episode_num}: {episode.title}
                        </h4>
                        <div className="episode-meta">
                          {episode.info?.duration && <span>Duration: {episode.info.duration} • </span>}
                          {episode.info?.rating && <span>Rating: {episode.info.rating}</span>}
                        </div>
                        {episode.info?.plot && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{episode.info.plot}</p>}
                      </div>
                      <div className="episode-actions" onClick={(e) => e.stopPropagation()}>
                        <a 
                          href={getSeriesDownloadUrl(episode.id, episode.container_extension, `${selectedSeries.name} - S${activeSeason}E${episode.episode_num} - ${episode.title}`)} 
                          className="btn btn-primary"
                          download
                          title="Download Episode"
                          onClick={() => {
                            if (!isDownloaded(episode.id)) toggleDownloaded(episode.id);
                          }}
                          style={{ padding: '0.5rem' }}
                        >
                          <Download size={18} />
                        </a>
                      </div>
                    </div>
                  ))}
                  
                  {activeSeason && (!seriesInfo.episodes[activeSeason] || seriesInfo.episodes[activeSeason].length === 0) && (
                    <p style={{ color: 'var(--text-secondary)' }}>No episodes found for this season.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Series</h2>
            {error && <div className="alert">{error}</div>}
            
            {loadingContent ? (
              <Loader />
            ) : (
              <div className="grid grid-large">
                {seriesList.map((series) => (
                  <MediaCard 
                    key={series.series_id} 
                    item={series} 
                    onClick={() => setSelectedSeries(series)}
                  />
                ))}
                {seriesList.length === 0 && !error && (
                  <p style={{ color: 'var(--text-secondary)' }}>No series found in this category.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {previewStream && (
        <VideoPlayerModal
          streamUrl={previewStream.url}
          title={previewStream.title}
          onClose={() => setPreviewStream(null)}
        />
      )}
    </div>
  );
};
