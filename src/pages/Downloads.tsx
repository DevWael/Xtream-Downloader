import React, { useEffect, useState } from 'react';
import { getQueue, removeQueueItem, clearCompletedQueue, pauseQueueItem, resumeQueueItem } from '../services/api';
import { DownloadCloud, Trash2, XCircle, CheckCircle, Clock, Loader2, Pause, Play } from 'lucide-react';

interface QueueItem {
  id: string;
  url: string;
  filename: string;
  location: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
  addedAt: string;
  error?: string;
  totalBytes?: number;
  downloadedBytes?: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
};

export const Downloads: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const data = await getQueue();
      setQueue(data);
    } catch (err) {
      console.error('Failed to fetch queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRemove = async (id: string) => {
    try {
      await removeQueueItem(id);
      fetchQueue();
    } catch (err) {
      console.error('Failed to remove item', err);
      alert('Failed to remove item');
    }
  };

  const handleClearCompleted = async () => {
    try {
      await clearCompletedQueue();
      fetchQueue();
    } catch (err) {
      console.error('Failed to clear completed', err);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseQueueItem(id);
      fetchQueue();
    } catch (err) {
      console.error('Failed to pause', err);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeQueueItem(id);
      fetchQueue();
    } catch (err) {
      console.error('Failed to resume', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={20} color="#10b981" />;
      case 'failed': return <XCircle size={20} color="#ef4444" />;
      case 'downloading': return <Loader2 size={20} color="#3b82f6" className="spin" />;
      case 'paused': return <Pause size={20} color="#f59e0b" />;
      case 'queued': return <Clock size={20} color="#f59e0b" />;
      default: return <Clock size={20} color="var(--text-secondary)" />;
    }
  };

  if (loading && queue.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>Loading downloads...</div>;
  }

  const activeDownloads = queue.filter(q => q.status === 'downloading' || q.status === 'queued' || q.status === 'paused');
  const pastDownloads = queue.filter(q => q.status === 'completed' || q.status === 'failed');

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DownloadCloud size={28} color="var(--primary)" />
          <h1 style={{ margin: 0 }}>Downloads</h1>
        </div>
        
        {pastDownloads.length > 0 && (
          <button className="btn btn-secondary" onClick={handleClearCompleted}>
            <Trash2 size={16} />
            Clear Completed
          </button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .queue-item {
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: 1rem 1.5rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .queue-info {
          flex: 1;
          min-width: 0;
        }
        .queue-title {
          font-weight: 600;
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .queue-meta {
          font-size: 0.85rem;
          color: var(--text-secondary);
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .progress-bar-bg {
          height: 6px;
          background: var(--bg-secondary);
          border-radius: 3px;
          margin-top: 0.75rem;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--primary);
          transition: width 0.3s ease;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 2s linear infinite;
        }
        .queue-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        .queue-actions button {
          background: transparent;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          transition: color 0.2s, background 0.2s;
        }
        .queue-actions button:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }
      `}} />

      {queue.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
          <DownloadCloud size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No downloads in queue</h3>
          <p>Go to Movies or Series to add items to your download queue.</p>
        </div>
      ) : (
        <>
          {activeDownloads.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Active ({activeDownloads.length})</h3>
              {activeDownloads.map(item => (
                <div key={item.id} className="queue-item">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="queue-info">
                    <div className="queue-title" title={item.filename}>{item.filename}</div>
                    <div className="queue-meta">
                      <span>
                        {item.status === 'paused' ? 'Paused' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                      {item.status === 'downloading' && item.downloadedBytes != null && (
                        <span>
                          {formatBytes(item.downloadedBytes)}
                          {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ''}
                        </span>
                      )}
                      <span style={{ opacity: 0.7 }}>Target: {item.location}</span>
                    </div>
                    {item.status === 'downloading' && (
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${item.progress}%` }}></div>
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: '50px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.9rem' }}>
                    {item.status === 'downloading' ? `${item.progress}%` : ''}
                  </div>
                  <div className="queue-actions">
                    {(item.status === 'downloading' || item.status === 'queued') && (
                      <button onClick={() => handlePause(item.id)} title="Pause Download">
                        <Pause size={18} />
                      </button>
                    )}
                    {item.status === 'paused' && (
                      <button onClick={() => handleResume(item.id)} title="Resume Download" style={{ color: '#10b981' }}>
                        <Play size={18} />
                      </button>
                    )}
                    <button onClick={() => handleRemove(item.id)} title="Cancel Download">
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastDownloads.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Completed & Failed ({pastDownloads.length})</h3>
              {pastDownloads.map(item => (
                <div key={item.id} className="queue-item" style={{ opacity: item.status === 'completed' ? 0.8 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="queue-info">
                    <div className="queue-title" title={item.filename} style={{ textDecoration: item.status === 'completed' ? 'line-through' : 'none' }}>
                      {item.filename}
                    </div>
                    <div className="queue-meta">
                      <span>Target: {item.location}</span>
                      {item.totalBytes && item.totalBytes > 0 && (
                        <span>{formatBytes(item.totalBytes)}</span>
                      )}
                      {item.error && <span style={{ color: '#ef4444' }}>Error: {item.error}</span>}
                    </div>
                  </div>
                  <div className="queue-actions">
                    <button onClick={() => handleRemove(item.id)} title="Remove from history">
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
