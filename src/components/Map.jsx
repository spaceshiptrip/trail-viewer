import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import DrawTrailMode from './DrawTrailMode';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom start marker icon (green)
const startIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#00e400" stroke="#000" stroke-width="1.5">
      <path d="M12 2L12 22M12 2L8 6M12 2L16 6"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Custom finish marker icon (red)
const finishIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff0000" stroke-width="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});


// Mile marker icon with number (white circle + green number)
const mileMarkerIcon = (n) =>
  L.divIcon({
    className: '', // important: prevent default leaflet styles
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 9999px;
        background: #ffffff;
        border: 2px solid #5ab887;
        box-shadow: 0 1px 6px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        font-weight: 800;
        font-size: 12px;
        color: #1e6f4c;
        line-height: 1;
      ">
        ${n}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });


// --- Shared math helpers (must be top-level so CursorMarker can use them) ---
const toRad = (degrees) => degrees * (Math.PI / 180);

// Haversine distance formula (miles)
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Component for cursor position marker
function CursorMarker({ position, track, index }) {
  if (!position || !track || index == null) return null;

  const coords =
    track.geometry.type === 'LineString'
      ? track.geometry.coordinates
      : track.geometry.coordinates[0];

  const elevation = coords[index]?.[2] || 0;

  // calculate distance up to this point
  let distance = 0;
  for (let i = 1; i <= index; i++) {
    if (!coords[i] || !coords[i - 1]) break;
    distance += haversineDistance(
      coords[i - 1][1], coords[i - 1][0],
      coords[i][1], coords[i][0]
    );
  }

  return (
    <CircleMarker
      center={position}
      radius={9}
      className="drop-shadow-md"
      pathOptions={{
        color: '#ffffff',
        fillColor: '#5ab887',
        fillOpacity: 1,
        weight: 3
      }}
    >
      <Popup>
        <div className="font-display font-semibold space-y-1">
          <div>Mile {distance.toFixed(2)}</div>
          <div className="text-sm text-[var(--text-secondary)]">
            {Math.round(elevation)} ft
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// Component to fit map bounds to all tracks or selected track
function FitBounds({ bounds, selectedTrack, sidebarOpen, isSidebarCollapsed }) {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [lastTrackId, setLastTrackId] = useState(null);
  
  useEffect(() => {
    const currentTrackId = selectedTrack?.properties?.id || null;
    
    // Only recenter if:
    // 1. First load (!hasInitialized)
    // 2. Track changed (currentTrackId !== lastTrackId)
    const shouldRecenter = !hasInitialized || currentTrackId !== lastTrackId;
    
    if (!shouldRecenter) return;
    
    if (selectedTrack) {
      // Fit to selected track only
      const coords = selectedTrack.geometry.type === 'LineString'
        ? selectedTrack.geometry.coordinates.map(coord => [coord[1], coord[0]])
        : selectedTrack.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
      
      const trackBounds = L.latLngBounds(coords);
      
      // LOGIC: Responsive padding for Sidebar vs Bottom Sheet
      const isMobile = window.innerWidth < 1024;
      const paddingLeft = (!isMobile && sidebarOpen && !isSidebarCollapsed) ? 450 : 50;
      const paddingBottom = (isMobile && sidebarOpen) ? 300 : 50;
      
      map.fitBounds(trackBounds, { 
        paddingTopLeft: [paddingLeft, 50],
        paddingBottomRight: [50, paddingBottom],
        maxZoom: 14 
      });
    } else if (bounds && bounds.length > 0) {
      // Fit to all tracks
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    setHasInitialized(true);
    setLastTrackId(currentTrackId);
  }, [selectedTrack, bounds, map, hasInitialized, lastTrackId, sidebarOpen, isSidebarCollapsed]);
  
  return null;
}

export default function Map({ 
  tracks, 
  selectedTrack, 
  onTrackClick, 
  showMileMarkers, 
  showStartFinish, 
  cursorPosition, 
  cursorIndex, 
  onMapHover, 
  sidebarOpen, 
  isSidebarCollapsed, // Fixed: Added to function props
  drawMode, 
  onSaveDrawnTrail, 
  onCloseDrawMode, 
  theme 
}) {
  const mapRef = useRef();
  
  // Calculate mile markers for selected track
  const getMileMarkers = (track) => {
    if (!track || !showMileMarkers) return [];
    
    const coords = track.geometry.type === 'LineString' 
      ? track.geometry.coordinates 
      : track.geometry.coordinates[0];
    
    const markers = [];
    let totalDistance = 0;
    let nextMarkerDistance = 1; // First marker at 1 mile
    
    markers.push({
      position: [coords[0][1], coords[0][0]],
      distance: 0
    });
    
    for (let i = 1; i < coords.length; i++) {
      const dist = haversineDistance(
        coords[i-1][1], coords[i-1][0],
        coords[i][1], coords[i][0]
      );
      totalDistance += dist;
      
      while (totalDistance >= nextMarkerDistance) {
        // Interpolate position for this mile marker
        const excess = totalDistance - nextMarkerDistance;
        const segmentDist = dist;
        const ratio = 1 - (excess / segmentDist);
        
        const lat = coords[i-1][1] + (coords[i][1] - coords[i-1][1]) * ratio;
        const lon = coords[i-1][0] + (coords[i][0] - coords[i-1][0]) * ratio;
        
        markers.push({
          position: [lat, lon],
          distance: nextMarkerDistance
        });
        
        nextMarkerDistance += 1;
      }
    }
    
    return markers;
  };
  
  const mileMarkers = selectedTrack ? getMileMarkers(selectedTrack) : [];
  
  // Get start and finish positions
  const getStartFinishPositions = (track) => {
    if (!track || !showStartFinish) return { start: null, finish: null };
    
    const coords = track.geometry.type === 'LineString' 
      ? track.geometry.coordinates 
      : track.geometry.coordinates[0];
    
    return {
      start: [coords[0][1], coords[0][0]],
      finish: [coords[coords.length - 1][1], coords[coords.length - 1][0]]
    };
  };
  
  const { start, finish } = selectedTrack ? getStartFinishPositions(selectedTrack) : { start: null, finish: null };
  
  // Handle map mousemove for cursor tracking
  const MapEventHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      if (!selectedTrack || !onMapHover) return;
      
      const coords = selectedTrack.geometry.type === 'LineString' 
        ? selectedTrack.geometry.coordinates 
        : selectedTrack.geometry.coordinates[0];
      
      const handleMouseMove = (e) => {
        const clickedPoint = [e.latlng.lat, e.latlng.lng];
        
        // Find closest point on track
        let minDist = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < coords.length; i++) {
          const dist = haversineDistance(
            clickedPoint[0], clickedPoint[1],
            coords[i][1], coords[i][0]
          );
          if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
          }
        }
        
        // Only trigger if within 0.1 miles of track
        if (minDist < 0.1) {
          onMapHover(closestIndex);
        }
      };
      
      map.on('mousemove', handleMouseMove);
      
      return () => {
        map.off('mousemove', handleMouseMove);
      };
    }, [map, selectedTrack]);
    
    return null;
  };
  
  // Calculate bounds for all tracks
  const getAllBounds = () => {
    if (tracks.length === 0) return null;
    
    const allCoords = tracks.flatMap(track => {
      if (track.geometry.type === 'LineString') {
        return track.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      } else if (track.geometry.type === 'MultiLineString') {
        return track.geometry.coordinates.flatMap(line =>
          line.map(coord => [coord[1], coord[0]])
        );
      }
      return [];
    });
    
    if (allCoords.length === 0) return null;
    
    return L.latLngBounds(allCoords);
  };

  const bounds = getAllBounds();
  const center = bounds ? bounds.getCenter() : [39.8283, -98.5795]; // Default to center of US
  
  // Style function for GeoJSON features
  const getTrackStyle = (feature) => {
    const isSelected = selectedTrack && feature.properties.id === selectedTrack.properties.id;
    
    return {
      color: isSelected ? '#5ab887' : '#8cd2ad',
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 1 : 0.7,
      lineCap: 'round',
      lineJoin: 'round'
    };
  };
  
  // Handle track interactions
  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => onTrackClick(feature),
      mouseover: (e) => {
        if (!selectedTrack || selectedTrack.properties.id !== feature.properties.id) {
          e.target.setStyle({ color: '#5ab887', weight: 4, opacity: 0.9 });
        }
      },
      mouseout: (e) => {
        if (!selectedTrack || selectedTrack.properties.id !== feature.properties.id) {
          e.target.setStyle(getTrackStyle(feature));
        }
      }
    });
    
    // Add popup
    if (feature.properties && feature.properties.name) {
      layer.bindPopup(`
        <div class="font-display font-bold text-lg mb-1">${feature.properties.name}</div>
        <div class="text-sm text-[var(--text-secondary)]">Click to view details</div>
      `);
    }
  };

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={10}
        className="h-full w-full rounded-lg border border-[var(--border-color)]"
        ref={mapRef}
      >
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className={theme === 'dark' ? 'brightness-115 contrast-105' : ''}
        />
        
        {tracks.map((track) => (
          <GeoJSON
            key={track.properties.id}
            data={track}
            style={getTrackStyle}
            onEachFeature={onEachFeature}
          />
        ))}
        
        
        {/* Mile Markers (numbered) */}
        {mileMarkers
          .filter(m => m.distance > 0) // skip 0; you already have a Start marker
          .map((marker) => (

            <Marker
              key={`mile-${marker.distance}`}
              position={marker.position}
              icon={mileMarkerIcon(marker.distance)}
              keyboard={false}
            >
              <Popup>
                <div className="font-display font-semibold">
                  Mile {marker.distance}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Start Marker */}
          {start && (
            <Marker position={start} icon={startIcon}>
              <Popup>
                <div className="font-display font-semibold text-green-600">Trail Start</div>
              </Popup>
            </Marker>
          )}
          
          {/* Finish Marker */}
          {finish && (
            <Marker position={finish} icon={finishIcon}>
              <Popup>
                <div className="font-display font-semibold text-red-600">Trail Finish</div>
              </Popup>
            </Marker>
          )}
          
          {/* Cursor Position Marker */}
          <CursorMarker
            position={cursorPosition}
            track={selectedTrack}
            index={cursorIndex}
          />
          
          {/* Map Event Handler */}
          <MapEventHandler />
          
          {/* Fixed: FitBounds now receives all 4 required props */}
          {bounds && (
            <FitBounds 
              bounds={bounds} 
              selectedTrack={selectedTrack} 
              sidebarOpen={sidebarOpen} 
              isSidebarCollapsed={isSidebarCollapsed} 
            />
          )}
          
          {/* Draw Trail Mode */}
          {drawMode && (
            <DrawTrailMode
              onSave={onSaveDrawnTrail}
              onClose={onCloseDrawMode}
            />
          )}
        </MapContainer>
      </div>
    );
}
