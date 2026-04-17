import React, { useEffect, useState } from 'react';
import { getQueue, removeQueueItem, clearCompletedQueue, pauseQueueItem, resumeQueueItem } from '../services/api';
import { DownloadCloud, Trash2, XCircle, CheckCircle, Clock, Loader2, Pause, Play, HardDrive, Activity, FileVideo } from 'lucide-react';

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
    const interval = setInterval(fetchQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRemove = async (id: string) => {
    try {
      await removeQueueItem(id);
      fetchQueue();
    } catch (err) {
      console.error('Failed to remove item', err);
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

  if (loading && queue.length === 0) {
    return (
      <div className="downloads-page">
        <div className="downloads-loading">
          <Loader2 size={32} className="dl-spin" />
          <span>Loading downloads...</span>
        </div>
      </div>
    );
  }

  const activeDownloads = queue.filter(q => q.status === 'downloading' || q.status === 'queued' || q.status === 'paused');
  const pastDownloads = queue.filter(q => q.status === 'completed' || q.status === 'failed');

  const totalDownloaded = pastDownloads.filter(q => q.status === 'completed').length;
  const totalFailed = pastDownloads.filter(q => q.status === 'failed').length;

  return (
    <div className="downloads-page">
      <style dangerouslySetInnerHTML={{__html: `
        .downloads-page {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }

        .downloads-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 4rem;
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .downloads-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .downloads-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .downloads-header-left h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          background: linear-gradient(135deg, #f8fafc, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .downloads-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.2), rgba(var(--primary-rgb), 0.1));
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dl-stats {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .dl-stat-card {
          flex: 1;
          background: rgba(var(--surface-rgb), 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .dl-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dl-stat-icon.active {
          background: rgba(var(--primary-rgb), 0.15);
          color: var(--primary-color);
        }

        .dl-stat-icon.done {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .dl-stat-icon.fail {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .dl-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .dl-stat-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.2rem;
        }

        .dl-section-title {
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .dl-section-title .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .dl-section-title .dot.green { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
        .dl-section-title .dot.blue { background: var(--primary-color); box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.5); animation: dl-pulse 2s ease-in-out infinite; }

        @keyframes dl-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .dl-item {
          background: rgba(var(--surface-rgb), 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-bottom: 0.75rem;
          transition: all 0.2s ease;
        }

        .dl-item:hover {
          background: rgba(var(--surface-rgb), 0.6);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .dl-item-top {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .dl-item-status {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dl-item-status.downloading {
          background: rgba(var(--primary-rgb), 0.15);
        }
        .dl-item-status.queued {
          background: rgba(245, 158, 11, 0.15);
        }
        .dl-item-status.paused {
          background: rgba(245, 158, 11, 0.15);
        }
        .dl-item-status.completed {
          background: rgba(16, 185, 129, 0.15);
        }
        .dl-item-status.failed {
          background: rgba(239, 68, 68, 0.15);
        }

        .dl-item-info {
          flex: 1;
          min-width: 0;
        }

        .dl-item-name {
          font-weight: 600;
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 0.2rem;
        }

        .dl-item-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }

        .dl-item-meta .dl-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          font-size: 0.75rem;
        }

        .dl-item-meta .dl-tag.size {
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-light);
        }

        .dl-item-meta .dl-tag.error {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
        }

        .dl-item-meta .dl-path {
          opacity: 0.6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 350px;
        }

        .dl-item-progress {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .dl-progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          overflow: hidden;
        }

        .dl-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .dl-progress-pct {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary-light);
          min-width: 40px;
          text-align: right;
        }

        .dl-item-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .dl-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .dl-action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        .dl-action-btn.resume:hover {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .dl-action-btn.danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .dl-empty {
          padding: 4rem 2rem;
          text-align: center;
          background: rgba(var(--surface-rgb), 0.3);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 16px;
        }

        .dl-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: rgba(var(--primary-rgb), 0.1);
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dl-empty h3 {
          margin-bottom: 0.5rem;
          font-size: 1.2rem;
        }

        .dl-empty p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .dl-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dl-clear-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        @keyframes dl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .dl-spin {
          animation: dl-spin 1.5s linear infinite;
        }

        .dl-section {
          margin-bottom: 2.5rem;
        }

        .dl-item.completed-item {
          opacity: 0.7;
        }
        .dl-item.completed-item:hover {
          opacity: 0.9;
        }
      `}} />

      {/* Header */}
      <div className="downloads-header">
        <div className="downloads-header-left">
          <div className="downloads-icon-wrap">
            <DownloadCloud size={24} color="var(--primary-color)" />
          </div>
          <h1>Downloads</h1>
        </div>
        {pastDownloads.length > 0 && (
          <button className="dl-clear-btn" onClick={handleClearCompleted}>
            <Trash2 size={14} />
            Clear History
          </button>
        )}
      </div>

      {/* Stats */}
      {queue.length > 0 && (
        <div className="dl-stats">
          <div className="dl-stat-card">
            <div className="dl-stat-icon active">
              <Activity size={20} />
            </div>
            <div>
              <div className="dl-stat-value">{activeDownloads.length}</div>
              <div className="dl-stat-label">Active</div>
            </div>
          </div>
          <div className="dl-stat-card">
            <div className="dl-stat-icon done">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="dl-stat-value">{totalDownloaded}</div>
              <div className="dl-stat-label">Completed</div>
            </div>
          </div>
          <div className="dl-stat-card">
            <div className="dl-stat-icon fail">
              <XCircle size={20} />
            </div>
            <div>
              <div className="dl-stat-value">{totalFailed}</div>
              <div className="dl-stat-label">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {queue.length === 0 ? (
        <div className="dl-empty">
          <div className="dl-empty-icon">
            <DownloadCloud size={32} color="var(--primary-color)" />
          </div>
          <h3>No downloads yet</h3>
          <p>Browse Movies or Series to start downloading content.</p>
        </div>
      ) : (
        <>
          {/* Active Downloads */}
          {activeDownloads.length > 0 && (
            <div className="dl-section">
              <div className="dl-section-title">
                <span className="dot blue"></span>
                Active Downloads ({activeDownloads.length})
              </div>
              {activeDownloads.map(item => (
                <div key={item.id} className="dl-item">
                  <div className="dl-item-top">
                    <div className={`dl-item-status ${item.status}`}>
                      {item.status === 'downloading' && <Loader2 size={18} color="var(--primary-color)" className="dl-spin" />}
                      {item.status === 'queued' && <Clock size={18} color="#f59e0b" />}
                      {item.status === 'paused' && <Pause size={18} color="#f59e0b" />}
                    </div>
                    <div className="dl-item-info">
                      <div className="dl-item-name" title={item.filename}>
                        {item.filename}
                      </div>
                      <div className="dl-item-meta">
                        {(item.downloadedBytes || item.totalBytes) ? (
                          <span className="dl-tag size">
                            <HardDrive size={12} />
                            {item.downloadedBytes ? formatBytes(item.downloadedBytes) : '0 B'}
                            {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ''}
                          </span>
                        ) : null}
                        <span className="dl-path">{item.location}</span>
                      </div>
                    </div>
                    <div className="dl-item-actions">
                      {(item.status === 'downloading' || item.status === 'queued') && (
                        <button className="dl-action-btn" onClick={() => handlePause(item.id)} title="Pause">
                          <Pause size={16} />
                        </button>
                      )}
                      {item.status === 'paused' && (
                        <button className="dl-action-btn resume" onClick={() => handleResume(item.id)} title="Resume">
                          <Play size={16} />
                        </button>
                      )}
                      <button className="dl-action-btn danger" onClick={() => handleRemove(item.id)} title="Cancel">
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                  {item.status === 'downloading' && (
                    <div className="dl-item-progress">
                      <div className="dl-progress-bar">
                        <div className="dl-progress-fill" style={{ width: `${item.progress}%` }}></div>
                      </div>
                      <span className="dl-progress-pct">{item.progress}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed / Failed */}
          {pastDownloads.length > 0 && (
            <div className="dl-section">
              <div className="dl-section-title">
                <span className="dot green"></span>
                History ({pastDownloads.length})
              </div>
              {pastDownloads.map(item => (
                <div key={item.id} className={`dl-item ${item.status === 'completed' ? 'completed-item' : ''}`}>
                  <div className="dl-item-top">
                    <div className={`dl-item-status ${item.status}`}>
                      {item.status === 'completed' && <CheckCircle size={18} color="#10b981" />}
                      {item.status === 'failed' && <XCircle size={18} color="#ef4444" />}
                    </div>
                    <div className="dl-item-info">
                      <div className="dl-item-name" title={item.filename}>
                        {item.filename}
                      </div>
                      <div className="dl-item-meta">
                        {item.totalBytes && item.totalBytes > 0 && (
                          <span className="dl-tag size">
                            <FileVideo size={12} />
                            {formatBytes(item.totalBytes)}
                          </span>
                        )}
                        {item.error && (
                          <span className="dl-tag error">{item.error}</span>
                        )}
                        <span className="dl-path">{item.location}</span>
                      </div>
                    </div>
                    <div className="dl-item-actions">
                      <button className="dl-action-btn danger" onClick={() => handleRemove(item.id)} title="Remove">
                        <XCircle size={16} />
                      </button>
                    </div>
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
