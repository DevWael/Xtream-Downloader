import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
  streamUrl: string;
  title: string;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ streamUrl, title, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '90%', maxWidth: '1000px', padding: 0, overflow: 'hidden', background: '#000' }}
      >
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.8)' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        <video 
          ref={videoRef}
          src={streamUrl} 
          controls 
          autoPlay 
          style={{ width: '100%', display: 'block', maxHeight: '75vh', outline: 'none' }} 
        />
      </div>
    </div>
  );
};
