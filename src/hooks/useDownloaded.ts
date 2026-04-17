import { useState, useEffect } from 'react';

export function useDownloaded() {
  const [downloadedItems, setDownloadedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('xtream-downloaded-items');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('xtream-downloaded-items', JSON.stringify(Array.from(downloadedItems)));
  }, [downloadedItems]);

  const toggleDownloaded = (id: string | number) => {
    const stringId = String(id);
    setDownloadedItems(prev => {
      const next = new Set(prev);
      if (next.has(stringId)) {
        next.delete(stringId);
      } else {
        next.add(stringId);
      }
      return next;
    });
  };

  const isDownloaded = (id: string | number) => {
    return downloadedItems.has(String(id));
  };

  return {
    downloadedItems,
    toggleDownloaded,
    isDownloaded
  };
}
