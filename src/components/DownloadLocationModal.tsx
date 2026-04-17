import React, { useEffect, useState, useRef } from 'react';
import { getSettings } from '../services/api';
import { DownloadCloud, X, ChevronDown, Folder, Check } from 'lucide-react';

interface Location {
  name: string;
  path: string;
}

interface DownloadLocationModalProps {
  onClose: () => void;
  onConfirm: (locationPath: string) => void;
  filename?: string;
  bulkCount?: number;
}

export const DownloadLocationModal: React.FC<DownloadLocationModalProps> = ({ onClose, onConfirm, filename, bulkCount }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const data = await getSettings();
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
          setSelectedPath(data.locations[0].path);
        } else {
          setError('No download locations defined in Settings.');
        }
      } catch (err) {
        setError('Failed to fetch locations.');
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConfirm = () => {
    if (selectedPath) {
      onConfirm(selectedPath);
    }
  };

  const selectedLocation = locations.find(l => l.path === selectedPath);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <DownloadCloud size={22} color="var(--primary-color)" />
          <h2>Add to Queue</h2>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>Loading locations...</p>
        ) : error ? (
          <div style={{ padding: '1rem 0' }}>
            <p style={{ color: '#ef4444', marginBottom: '0.75rem' }}>{error}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please go to Settings and add at least one Download Location.</p>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0.25rem 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {bulkCount 
                ? `Select destination for ${bulkCount} items:` 
                : `Select destination for "${filename}":`
              }
            </p>
            
            <div style={{ marginBottom: '1.75rem' }}>
              <label className="custom-dropdown-label">Destination Folder</label>
              <div className="custom-dropdown" ref={dropdownRef}>
                <button 
                  className={`custom-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  type="button"
                >
                  <div className="custom-dropdown-trigger-content">
                    <Folder size={16} className="custom-dropdown-icon" />
                    <div className="custom-dropdown-trigger-text">
                      <span className="custom-dropdown-name">{selectedLocation?.name || 'Select...'}</span>
                      <span className="custom-dropdown-path">{selectedLocation?.path || ''}</span>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`custom-dropdown-chevron ${dropdownOpen ? 'rotated' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="custom-dropdown-menu">
                    {locations.map((loc, i) => (
                      <button
                        key={i}
                        className={`custom-dropdown-item ${loc.path === selectedPath ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedPath(loc.path);
                          setDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <Folder size={15} className="custom-dropdown-icon" />
                        <div className="custom-dropdown-item-text">
                          <span className="custom-dropdown-name">{loc.name}</span>
                          <span className="custom-dropdown-path">{loc.path}</span>
                        </div>
                        {loc.path === selectedPath && <Check size={16} className="custom-dropdown-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                <DownloadCloud size={16} style={{ marginRight: '0.4rem' }} />
                Queue Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
