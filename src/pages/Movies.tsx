import React, { useEffect, useState } from 'react';
import { Download, CheckSquare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Category, Stream } from '../services/api';
import { getVodCategories, getVodStreams, getStreamUrl, downloadMedia } from '../services/api';
import { Loader } from '../components/Loader';
import { MediaCard } from '../components/MediaCard';
import { useDownloaded } from '../hooks/useDownloaded';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { DownloadLocationModal } from '../components/DownloadLocationModal';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../utils/toast';

export const Movies: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') || '';
  
  const setActiveCategory = (cat: string) => {
    setSearchParams(prev => {
      prev.set('category', cat);
      return prev;
    });
  };
  const [allStreams, setAllStreams] = useState<Stream[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authConfig } = useAuth();

  // New states for bulk download & selection
  const { isDownloaded, toggleDownloaded } = useDownloaded();
  const [previewStream, setPreviewStream] = useState<{url: string, title: string} | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  
  // States for download location modal
  const [downloadPrompt, setDownloadPrompt] = useState<{
    streamId?: number,
    extension?: string,
    title?: string,
    isBulk?: boolean
  } | null>(null);

  // Derived state for currently visible streams
  const streams = allStreams.filter(s => s.category_id === activeCategory);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch categories first to populate the sidebar quickly
        const cats = await getVodCategories();
        setCategories(cats);
        if (cats.length > 0 && !searchParams.get('category')) {
          setSearchParams(prev => {
            prev.set('category', cats[0].category_id);
            return prev;
          }, { replace: true });
        }
        setLoading(false);

        // Fetch all streams to cache them and compute counts
        setLoadingStreams(true);
        const str = await getVodStreams();
        
        // Compute category counts
        const counts: Record<string, number> = {};
        str.forEach(s => {
          counts[s.category_id] = (counts[s.category_id] || 0) + 1;
        });
        
        setCategoryCounts(counts);
        setAllStreams(str);
      } catch (err) {
        setError('Failed to load movie data');
      } finally {
        setLoading(false);
        setLoadingStreams(false);
      }
    };
    
    fetchData();
  }, []);

  // Reset selection when changing category
  useEffect(() => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  }, [activeCategory]);

  const toggleSelection = (streamId: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  };

  const handleDownloadConfirm = async (locationPath?: string) => {
    if (!downloadPrompt) return;

    if (downloadPrompt.isBulk) {
      const selectedStreams = streams.filter(s => selectedItems.has(s.stream_id));
      let count = 0;
      for (let i = 0; i < selectedStreams.length; i++) {
        const stream = selectedStreams[i];
        const success = await downloadMedia(stream.stream_id, stream.container_extension, stream.name, 'movie', locationPath, stream.name);
        if (success) count++;
        if (!isDownloaded(stream.stream_id)) toggleDownloaded(stream.stream_id);
      }
      setSelectionMode(false);
      setSelectedItems(new Set());
      if (count > 0) showToast(`Added ${count} movies to download queue!`);
    } else if (downloadPrompt.streamId && downloadPrompt.extension && downloadPrompt.title) {
      const success = await downloadMedia(downloadPrompt.streamId, downloadPrompt.extension, downloadPrompt.title, 'movie', locationPath, downloadPrompt.title);
      if (!isDownloaded(downloadPrompt.streamId)) toggleDownloaded(downloadPrompt.streamId);
      if (success) showToast('Added to download queue!');
    }
    
    setDownloadPrompt(null);
  };

  const handleBulkDownload = async () => {
    if (selectedItems.size === 0) return;

    if (authConfig?.hasServerDownload) {
      setDownloadPrompt({ isBulk: true });
    } else {
      await handleDownloadConfirm();
    }
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
              onClick={() => setActiveCategory(cat.category_id)}
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
        <div className="header-actions">
          <h2 style={{ margin: 0 }}>Movies</h2>
          
          {!loadingStreams && streams.length > 0 && (
            <div className="header-actions-right">
              {selectionMode ? (
                <>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {selectedItems.size} selected
                  </span>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedItems(new Set());
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleBulkDownload}
                    disabled={selectedItems.size === 0}
                  >
                    <Download size={18} />
                    Download Selected
                  </button>
                </>
              ) : (
                <button 
                  className="btn btn-secondary"
                  onClick={() => setSelectionMode(true)}
                >
                  <CheckSquare size={18} />
                  Select Multiple
                </button>
              )}
            </div>
          )}
        </div>

        {error && <div className="alert">{error}</div>}
        
        {loadingStreams ? (
          <Loader />
        ) : (
          <div className="grid grid-large">
            {streams.map((stream) => (
              <MediaCard 
                key={stream.stream_id} 
                item={stream} 
                onDownload={() => {
                  if (authConfig?.hasServerDownload) {
                    setDownloadPrompt({
                      streamId: stream.stream_id,
                      extension: stream.container_extension,
                      title: stream.name
                    });
                  } else {
                    downloadMedia(stream.stream_id, stream.container_extension, stream.name, 'movie');
                    if (!isDownloaded(stream.stream_id)) toggleDownloaded(stream.stream_id);
                  }
                }}
                isDownloaded={isDownloaded(stream.stream_id)}
                onToggleDownloaded={() => toggleDownloaded(stream.stream_id)}
                selectable={selectionMode}
                selected={selectedItems.has(stream.stream_id)}
                onSelect={() => toggleSelection(stream.stream_id)}
                onPreview={() => setPreviewStream({
                  url: getStreamUrl(stream.stream_id, stream.container_extension, 'movie'),
                  title: stream.name
                })}
              />
            ))}
            {streams.length === 0 && !error && (
              <p style={{ color: 'var(--text-secondary)' }}>No movies found in this category.</p>
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

      {downloadPrompt && (
        <DownloadLocationModal
          filename={downloadPrompt.title}
          bulkCount={downloadPrompt.isBulk ? selectedItems.size : undefined}
          onClose={() => setDownloadPrompt(null)}
          onConfirm={handleDownloadConfirm}
        />
      )}
    </div>
  );
};
