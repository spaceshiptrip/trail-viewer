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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMileMarkers, setShowMileMarkers] = useState(true);
  const [showStartFinish, setShowStartFinish] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [graphHoverIndex, setGraphHoverIndex] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  // Near your other useState hooks
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
        'Beaudry2VerdugoPeak_11.geojson',
        'Sunshine2VerdugoPeak_12.geojson',
        'Palm2Lukens_14.geojson',
        'Mount_Wilson_via_Sierra_Madre_Jones_Peak_and_Bailey_Canyon_Loop.geojson',
        // Add your own GeoJSON filenames here:
      ];

      const loadedTracks = await Promise.all(
        trackFiles.map(async (filename) => {
          const url = `${import.meta.env.BASE_URL}tracks/${filename}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
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

      // DEBUG console output stats
      const elevationsFt = coords.map(c => c[2] * 3.28084);
      console.log(filename, {
        start: elevationsFt[0],
        max: Math.max(...elevationsFt),
        min: Math.min(...elevationsFt),
        gain: elevationGain
      });

      return feature;
    } catch (error) {
      console.error('Error processing track:', filename, error);
      return null;
    }
  };

  const handleTrackSelect = (track) => {
    setSelectedTrack(track);
    setIsMenuOpen(false); 
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
      {/* Hamburger Button */}
      <button 
        onClick={() => setIsMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[1001] p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--accent-primary)] shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {/* Track List - Now an overlay on mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-[1002] w-80 transform transition-transform duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-96 lg:h-full border-r border-[var(--border-color)]
      `}>
         {/* Mobile Close Button */}
         <button onClick={() => setIsMenuOpen(false)} className="lg:hidden absolute top-4 right-4 z-20 text-[var(--text-secondary)]">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
         </button>
         <TrackList
            tracks={tracks}
            selectedTrack={selectedTrack}
            onTrackSelect={handleTrackSelect}
            themeToggle={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
          />
      </div>

      {/* Map - Full screen on mobile */}
      <div className="flex-1 relative h-full">
        <Map
          tracks={tracks}
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
          sidebarOpen={!!selectedTrack}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      </div>

      {/* Details - Sliding Bottom Sheet on Mobile / Collapsible Sidebar on Desktop */}
      {selectedTrack && (
        <div className={`
          fixed bottom-0 left-0 w-full z-[1003] transform transition-all duration-500 ease-in-out shadow-2xl bg-[var(--bg-secondary)]
          ${isSheetMinimized ? 'translate-y-[calc(100%-60px)]' : 'translate-y-0'}
          h-[70vh] rounded-t-3xl
          lg:relative lg:translate-y-0 lg:h-full lg:w-96 lg:rounded-none lg:border-l border-[var(--border-color)]
          ${isSidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-96 lg:opacity-100'}
        `}>
          {/* Desktop Collapse Toggle Button (Visible only on Desktop when track selected) */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex absolute -left-10 top-4 z-50 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-l-lg text-[var(--accent-primary)] hover:brightness-110 shadow-md"
            title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Mobile Toggle Button (Visual handle) */}
          <button 
            onClick={() => setIsSheetMinimized(!isSheetMinimized)}
            className="lg:hidden absolute top-2 left-1/2 -translate-x-1/2 w-20 h-8 z-50 flex items-center justify-center"
          >
            <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full opacity-50" />
          </button>

          <Sidebar 
            track={selectedTrack} 
            onClose={handleCloseSidebar}
            onCursorPosition={handleGraphCursor}
            mapHoverIndex={graphHoverIndex}
          />
        </div>
      )}

{/* Permanent Desktop Toggle (Visible when sidebar is collapsed to bring it back) */}
{selectedTrack && isSidebarCollapsed && (
  <button
    onClick={() => setIsSidebarCollapsed(false)}
    className="hidden lg:flex fixed right-0 top-4 z-50 p-2 bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-color)] rounded-l-lg text-[var(--accent-primary)] shadow-md"
  >
    <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </button>
)}

    </div>
  );
}

export default App;
