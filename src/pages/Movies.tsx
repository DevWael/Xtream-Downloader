import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Download, CheckSquare, Search } from 'lucide-react';
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
  const activeCategory = searchParams.get('category') || 'all';
  
  const setActiveCategory = (cat: string) => {
    setSearchParams(prev => {
      prev.set('category', cat);
      return prev;
    });
  };
  const [streams, setStreams] = useState<Stream[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authConfig } = useAuth();
  const [categorySearch, setCategorySearch] = useState('');

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

  const [contentSearch, setContentSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(60);
  const LOAD_INCREMENT = 60;
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Sort newest first
  const sortedStreams = useMemo(() => 
    [...streams].sort((a, b) => Number(b.added || 0) - Number(a.added || 0))
  , [streams]);

  // Filtered categories for search
  const filteredCategories = useMemo(() => 
    categories.filter(cat => 
      cat.category_name.toLowerCase().includes(categorySearch.toLowerCase())
    ), [categories, categorySearch]
  );

  // Content search + infinite scroll
  const filteredStreams = useMemo(() => 
    contentSearch 
      ? sortedStreams.filter(s => s.name.toLowerCase().includes(contentSearch.toLowerCase()))
      : sortedStreams
  , [sortedStreams, contentSearch]);
  const visibleStreams = filteredStreams.slice(0, visibleCount);
  const hasMore = visibleCount < filteredStreams.length;

  // Infinite scroll — callback ref ensures observer connects when sentinel appears in DOM
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !hasMore) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + LOAD_INCREMENT);
        }
      },
      { rootMargin: '400px' }
    );
    observerRef.current.observe(node);
  }, [hasMore]);

  // Load categories on mount + background fetch all for counts
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const cats = await getVodCategories();
        setCategories(cats);
        setLoading(false);

        // Background: fetch all streams just for category counts
        const allStr = await getVodStreams();
        const counts: Record<string, number> = {};
        allStr.forEach(s => {
          counts[s.category_id] = (counts[s.category_id] || 0) + 1;
        });
        setCategoryCounts(counts);
        setTotalCount(allStr.length);
      } catch (err) {
        setError('Failed to load movie data');
        setLoading(false);
      }
    };
    init();
  }, []);

  // Load streams when active category changes
  useEffect(() => {
    const fetchCategoryStreams = async () => {
      try {
        setLoadingStreams(true);
        setError(null);
        const str = activeCategory === 'all' 
          ? await getVodStreams() 
          : await getVodStreams(activeCategory);
        setStreams(str);
      } catch (err) {
        setError('Failed to load streams');
      } finally {
        setLoadingStreams(false);
      }
    };
    if (!loading) fetchCategoryStreams();
  }, [activeCategory, loading]);

  // Reset selection, visible count, and scroll position when changing category
  useEffect(() => {
    setSelectedItems(new Set());
    setSelectionMode(false);
    setVisibleCount(60);
    window.scrollTo(0, 0);
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
        <h2>Categories</h2>
        <div className="category-search">
          <Search size={15} className="category-search-icon" />
          <input 
            type="text" 
            placeholder="Search categories..." 
            value={categorySearch}
            onChange={e => setCategorySearch(e.target.value)}
            className="category-search-input"
          />
        </div>
        <div className="category-list">
          <div
            className={`category-item ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <span>All</span>
            <span className="category-count">{totalCount}</span>
          </div>
          {filteredCategories.map((cat) => (
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
          <div className="content-search">
            <Search size={16} className="content-search-icon" />
            <input
              type="text"
              placeholder="Search movies..."
              value={contentSearch}
              onChange={e => { setContentSearch(e.target.value); setVisibleCount(60); }}
              className="content-search-input"
            />
          </div>
          
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
          <>
          <div className="grid grid-large">
            {visibleStreams.map((stream) => (
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
            {filteredStreams.length === 0 && !error && (
              <p style={{ color: 'var(--text-secondary)' }}>No movies found.</p>
            )}
          </div>

          <div ref={sentinelRef} className="scroll-sentinel" />
          {hasMore && <div className="scroll-loading"><Loader /></div>}
          {filteredStreams.length > 0 && (
            <div className="scroll-info">
              Showing {Math.min(visibleCount, filteredStreams.length)} of {filteredStreams.length}
            </div>
          )}
          </>
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
