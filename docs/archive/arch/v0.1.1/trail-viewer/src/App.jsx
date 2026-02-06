import { useState, useEffect } from 'react';
import Map from './components/Map';
import TrackList from './components/TrackList';
import Sidebar from './components/Sidebar';
import { calculateDistance, calculateElevationGain } from './utils';

function App() {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [loading, setLoading] = useState(true);

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
        'myrun.geojson'
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
      <div className="w-full lg:w-96 h-48 lg:h-full border-b lg:border-b-0 lg:border-r border-[var(--border-color)]">
        <TrackList
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackSelect={handleTrackSelect}
        />
      </div>

      {/* Map - Center */}
      <div className="flex-1 relative">
        <Map
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackClick={handleTrackSelect}
        />
        
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
        <Sidebar track={selectedTrack} onClose={handleCloseSidebar} />
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
