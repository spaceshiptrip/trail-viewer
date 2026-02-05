import { useState, useRef, useEffect } from 'react';
import { useMap, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Download, Save, X, Pencil, Trash2, Check } from 'lucide-react';

// OSRM public demo server for map matching
const OSRM_SERVER = 'https://router.project-osrm.org';

export default function DrawTrailMode({ onSave, onClose }) {
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [snappedRoute, setSnappedRoute] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [trailName, setTrailName] = useState('');
  const [trailDescription, setTrailDescription] = useState('');
  const [trailLocation, setTrailLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  
  const DrawingHandler = () => {
    const map = useMap();
    mapRef.current = map;
    
    useEffect(() => {
      if (!isDrawing) return;
      
      const handleClick = (e) => {
        const newPoint = [e.latlng.lat, e.latlng.lng];
        setDrawnPoints(prev => [...prev, newPoint]);
      };
      
      map.on('click', handleClick);
      map.getContainer().style.cursor = 'crosshair';
      
      return () => {
        map.off('click', handleClick);
        map.getContainer().style.cursor = '';
      };
    }, [map, isDrawing]);
    
    return null;
  };
  
  // Snap the drawn points to roads using OSRM
  const snapToRoads = async () => {
    if (drawnPoints.length < 2) {
      setError('Please draw at least 2 points');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Format coordinates for OSRM (lon,lat;lon,lat)
      const coordinates = drawnPoints
        .map(point => `${point[1].toFixed(6)},${point[0].toFixed(6)}`)
        .join(';');
      
      // Use OSRM route service instead of match (more reliable)
      // The route service finds the best route between points
      const response = await fetch(
        `${OSRM_SERVER}/route/v1/foot/${coordinates}?overview=full&geometries=geojson&steps=true`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OSRM error:', errorData);
        throw new Error('Failed to snap to roads. Try drawing points closer to roads/trails.');
      }
      
      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('Could not find a route. Try drawing points closer together on roads or trails.');
      }
      
      // Get the route geometry
      const route = data.routes[0];
      const routeCoords = route.geometry.coordinates;
      
      // Convert to [lon, lat, elevation] format
      const snappedCoords = routeCoords.map(coord => {
        // OSRM returns [lon, lat], we add elevation as 0
        return [coord[0], coord[1], 0];
      });
      
      setSnappedRoute({
        coordinates: snappedCoords,
        distance: route.distance,
        duration: route.duration
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Snap to roads error:', err);
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Clear the drawing
  const clearDrawing = () => {
    setDrawnPoints([]);
    setSnappedRoute(null);
    setError(null);
  };
  
  // Save as GeoJSON
  const saveAsGeoJSON = () => {
    if (!snappedRoute) return;
    
    const geojson = {
      type: 'Feature',
      properties: {
        name: trailName || 'Untitled Trail',
        description: trailDescription || '',
        location: trailLocation || '',
        distance: (snappedRoute.distance / 1609.34).toFixed(2), // Convert meters to miles
        created: new Date().toISOString()
      },
      geometry: {
        type: 'LineString',
        coordinates: snappedRoute.coordinates
      }
    };
    
    // Download as file
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trailName || 'trail'}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Also call the onSave callback
    if (onSave) {
      onSave(geojson);
    }
  };
  
  // Save as GPX
  const saveAsGPX = () => {
    if (!snappedRoute) return;
    
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trail Explorer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${trailName || 'Untitled Trail'}</name>
    <desc>${trailDescription || ''}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${trailName || 'Untitled Trail'}</name>
    <desc>${trailDescription || ''}</desc>
    <trkseg>
${snappedRoute.coordinates.map(coord => 
  `      <trkpt lat="${coord[1]}" lon="${coord[0]}">
        <ele>${coord[2] || 0}</ele>
      </trkpt>`
).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
    
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trailName || 'trail'}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <>
      <DrawingHandler />
      
      {/* Drawing polyline (user's raw clicks) */}
      {drawnPoints.length > 1 && !snappedRoute && (
        <Polyline
          positions={drawnPoints}
          pathOptions={{
            color: '#ff6b6b',
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10'
          }}
        />
      )}
      
      {/* Drawn point markers */}
      {drawnPoints.map((point, idx) => (
        <Marker
          key={`drawn-${idx}`}
          position={point}
          icon={L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #ff6b6b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })}
        >
          <Popup>{idx === 0 ? 'Start' : idx === drawnPoints.length - 1 ? 'End' : `Point ${idx + 1}`}</Popup>
        </Marker>
      ))}
      
      {/* Snapped route polyline */}
      {snappedRoute && (
        <Polyline
          positions={snappedRoute.coordinates.map(c => [c[1], c[0]])}
          pathOptions={{
            color: '#5ab887',
            weight: 4,
            opacity: 0.9
          }}
        />
      )}
      
      {/* Control Panel */}
      <div className="absolute top-4 right-4 z-[1000] w-80 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-[var(--accent-primary)]">
            Draw Trail Mode
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Instructions */}
        <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg text-sm text-[var(--text-secondary)]">
          {!isDrawing && drawnPoints.length === 0 && (
            <p>Click "Start Drawing" then click on the map to create points along your trail. Points will be connected along roads/trails.</p>
          )}
          {isDrawing && (
            <p>Click on the map to add points. The route will follow roads and trails between points. Click "Snap to Route" when done.</p>
          )}
          {snappedRoute && (
            <p>✓ Route created! Enter details and save as GeoJSON or GPX.</p>
          )}
        </div>
        
        {/* Drawing Controls */}
        {!snappedRoute && (
          <div className="space-y-2 mb-4">
            {!isDrawing ? (
              <button
                onClick={() => setIsDrawing(true)}
                className="w-full px-4 py-2 bg-[var(--accent-primary)] text-black rounded-lg font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Start Drawing
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsDrawing(false);
                    snapToRoads();
                  }}
                  disabled={drawnPoints.length < 2 || loading}
                  className="w-full px-4 py-2 bg-[var(--accent-primary)] text-black rounded-lg font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {loading ? 'Finding Route...' : 'Snap to Route'}
                </button>
                <button
                  onClick={clearDrawing}
                  className="w-full px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg font-medium hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Drawing
                </button>
              </>
            )}
            
            {drawnPoints.length > 0 && (
              <div className="text-xs text-[var(--text-secondary)] text-center">
                {drawnPoints.length} points drawn
              </div>
            )}
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        
        {/* Trail Details Form */}
        {snappedRoute && (
          <div className="space-y-3 mb-4">
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Distance</div>
              <div className="text-lg font-display font-bold text-[var(--accent-primary)]">
                {(snappedRoute.distance / 1609.34).toFixed(2)} mi
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Trail Name *</label>
              <input
                type="text"
                value={trailName}
                onChange={(e) => setTrailName(e.target.value)}
                placeholder="My Awesome Trail"
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Location</label>
              <input
                type="text"
                value={trailLocation}
                onChange={(e) => setTrailLocation(e.target.value)}
                placeholder="State Park, CA"
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
              <textarea
                value={trailDescription}
                onChange={(e) => setTrailDescription(e.target.value)}
                placeholder="A beautiful trail through the mountains..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors text-sm resize-none"
              />
            </div>
          </div>
        )}
        
        {/* Save Buttons */}
        {snappedRoute && (
          <div className="space-y-2">
            <button
              onClick={saveAsGeoJSON}
              disabled={!trailName}
              className="w-full px-4 py-2 bg-[var(--accent-primary)] text-black rounded-lg font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download GeoJSON
            </button>
            
            <button
              onClick={saveAsGPX}
              disabled={!trailName}
              className="w-full px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg font-medium hover:bg-[var(--bg-secondary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download GPX
            </button>
            
            <button
              onClick={clearDrawing}
              className="w-full px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg font-medium hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Start New Trail
            </button>
          </div>
        )}
      </div>
    </>
  );
}
