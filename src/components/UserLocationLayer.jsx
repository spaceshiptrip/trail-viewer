import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GEO_STATUS } from '../hooks/useGeolocation';

/**
 * UserLocationLayer
 * 
 * Drop this inside your <Map> component (inside MapContainer).
 * It renders:
 *   - Accuracy circle (semi-transparent blue ring)
 *   - Blue "you are here" pulsing dot
 *   - Heading cone (if device reports heading, e.g. while moving)
 * 
 * Props:
 *   position  — from useGeolocation()
 *   status    — from useGeolocation()
 *   followMe  — bool: keep map centered on your position
 */
export default function UserLocationLayer({ position, status, followMe = false }) {
  const markerRef     = useRef(null); // Blue dot marker
  const accuracyRef   = useRef(null); // Accuracy circle

  useEffect(() => {
    // Nothing to draw yet
    if (!position || status !== GEO_STATUS.WATCHING) {
      // Clean up if we had layers
      if (markerRef.current)   markerRef.current.remove();
      if (accuracyRef.current) accuracyRef.current.remove();
      markerRef.current   = null;
      accuracyRef.current = null;
      return;
    }

    // We need the map — bail if not ready
    const map = mapInstanceRef.current;  // ← Use imported ref
    if (!map) return;

    const latlng = [position.lat, position.lng];

    // ── Accuracy circle ──────────────────────────────────────────
    if (!accuracyRef.current) {
      accuracyRef.current = L.circle(latlng, {
        radius:      position.accuracy,
        color:       '#3b82f6',
        fillColor:   '#3b82f6',
        fillOpacity: 0.08,
        weight:      1,
        opacity:     0.4,
      }).addTo(map);
    } else {
      accuracyRef.current.setLatLng(latlng);
      accuracyRef.current.setRadius(position.accuracy);
    }

    // ── Blue pulsing dot ─────────────────────────────────────────
    const iconHtml = `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
      ">
        <!-- Pulse ring -->
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: rgba(59,130,246,0.25);
          animation: gpsPulse 2s ease-out infinite;
        "></div>

        <!-- White border -->
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        "></div>

        <!-- Blue fill -->
        <div style="
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: #3b82f6;
        "></div>
      </div>
    `;

    const icon = L.divIcon({
      html:        iconHtml,
      className:   '',         // Disable Leaflet's default white box
      iconSize:    [22, 22],
      iconAnchor:  [11, 11],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { icon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip(
          () => `<b>You are here</b><br>±${Math.round(position.accuracy)} m`,
          { permanent: false, direction: 'top' }
        );
    } else {
      markerRef.current.setLatLng(latlng);
      markerRef.current.setIcon(icon);
    }

    // ── Follow mode ──────────────────────────────────────────────
    if (followMe) {
      map.panTo(latlng, { animate: true, duration: 0.5 });
    }

  }, [position, status, followMe]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current)   markerRef.current.remove();
      if (accuracyRef.current) accuracyRef.current.remove();
    };
  }, []);

  return null; // Pure side-effect component
}
