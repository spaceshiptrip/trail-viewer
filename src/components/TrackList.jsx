import { useState } from "react";
import {
  Search,
  Mountain,
  TrendingUp,
  Download,
  Loader2,
  X,
  FileDown,
  Check,
  CloudOff,
} from "lucide-react";


import BUILD_INFO from "../build-info";

function gpxUrlForTrack(track) {
  const gpxFile = track?.properties?.gpxFile || "";
  return `${import.meta.env.BASE_URL}tracks/gpx/${encodeURIComponent(gpxFile)}`;
}

export default function TrackList({
  tracks,
  selectedTrack,
  onTrackSelect,
  themeToggle,
  loadingTrack,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadModal, setDownloadModal] = useState(null); // { track, downloading, success, error }

  const filteredTracks = tracks.filter((track) => {
    const name = track.properties.name?.toLowerCase() || "";
    const location = track.properties.location?.toLowerCase() || "";
    const description = track.properties.description?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();

    return (
      name.includes(search) ||
      location.includes(search) ||
      description.includes(search)
    );
  });

  const handleDownloadClick = (e, track) => {
    e.stopPropagation();
    if (!track?.properties?.gpxFile) return;
    setDownloadModal({
      track,
      downloading: false,
      success: false,
      error: null,
    });
  };

  const handleConfirmDownload = async () => {
    const track = downloadModal?.track;
    if (!track) return;

    const gpxFile = track?.properties?.gpxFile;
    if (!gpxFile) {
      console.warn("Missing gpxFile for track:", track);
      return;
    }

    setDownloadModal((prev) => ({
      ...prev,
      downloading: true,
      success: false,
      error: null,
    }));

    try {
      const url = gpxUrlForTrack(track);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch GPX (${response.status}) from ${url}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error(`Got HTML instead of GPX from ${url}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = gpxFile;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      setDownloadModal((prev) => ({
        ...prev,
        downloading: false,
        success: true,
      }));

      setTimeout(() => setDownloadModal(null), 1500);
    } catch (error) {
      console.error("Download failed:", error);
      setDownloadModal((prev) => ({
        ...prev,
        downloading: false,
        success: false,
        error: error.message || "Download failed. Please try again.",
      }));

      setTimeout(() => setDownloadModal(null), 3000);
    }
  };

  const isTrackDownloaded = (track) => {
    const trackId = track?.properties?.id || track?.properties?.filename;
    return !!localStorage.getItem(`offline-track-${trackId}`);
  };

  const handleCloseModal = () => {
    if (!downloadModal?.downloading) {
      setDownloadModal(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-display font-bold text-[var(--accent-primary)]">
            Trail Explorer
          </h1>
          {themeToggle}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[var(--text-secondary)] text-sm">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"} loaded
          </p>
          <p className="text-[var(--text-secondary)] text-xs font-mono">
            Build: {BUILD_INFO?.build || "dev"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search trails, locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] 
                     rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)]
                     focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>
      </div>

      {/* Loading Indicator */}
      {loadingTrack && (
        <div className="px-4 py-2 bg-[var(--accent-primary)] bg-opacity-10 border-b border-[var(--accent-primary)] border-opacity-30">
          <div className="flex items-center gap-2 text-[var(--accent-primary)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading track details...</span>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTracks.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            {tracks.length === 0 ? (
              <>
                <Mountain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-2">No tracks loaded</p>
                <p className="text-sm">Add tracks to manifest.json</p>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-2">No tracks found</p>
                <p className="text-sm">Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          filteredTracks.map((track, idx) => (
            <div
              key={track.properties.id}
              onClick={() => onTrackSelect(track)}
              className={`trail-card fade-in-up ${selectedTrack?.properties.id === track.properties.id
                ? "border-[var(--accent-primary)] bg-[var(--bg-tertiary)]"
                : ""
                }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex items-start justify-between gap-3">

                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-display font-semibold text-lg text-[var(--text-primary)]">
                    {track.properties.name || `Track ${idx + 1}`}
                  </h3>
                  {isTrackDownloaded(track) && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/30"
                      title="Available offline"
                    >
                      <CloudOff className="w-3 h-3" />
                      <span>Offline</span>
                    </div>
                  )}
                </div>
              </div>

              {track.properties.location && (
                <p className="text-[var(--text-secondary)] text-sm mb-3">
                  {track.properties.location}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                {/* left side stats */}
                <div className="flex gap-4">
                  {track.properties.distance !== undefined && (
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                      <Mountain className="w-4 h-4" />
                      <span className="font-mono font-medium">
                        {track.properties.distance?.toFixed(2) || "0"} mi
                      </span>
                    </div>
                  )}

                  {track.properties.elevationGain > 0 && (
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-mono font-medium">
                        {track.properties.elevationGain?.toFixed(0)} ft
                      </span>
                    </div>
                  )}
                </div>

                {/* right side download icon */}
                <button
                  onClick={(e) => handleDownloadClick(e, track)}
                  title="Download GPX"
                  aria-label="Download GPX"
                  disabled={!track?.properties?.gpxFile}
                  aria-disabled={!track?.properties?.gpxFile}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {track.properties.description && (
                <p className="text-[var(--text-secondary)] text-sm mt-3 line-clamp-2">
                  {track.properties.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Download Modal */}
      {downloadModal && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-6 max-w-md w-[90%] mx-4 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Error State */}
            {downloadModal.error ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-[var(--text-primary)] mb-2">
                  Download Failed
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  {downloadModal.error}
                </p>
              </div>
            ) : downloadModal.success ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-[var(--text-primary)] mb-2">
                  Download Started!
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Check your downloads folder
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                      <FileDown className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-[var(--text-primary)]">
                        Download GPX
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {downloadModal.track?.properties?.gpxFile ||
                          "trail.gpx"}
                      </p>
                    </div>
                  </div>
                  {!downloadModal.downloading && (
                    <button
                      onClick={handleCloseModal}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Trail Info */}
                <div className="mb-6 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                  <h4 className="font-display font-semibold text-[var(--text-primary)] mb-2">
                    {downloadModal.track?.properties?.name}
                  </h4>
                  {downloadModal.track?.properties?.location && (
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                      📍 {downloadModal.track.properties.location}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm">
                    {downloadModal.track?.properties?.distance && (
                      <span className="text-[var(--text-secondary)]">
                        <Mountain className="w-3 h-3 inline mr-1" />
                        {downloadModal.track.properties.distance.toFixed(2)} mi
                      </span>
                    )}
                    {downloadModal.track?.properties?.elevationGain > 0 && (
                      <span className="text-[var(--text-secondary)]">
                        <TrendingUp className="w-3 h-3 inline mr-1" />
                        {downloadModal.track.properties.elevationGain.toFixed(
                          0,
                        )}{" "}
                        ft
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseModal}
                    disabled={downloadModal.downloading}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDownload}
                    disabled={
                      downloadModal.downloading ||
                      !downloadModal.track?.properties?.gpxFile
                    }
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {downloadModal.downloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
