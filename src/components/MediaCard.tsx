import { Download, Star, Check, CheckSquare, Play } from 'lucide-react';
import type { Stream, Series } from '../services/api';

interface MediaCardProps {
  item: Stream | Series;
  onDownload?: () => void;
  onClick?: () => void;
  
  // New features props
  isDownloaded?: boolean;
  onToggleDownloaded?: () => void;
  
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ 
  item, 
  onDownload, 
  onClick,
  isDownloaded,
  onToggleDownloaded,
  selectable,
  selected,
  onSelect,
  onPreview
}) => {
  const isMovie = 'stream_id' in item;
  
  const title = item.name;
  const image = isMovie ? (item as Stream).stream_icon : (item as Series).cover;
  const rating = isMovie ? (item as Stream).rating_5based : (item as Series).rating_5based;
  const meta = isMovie ? (item as Stream).added : (item as Series).releaseDate;

  // Handle fallback image — a prominent film icon on dark gradient
  const defaultImage = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="400" height="600" fill="url(#bg)"/><g transform="translate(110,180)" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="180" height="180" rx="16"/><polygon points="65,35 145,90 65,145" fill="#334155" stroke="#475569"/></g><text x="200" y="420" fill="#64748b" font-family="sans-serif" font-size="24" font-weight="600" text-anchor="middle">No Image</text></svg>`)}`;

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`media-card ${selected ? 'selected' : ''} ${isDownloaded && !selectable ? 'downloaded' : ''}`} 
      onClick={handleClick} 
      style={{ cursor: (onClick || selectable) ? 'pointer' : 'default' }}
    >
      {/* Interactive Downloaded Toggle / Badge */}
      {!selectable && onToggleDownloaded && (
        <button
          className={`downloaded-toggle ${isDownloaded ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDownloaded();
          }}
          title={isDownloaded ? "Unmark as downloaded" : "Mark as downloaded"}
        >
          <Check size={16} strokeWidth={isDownloaded ? 3 : 2} />
        </button>
      )}

      {/* Selection Checkbox Overlay */}
      {selectable && (
        <div className="checkbox-overlay">
          {selected && <CheckSquare size={16} color="white" />}
        </div>
      )}

      <div className="media-image-wrapper">
        <img 
          src={image || defaultImage} 
          alt={title} 
          className="media-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultImage;
          }}
        />
        {onPreview && !selectable && (
          <div className="media-image-overlay">
            <button 
              className="play-button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              title="Preview Video"
            >
              <Play size={24} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
      <div className="media-content">
        <h3 className="media-title">{title}</h3>
        <div className="media-meta">
          {rating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
              <Star size={14} fill="#fbbf24" />
              {rating.toFixed(1)}
            </span>
          ) : (
            <span>N/A</span>
          )}
          {meta && <span>{new Date(isMovie ? parseInt(meta as string) * 1000 : meta as string).getFullYear() || ''}</span>}
        </div>
        
        {onDownload && !selectable && (
          <button 
            className="btn btn-primary btn-block" 
            style={{ marginTop: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
              if (onToggleDownloaded && !isDownloaded) {
                onToggleDownloaded();
              }
            }}
            title="Download Media"
          >
            <Download size={18} />
            Download
          </button>
        )}
      </div>
    </div>
  );
};
