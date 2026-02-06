import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to fit map bounds to all tracks or selected track
function FitBounds({ bounds, selectedTrack }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedTrack) {
      // Fit to selected track only
      const coords = selectedTrack.geometry.type === 'LineString'
        ? selectedTrack.geometry.coordinates.map(coord => [coord[1], coord[0]])
        : selectedTrack.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
      
      const trackBounds = L.latLngBounds(coords);
      map.fitBounds(trackBounds, { padding: [50, 50], maxZoom: 14 });
    } else if (bounds && bounds.length > 0) {
      // Fit to all tracks
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, selectedTrack, map]);
  
  return null;
}

export default function Map({ tracks, selectedTrack, onTrackClick }) {
  const mapRef = useRef();
  
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
      // color: isSelected ? '#5ab887' : '#8cd2ad',
      color: isSelected ? '#5A8BB8' : '#B85A8B',
      weight: isSelected ? 6 : 3,
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
          e.target.setStyle({ color: '#B85A8B', weight: 4, opacity: 0.9 });
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles grayscale-[0.3] contrast-125 brightness-75"
        />
        
        {tracks.map((track) => (
          <GeoJSON
            key={track.properties.id}
            data={track}
            style={getTrackStyle}
            onEachFeature={onEachFeature}
          />
        ))}
        
        {bounds && <FitBounds bounds={bounds} selectedTrack={selectedTrack} />}
      </MapContainer>
    </div>
  );
}
