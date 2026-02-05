import { useState, useEffect } from 'react';
import Map from './components/Map';
import TrackList from './components/TrackList';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import { calculateDistance, calculateElevationGain } from './utils';

function App() {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMileMarkers, setShowMileMarkers] = useState(true);
  const [showStartFinish, setShowStartFinish] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [graphHoverIndex, setGraphHoverIndex] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Get theme from localStorage or default to dark
    return localStorage.getItem('theme') || 'dark';
  });

  // Apply theme to document and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      // This will load all GeoJSON files from the public/tracks directory
      // You'll need to manually list your files here or create an index
      const trackFiles = [
        'sample-trail.geojson',
        'lakeside-loop.geojson',
        'BeaudryGlendaleLoop9.geojson',
        // Add your own GeoJSON filenames here:
      ];

      const loadedTracks = await Promise.all(
        trackFiles.map(async (filename) => {
          const response = await fetch(`/tracks/${filename}`);
          const data = await response.json();
          return processTrack(data, filename);
        })
      );

      setTracks(loadedTracks.filter(Boolean));
      setLoading(false);
    } catch (error) {
      console.error('Error loading tracks:', error);
      setLoading(false);
    }
  };

  const processTrack = (geojson, filename) => {
    try {
      // Handle both Feature and FeatureCollection
      let feature;
      if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
        feature = geojson.features[0];
      } else if (geojson.type === 'Feature') {
        feature = geojson;
      } else {
        return null;
      }

      // Get coordinates based on geometry type
      let coords;
      if (feature.geometry.type === 'LineString') {
        coords = feature.geometry.coordinates;
      } else if (feature.geometry.type === 'MultiLineString') {
        coords = feature.geometry.coordinates[0];
      } else {
        return null;
      }

      // Calculate stats
      const distance = calculateDistance(coords);
      const elevationGain = calculateElevationGain(coords);

      // Ensure properties exist and add calculated data
      feature.properties = {
        ...feature.properties,
        id: feature.properties?.id || filename,
        name: feature.properties?.name || filename.replace('.geojson', ''),
        distance,
        elevationGain
      };

      return feature;
    } catch (error) {
      console.error('Error processing track:', filename, error);
      return null;
    }
  };

  const handleTrackSelect = (track) => {
    setSelectedTrack(track);
  };

  const handleCloseSidebar = () => {
    setSelectedTrack(null);
    setCursorPosition(null);
    setGraphHoverIndex(null);
  };
  
  // Handle cursor position from elevation graph
  const handleGraphCursor = (index) => {
    setGraphHoverIndex(index);
    if (index !== null && selectedTrack) {
      const coords = selectedTrack.geometry.type === 'LineString' 
        ? selectedTrack.geometry.coordinates 
        : selectedTrack.geometry.coordinates[0];
      
      if (coords[index]) {
        setCursorPosition([coords[index][1], coords[index][0]]);
      }
    } else {
      setCursorPosition(null);
    }
  };
  
  // Handle hover on map
  const handleMapHover = (index) => {
    setGraphHoverIndex(index);
    if (index !== null && selectedTrack) {
      const coords = selectedTrack.geometry.type === 'LineString' 
        ? selectedTrack.geometry.coordinates 
        : selectedTrack.geometry.coordinates[0];
      
      if (coords[index]) {
        setCursorPosition([coords[index][1], coords[index][0]]);
      }
    }
  };
  
  // Handle saving a drawn trail
  const handleSaveDrawnTrail = (geojson) => {
    const processedTrack = processTrack(geojson, `drawn-${Date.now()}.geojson`);
    if (processedTrack) {
      setTracks(prev => [...prev, processedTrack]);
      setDrawMode(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="loading-pulse">
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
      {/* Track List - Left Panel */}
      <div className="w-full lg:w-96 h-48 lg:h-full border-b lg:border-b-0 lg:border-r border-[var(--border-color)] relative">
        <TrackList
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackSelect={handleTrackSelect}
          themeToggle={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
        />
        
        {/* Draw Trail Button - Floating at bottom of track list */}
        <button
          onClick={() => setDrawMode(true)}
          className="absolute bottom-4 left-4 right-4 px-4 py-3 bg-[var(--accent-primary)] text-black rounded-lg font-display font-semibold hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-2 z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Draw New Trail
        </button>
      </div>

      {/* Map - Center */}
      <div className="flex-1 relative">
        <Map
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackClick={handleTrackSelect}
          showMileMarkers={showMileMarkers}
          showStartFinish={showStartFinish}
          cursorPosition={cursorPosition}
          onMapHover={handleMapHover}
          sidebarOpen={!!selectedTrack}
          drawMode={drawMode}
          onSaveDrawnTrail={handleSaveDrawnTrail}
          onCloseDrawMode={() => setDrawMode(false)}
        />
        
        {/* Map Controls - Floating toggle buttons */}
        {selectedTrack && (
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setShowMileMarkers(!showMileMarkers)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                showMileMarkers 
                  ? 'bg-[var(--accent-primary)] text-black' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]'
              } hover:shadow-lg`}
            >
              {showMileMarkers ? '✓ Mile Markers' : 'Mile Markers'}
            </button>
            <button
              onClick={() => setShowStartFinish(!showStartFinish)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                showStartFinish 
                  ? 'bg-[var(--accent-primary)] text-black' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]'
              } hover:shadow-lg`}
            >
              {showStartFinish ? '✓ Start/Finish' : 'Start/Finish'}
            </button>
          </div>
        )}
        
        {/* Instructions Overlay - Shows when no tracks loaded */}
        {tracks.length === 0 && (
          <div className="absolute inset-0 bg-[var(--bg-primary)]/95 flex items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <h2 className="text-3xl font-display font-bold text-[var(--accent-primary)] mb-6">
                Welcome to Trail Explorer
              </h2>
              <div className="space-y-4 text-[var(--text-secondary)] text-left">
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6">
                  <h3 className="text-xl font-display font-semibold text-[var(--text-primary)] mb-3">
                    Getting Started
                  </h3>
                  <ol className="space-y-3 list-decimal list-inside">
                    <li>Add your GeoJSON files to the <code className="bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--accent-primary)] font-mono text-sm">/public/tracks/</code> directory</li>
                    <li>Update the <code className="bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--accent-primary)] font-mono text-sm">trackFiles</code> array in <code className="bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--accent-primary)] font-mono text-sm">App.jsx</code> with your filenames</li>
                    <li>Your tracks will appear on the map with distance and elevation data</li>
                    <li>Click any track to see detailed stats, elevation profile, and weather forecast</li>
                  </ol>
                </div>
                
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6">
                  <h3 className="text-xl font-display font-semibold text-[var(--text-primary)] mb-3">
                    GeoJSON Format
                  </h3>
                  <p className="mb-2">Your GeoJSON files should contain:</p>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>LineString or MultiLineString geometry</li>
                    <li>Coordinates with elevation data (optional)</li>
                    <li>Properties: name, description, location (optional)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - Right Panel (slides in when track selected) */}
      <div className={`
        fixed lg:relative top-0 right-0 h-full
        transform transition-transform duration-300 ease-in-out
        ${selectedTrack ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'}
        z-50 lg:z-auto
      `}>
        <Sidebar 
          track={selectedTrack} 
          onClose={handleCloseSidebar}
          onCursorPosition={handleGraphCursor}
          mapHoverIndex={graphHoverIndex}
        />
      </div>

      {/* Mobile overlay when sidebar is open */}
      {selectedTrack && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleCloseSidebar}
        />
      )}
    </div>
  );
}

export default App;
