import { useState, useEffect } from "react";
import Map from "./components/Map";
import TrackList from "./components/TrackList";
import Sidebar from "./components/Sidebar";
import ThemeToggle from "./components/ThemeToggle";
import { calculateDistance, calculateElevationGain } from "./utils";
import CesiumView from "./components/CesiumView";
import useGeolocation from "./hooks/useGeolocation";
import GpsButton from "./components/GpsButton";

// Max number of tracks in browser memory
const MAX_CACHED_TRACKS = 4;

function App() {
  // All state hooks MUST be at the top, in the same order, every render
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMileMarkers, setShowMileMarkers] = useState(true);
  const [showStartFinish, setShowStartFinish] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [graphHoverIndex, setGraphHoverIndex] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTrackListCollapsed, setIsTrackListCollapsed] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );
  const [trackCache, setTrackCache] = useState({}); // Use plain object instead of Map
  const [trackCacheOrder, setTrackCacheOrder] = useState([]); // array of filenames, most-recent at end

  const [leafletRemountTick, setLeafletRemountTick] = useState(0);

  // ✅ NEW: hybrid map mode toggle (Leaflet 2D vs Cesium 2.5D)
  const [mapMode, setMapMode] = useState(
    () => localStorage.getItem("mapMode") || "2d",
  ); // "2d" | "3d"

  const {
    status: gpsStatus,
    position: gpsPosition,
    error: gpsError,
    startWatching,
    stopWatching,
  } = useGeolocation();

  const [followMe, setFollowMe] = useState(false);

  // ✅ NEW: peaks data for 3D view
  const [peaks, setPeaks] = useState([]);

  // ✅ NEW: Peak display settings
  const [showPeaks, setShowPeaks] = useState(
    () => localStorage.getItem("showPeaks") !== "false",
  );
  const [showPeakLabels, setShowPeakLabels] = useState(
    () => localStorage.getItem("showPeakLabels") !== "false",
  );
  const [peakRadius, setPeakRadius] = useState(
    () => Number(localStorage.getItem("peakRadius")) || 10,
  ); // miles
  const [showSettings, setShowSettings] = useState(false);

  // ✅ Ensure Leaflet always receives the selectedTrack in its "tracks" list
  const leafletTracks = (() => {
    const arr = Object.values(trackCache || {});
    const selFile = selectedTrack?.properties?.filename;

    if (selectedTrack && selFile) {
      const already = arr.some((t) => t?.properties?.filename === selFile);
      if (!already) arr.push(selectedTrack);
    }

    return arr;
  })();

  // ✅ Force Leaflet to remount when switching back to 2D or when track changes
  // const leafletKey = `leaflet-${mapMode}-${selectedTrack?.properties?.filename || "none"}-${isSidebarCollapsed ? "R0" : "R1"}-${isTrackListCollapsed ? "L0" : "L1"}`;
  // const leafletKey = `leaflet-${mapMode}-${selectedTrack?.properties?.filename || "none"}-${selectedTrack ? "z2" : "z0"}`;
  //const leafletKey = `leaflet-${mapMode}-${selectedTrack?.properties?.filename || "none"}-${leafletRemountTick}`;
  // const leafletKey = `leaflet-${mapMode}-${selectedTrack?.properties?.filename || "none"}`;

  const leafletKey = `leaflet-${mapMode}-${selectedTrack?.properties?.filename || "none"}-${isSidebarCollapsed}`;

  useEffect(() => {
    if (mapMode !== "2d") return;
    if (!selectedTrack) return;

    const t = setTimeout(() => {
      setLeafletRemountTick((x) => x + 1);
    }, 350); // matches your panel animation time

    return () => clearTimeout(t);
  }, [
    mapMode,
    selectedTrack?.properties?.filename,
    isSidebarCollapsed,
    isTrackListCollapsed,
  ]);

  // All useEffect hooks after useState hooks
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ✅ NEW: persist mapMode
  useEffect(() => {
    localStorage.setItem("mapMode", mapMode);
  }, [mapMode]);

  useEffect(() => {
    loadManifest();
  }, []);

  useEffect(() => {
    // Force 2D default if old localStorage has 3d
    const saved = localStorage.getItem("mapMode");
    if (!saved || saved === "3d") {
      localStorage.setItem("mapMode", "2d");
      setMapMode("2d");
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NEW: Load peaks data on mount
  useEffect(() => {
    const loadPeaks = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}peaks/peaks.json`,
        );
        if (!response.ok) {
          console.warn("Failed to load peaks.json");
          return;
        }
        const data = await response.json();
        setPeaks(data);
      } catch (error) {
        console.error("Error loading peaks:", error);
      }
    };

    loadPeaks();
  }, []);

  useEffect(() => {
    localStorage.setItem("showPeaks", showPeaks);
  }, [showPeaks]);

  useEffect(() => {
    localStorage.setItem("showPeakLabels", showPeakLabels);
  }, [showPeakLabels]);

  useEffect(() => {
    localStorage.setItem("peakRadius", peakRadius);
  }, [peakRadius]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const loadManifest = async () => {
    try {
      const url = `${import.meta.env.BASE_URL}tracks/manifest.json`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to load manifest (${response.status})`);
      const manifest = await response.json();

      const trackStubs = manifest.tracks.map((track) => ({
        properties: {
          id: track.file,
          name: track.name,
          location: track.location,
          description: track.description,
          distance: track.distance,
          elevationGain: track.elevationGain,
          filename: track.file,
          file: track.file, // "MammothLakes4.geojson"
          gpxFile: track.file.replace(/\.geojson$/i, ".gpx"), // "MammothLakes4.gpx"
        },
        isStub: true,
      }));

      setTracks(trackStubs);
      setLoading(false);
    } catch (error) {
      console.error("Error loading manifest:", error);
      loadTracksLegacy();
    }
  };

  const loadTracksLegacy = async () => {
    try {
      const trackFiles = [
        "Beaudry2VerdugoPeak_11.geojson",
        "Sunshine2VerdugoPeak_12.geojson",
        "Palm2Lukens_14.geojson",
        "Mount_Wilson_via_Sierra_Madre_Jones_Peak_and_Bailey_Canyon_Loop.geojson",
      ];

      const loadedTracks = await Promise.all(
        trackFiles.map(async (filename) => {
          const url = `${import.meta.env.BASE_URL}tracks/${filename}`;
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(`Failed to load ${url} (${response.status})`);
          const data = await response.json();
          return processTrack(data, filename);
        }),
      );

      setTracks(loadedTracks.filter(Boolean));
      setLoading(false);
    } catch (error) {
      console.error("Error loading tracks:", error);
      setLoading(false);
    }
  };

  const loadTrackGeoJSON = async (trackStub) => {
    const filename = trackStub.properties.filename;

    // If cached, mark as most-recent and return
    if (trackCache[filename]) {
      setTrackCacheOrder((prev) => {
        const next = prev.filter((f) => f !== filename);
        next.push(filename);
        return next;
      });
      return trackCache[filename];
    }

    setLoadingTrack(true);
    try {
      const url = `${import.meta.env.BASE_URL}tracks/${filename}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to load ${url} (${response.status})`);
      const data = await response.json();

      const processedTrack = processTrack(data, filename, trackStub.properties);
      if (!processedTrack) return null;

      // Add to cache + enforce max size (LRU eviction)
      setTrackCache((prevCache) => {
        const nextCache = { ...prevCache, [filename]: processedTrack };
        return nextCache;
      });

      setTrackCacheOrder((prevOrder) => {
        const nextOrder = prevOrder.filter((f) => f !== filename);
        nextOrder.push(filename);

        // Evict least-recently used while over limit
        while (nextOrder.length > MAX_CACHED_TRACKS) {
          const evict = nextOrder.shift(); // oldest
          setTrackCache((prevCache) => {
            const { [evict]: _drop, ...rest } = prevCache;
            return rest;
          });
        }

        return nextOrder;
      });

      return processedTrack;
    } catch (error) {
      console.error("Error loading track GeoJSON:", filename, error);
      return null;
    } finally {
      setLoadingTrack(false);
    }
  };

  const processTrack = (geojson, filename, existingProps = null) => {
    try {
      let feature;
      if (geojson.type === "FeatureCollection" && geojson.features.length > 0) {
        feature = geojson.features[0];
      } else if (geojson.type === "Feature") {
        feature = geojson;
      } else {
        return null;
      }

      let coords;
      if (feature.geometry.type === "LineString") {
        coords = feature.geometry.coordinates;
      } else if (feature.geometry.type === "MultiLineString") {
        coords = feature.geometry.coordinates[0];
      } else {
        return null;
      }

      const distance = existingProps?.distance ?? calculateDistance(coords);
      const elevationGain =
        existingProps?.elevationGain ?? calculateElevationGain(coords);

      feature.properties = {
        ...feature.properties,
        ...existingProps,
        id: existingProps?.id || feature.properties?.id || filename,
        name:
          existingProps?.name ||
          feature.properties?.name ||
          filename.replace(".geojson", ""),
        filename: filename,
        distance,
        elevationGain,
      };

      return feature;
    } catch (error) {
      console.error("Error processing track:", filename, error);
      return null;
    }
  };

  const handleTrackSelect = async (track) => {
    setIsMenuOpen(false);

    if (track.isStub) {
      const fullTrack = await loadTrackGeoJSON(track);
      if (fullTrack) {
        setSelectedTrack(fullTrack);
        setIsSidebarCollapsed(false); // Always show sidebar when selecting a track
      }
    } else {
      setSelectedTrack(track);
      setIsSidebarCollapsed(false); // Always show sidebar when selecting a track
    }
  };

  const handleCloseSidebar = () => {
    setSelectedTrack(null);
    setCursorPosition(null);
    setGraphHoverIndex(null);
    setIsSidebarCollapsed(false); // Reset collapse state when closing
  };

  const handleGraphCursor = (index) => {
    setGraphHoverIndex(index);
    if (index !== null && selectedTrack) {
      const coords =
        selectedTrack.geometry.type === "LineString"
          ? selectedTrack.geometry.coordinates
          : selectedTrack.geometry.coordinates[0];

      if (coords[index]) {
        setCursorPosition([coords[index][1], coords[index][0]]);
      }
    } else {
      setCursorPosition(null);
    }
  };

  const handleMapHover = (index) => {
    setGraphHoverIndex(index);
    if (index !== null && selectedTrack) {
      const coords =
        selectedTrack.geometry.type === "LineString"
          ? selectedTrack.geometry.coordinates
          : selectedTrack.geometry.coordinates[0];

      if (coords[index]) {
        setCursorPosition([coords[index][1], coords[index][0]]);
      }
    }
  };

  const handleSaveDrawnTrail = (geojson) => {
    const processedTrack = processTrack(geojson, `drawn-${Date.now()}.geojson`);
    if (processedTrack) {
      setTracks((prev) => [...prev, processedTrack]);
      setDrawMode(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="loading-pulse">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-[var(--accent-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <p className="text-[var(--text-primary)] text-lg font-display font-semibold">
            Loading trails...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden bg-[var(--bg-primary)]">
      <button
        onClick={() => setIsMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[1001] p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--accent-primary)] shadow-lg"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div
        className={`
        fixed inset-y-0 left-0 z-[1002] w-80 transform transition-transform duration-300 ease-in-out
        ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0 lg:h-full border-r border-[var(--border-color)]
        ${isTrackListCollapsed ? "lg:w-0 lg:opacity-0 lg:overflow-hidden" : "lg:w-96"}
      `}
      >
        <button
          onClick={() => setIsMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 z-20 text-[var(--text-secondary)]"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Collapse button (visible when TrackList is open) */}
        <button
          onClick={() => setIsTrackListCollapsed(true)}
          className="hidden lg:flex absolute -right-10 top-1/2 -translate-y-1/2 z-50 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-r-lg text-[var(--accent-primary)] hover:brightness-110 shadow-md"
          title="Hide Track List"
        >
          <svg
            className="w-5 h-5 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <TrackList
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackSelect={handleTrackSelect}
          themeToggle={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
          loadingTrack={loadingTrack}
        />
      </div>

      {/* Expand TrackList button (visible when TrackList is collapsed) */}
      {isTrackListCollapsed && (
        <button
          onClick={() => setIsTrackListCollapsed(false)}
          className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-[1004] p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--accent-primary)] hover:brightness-110 shadow-lg items-center justify-center"
          title="Show Track List"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* ✅ NEW: 2D / 3D Toggle + Settings (center-top) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1005] flex gap-2 items-center">
        <button
          onClick={() => setMapMode("2d")}
          className={`px-3 py-2 rounded-lg border text-sm shadow
            ${mapMode === "2d"
              ? "bg-[var(--accent-primary)] text-black border-transparent"
              : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)] hover:brightness-110"
            }`}
          title="2D Leaflet"
        >
          2D
        </button>

        <button
          onClick={() => setMapMode("3d")}
          className={`px-3 py-2 rounded-lg border text-sm shadow
            ${mapMode === "3d"
              ? "bg-[var(--accent-primary)] text-black border-transparent"
              : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)] hover:brightness-110"
            }`}
          title="3D Terrain"
        >
          3D
        </button>

        {/* Settings button - only show in 3D mode */}
        {mapMode === "3d" && (
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg border bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)] hover:brightness-110 shadow"
              title="Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {/* Settings dropdown */}
            {showSettings && (
              <div className="absolute top-12 right-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-3 min-w-[220px]">
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[var(--text-primary)]">
                      Show Peaks
                    </span>
                    <input
                      type="checkbox"
                      checked={showPeaks}
                      onChange={(e) => setShowPeaks(e.target.checked)}
                      className="ml-2"
                    />
                  </label>

                  <label
                    className="flex items-center justify-between cursor-pointer"
                    style={{
                      opacity: showPeaks ? 1 : 0.5,
                      pointerEvents: showPeaks ? "auto" : "none",
                    }}
                  >
                    <span className="text-sm text-[var(--text-primary)]">
                      Show Peak Labels
                    </span>
                    <input
                      type="checkbox"
                      checked={showPeakLabels}
                      onChange={(e) => setShowPeakLabels(e.target.checked)}
                      disabled={!showPeaks}
                      className="ml-2"
                    />
                  </label>

                  <div
                    style={{
                      opacity: showPeaks ? 1 : 0.5,
                      pointerEvents: showPeaks ? "auto" : "none",
                    }}
                  >
                    <label className="block text-sm text-[var(--text-primary)] mb-1">
                      Peak Radius: {peakRadius} mi
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={peakRadius}
                      onChange={(e) => setPeakRadius(Number(e.target.value))}
                      disabled={!showPeaks}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 relative h-full">
        {mapMode === "2d" ? (
          <Map
            key={leafletKey}
            tracks={leafletTracks}
            selectedTrack={selectedTrack}
            onTrackClick={handleTrackSelect}
            showMileMarkers={showMileMarkers}
            showStartFinish={showStartFinish}
            cursorPosition={cursorPosition}
            cursorIndex={graphHoverIndex}
            onMapHover={handleMapHover}
            drawMode={drawMode}
            onSaveDrawnTrail={handleSaveDrawnTrail}
            onCloseDrawMode={() => setDrawMode(false)}
            theme={theme}
            sidebarOpen={!!selectedTrack && !isSidebarCollapsed}
            isSidebarCollapsed={isSidebarCollapsed}
            trackListCollapsed={isTrackListCollapsed}
            userPosition={gpsPosition}
            userStatus={gpsStatus}
            followMe={followMe}
          />
        ) : (
          <CesiumView
            geojsonUrl={
              selectedTrack?.properties?.filename
                ? `${import.meta.env.BASE_URL}tracks/${selectedTrack.properties.filename}`
                : null
            }
            clampToGround={true}
            showMileMarkers={showMileMarkers}
            cursorIndex={graphHoverIndex}
            peaks={peaks}
            showPeaks={showPeaks}
            showPeakLabels={showPeakLabels}
            peakRadius={peakRadius}
            style={{ width: "100%", height: "100%" }}
          />
        )}

        {/* GPS Button - bottom right over the map */}
        {mapMode === "2d" && (
          <div
            className="absolute right-4 z-[1003]"
            style={{
              bottom: 'max(24px, calc(100vh - 100dvh + 24px + env(safe-area-inset-bottom, 0px)))'
            }}
          >
            <GpsButton
              status={gpsStatus}
              position={gpsPosition}
              error={gpsError}
              onStart={startWatching}
              onStop={stopWatching}
              followMe={followMe}
              onToggleFollow={() => setFollowMe((f) => !f)}
            />
          </div>
        )}
      </div>

      {/* ✅ FIX: Always render Sidebar when track selected, but hide container when collapsed */}
      {selectedTrack && (
        <div
          className={`
  fixed bottom-0 left-0 right-0 w-full z-[1003]
  transform transition-all duration-300 ease-in-out shadow-2xl bg-[var(--bg-secondary)]
  rounded-t-3xl

  lg:fixed lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto
  lg:w-96 lg:rounded-none lg:border-l border-[var(--border-color)]
  ${isSidebarCollapsed ? "lg:translate-x-full" : "lg:translate-x-0"}
`}
        >
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="hidden lg:flex absolute -left-10 top-1/2 -translate-y-1/2 z-50 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-l-lg text-[var(--accent-primary)] hover:brightness-110 shadow-md"
            title="Hide Sidebar"
          >
            <svg
              className="w-5 h-5 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <Sidebar
            track={selectedTrack}
            onClose={handleCloseSidebar}
            onCursorPosition={handleGraphCursor}
            mapHoverIndex={graphHoverIndex}
          />
        </div>
      )}

      {selectedTrack && isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-[1004] p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--accent-primary)] hover:brightness-110 shadow-lg items-center justify-center"
          title="Show Sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
