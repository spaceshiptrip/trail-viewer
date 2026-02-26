import { useState, useEffect } from 'react';
import { Download, Check, Loader2, MapPin, Trash2, HardDrive } from 'lucide-react';

/**
 * OfflineMapDownloader
 * 
 * Shows cache status, download button, and clear cache option.
 * Tracks which trails have been downloaded.
 */
export default function OfflineMapDownloader({ track }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(null);
  const [cacheSize, setCacheSize] = useState(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Check cache size and if this track is downloaded
  useEffect(() => {
    updateCacheInfo();
  }, [track]);

  const updateCacheInfo = async () => {
    try {
      // Get cache size
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage / 1024 / 1024).toFixed(1);
        const quotaMB = (estimate.quota / 1024 / 1024).toFixed(0);
        setCacheSize({ used: usedMB, quota: quotaMB });
      }

      // Check if this track is downloaded
      if (track) {
        const trackId = track.properties?.id || track.properties?.filename;
        const downloaded = localStorage.getItem(`offline-track-${trackId}`);
        setIsDownloaded(!!downloaded);
      }
    } catch (err) {
      console.error('Error checking cache:', err);
    }
  };

  const downloadTilesForTrack = async () => {
    if (!track) return;

    setDownloading(true);
    setProgress(0);
    setComplete(false);
    setError(null);

    try {
      // Get track bounds
      const coords = track.geometry.type === 'LineString'
        ? track.geometry.coordinates
        : track.geometry.coordinates[0];

      const lats = coords.map(c => c[1]);
      const lngs = coords.map(c => c[0]);
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };

      // Add padding (0.02 degrees ≈ 2km)
      const padding = 0.02;
      bounds.north += padding;
      bounds.south -= padding;
      bounds.east += padding;
      bounds.west -= padding;

      // Download tiles for zoom levels 10-15
      // **Zoom level reference**:
      // - **Level 10**: Regional view (shows 50+ mile area)
      // - **Level 12**: Area view (shows 10-20 mile area)
      // - **Level 14**: Trail view (shows 2-5 mile area)
      // - **Level 16**: Detail view (shows 0.5-1 mile area, ~2 feet per pixel)
      const zoomLevels = [13, 14, 15, 16, 17];
      const tileUrls = [];

      for (const zoom of zoomLevels) {
        const tiles = getTilesInBounds(bounds, zoom);
        tiles.forEach(({ x, y, z }) => {
          const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
          tileUrls.push(url);
        });
      }

      console.log(`📥 Downloading ${tileUrls.length} tiles for offline use...`);

      // Download tiles in batches
      const batchSize = 6;
      let completed = 0;

      for (let i = 0; i < tileUrls.length; i += batchSize) {
        const batch = tileUrls.slice(i, i + batchSize);

        await Promise.all(
          batch.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return response.blob();
                }
              })
              .catch(err => {
                console.warn('Tile fetch failed:', url, err);
              })
          )
        );

        completed += batch.length;
        setProgress(Math.round((completed / tileUrls.length) * 100));

        // Throttle to avoid rate limiting
        if (i + batchSize < tileUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Mark as downloaded
      const trackId = track.properties?.id || track.properties?.filename;
      localStorage.setItem(`offline-track-${trackId}`, new Date().toISOString());

      setComplete(true);
      setIsDownloaded(true);
      console.log('✅ Offline download complete!');

      // Update cache info
      await updateCacheInfo();

      // Auto-reset after 3 seconds
      setTimeout(() => {
        setDownloading(false);
        setComplete(false);
        setProgress(0);
      }, 3000);

    } catch (err) {
      console.error('Download failed:', err);
      setError(err.message || 'Download failed');
      setTimeout(() => {
        setDownloading(false);
        setError(null);
      }, 3000);
    }
  };

  const clearOfflineCache = async () => {
    if (!window.confirm('Clear all offline map tiles? You will need to re-download them for offline use.')) {
      return;
    }

    setClearing(true);

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );

      // Clear localStorage markers
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('offline-track-')) {
          localStorage.removeItem(key);
        }
      });

      console.log('✅ Offline cache cleared!');

      // Update UI
      setCacheSize({ used: 0, quota: cacheSize?.quota || 0 });
      setIsDownloaded(false);

      // Reload to reinstall service worker
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('Clear cache failed:', err);
      alert('Failed to clear cache. Check console for details.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">
            Offline Maps
          </h3>
        </div>

        {/* Cache size indicator */}
        {cacheSize && (
          <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <HardDrive className="w-3 h-3" />
            {cacheSize.used} MB
          </div>
        )}
      </div>

      {/* Download status */}
      {isDownloaded && !downloading && !complete && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-sm text-green-600">
          <Check className="w-4 h-4" />
          <span>This trail is available offline</span>
        </div>
      )}

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Download map tiles for this trail area to use without internet connection.
      </p>

      {/* Download button */}
      <button
        onClick={downloadTilesForTrack}
        disabled={downloading || !track}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        style={{
          backgroundColor: complete ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)',
          borderColor: complete ? '#22c55e' : error ? '#ef4444' : 'var(--border-color)',
          color: complete ? '#22c55e' : error ? '#ef4444' : 'var(--text-primary)',
        }}
      >
        {downloading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <div className="flex-1 text-left">
              <div className="font-semibold">Downloading...</div>
              <div className="text-xs opacity-75">{progress}% complete</div>
            </div>
          </>
        ) : complete ? (
          <>
            <Check className="w-5 h-5" />
            <span className="font-semibold">Download Complete!</span>
          </>
        ) : error ? (
          <>
            <span className="font-semibold">{error}</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span className="font-semibold">
              {isDownloaded ? 'Re-download for Offline' : 'Download for Offline'}
            </span>
          </>
        )}
      </button>

      {/* Clear cache button */}
      {cacheSize && parseFloat(cacheSize.used) > 0 && (
        <button
          onClick={clearOfflineCache}
          disabled={clearing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-400/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Clearing...</span>
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              <span>Clear All Offline Maps</span>
            </>
          )}
        </button>
      )}

      {/* Info */}
      {!downloading && !complete && !error && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-[var(--text-secondary)] italic">
            • Downloads ~50-200 MB
          </p>
          <p className="text-xs text-[var(--text-secondary)] italic">
            • Works in 2D mode only
          </p>
          {cacheSize && (
            <p className="text-xs text-[var(--text-secondary)] italic">
              • {cacheSize.used} MB / {cacheSize.quota} MB used
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions (unchanged)
function getTilesInBounds(bounds, zoom) {
  const tiles = [];
  const topLeft = latLngToTile(bounds.north, bounds.west, zoom);
  const bottomRight = latLngToTile(bounds.south, bounds.east, zoom);

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}
