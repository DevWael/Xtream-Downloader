import { Download, Star, Check, CheckSquare, Play } from 'lucide-react';
import type { Stream, Series } from '../services/api';

interface MediaCardProps {
  item: Stream | Series;
  downloadUrl?: string;
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
  downloadUrl, 
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

  // Handle fallback image
  const defaultImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiIC8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM3NzciIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';

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
        
        {downloadUrl && !selectable && (
          <a 
            href={downloadUrl} 
            className="btn btn-primary btn-block" 
            style={{ marginTop: 'auto' }}
            download
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleDownloaded && !isDownloaded) {
                onToggleDownloaded();
              }
            }}
            title="Download Media"
          >
            <Download size={18} />
            Download
          </a>
        )}
      </div>
    </div>
  );
};
