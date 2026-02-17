import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useGeolocation
 * 
 * Handles the full GPS lifecycle:
 *  - idle      → user hasn't been asked yet
 *  - pending   → waiting for browser permission prompt
 *  - watching  → actively receiving GPS updates
 *  - denied    → user said no (or OS denied)
 *  - error     → GPS failed for another reason
 */

export const GEO_STATUS = {
  IDLE:     'idle',
  PENDING:  'pending',
  WATCHING: 'watching',
  DENIED:   'denied',
  ERROR:    'error',
};

export default function useGeolocation() {
  const [status,   setStatus]   = useState(GEO_STATUS.IDLE);
  const [position, setPosition] = useState(null); // { lat, lng, accuracy, altitude, heading, speed }
  const [error,    setError]    = useState(null);
  const watchIdRef = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus(GEO_STATUS.IDLE);
    setPosition(null);
    setError(null);
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus(GEO_STATUS.ERROR);
      setError('Geolocation is not supported by your browser.');
      return;
    }

    // Show the spinner while the permission prompt is open
    setStatus(GEO_STATUS.PENDING);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      // ✅ Success
      (pos) => {
        setStatus(GEO_STATUS.WATCHING);
        setError(null);
        setPosition({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,        // meters
          altitude: pos.coords.altitude,        // meters (null if unavailable)
          heading:  pos.coords.heading,         // degrees (null if unavailable)
          speed:    pos.coords.speed,           // m/s   (null if unavailable)
          timestamp: pos.timestamp,
        });
      },
      // ❌ Error
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus(GEO_STATUS.DENIED);
          setError('Location access was denied. Enable it in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus(GEO_STATUS.ERROR);
          setError('Position unavailable. Are you indoors?');
        } else if (err.code === err.TIMEOUT) {
          setStatus(GEO_STATUS.ERROR);
          setError('GPS timed out. Try again.');
        } else {
          setStatus(GEO_STATUS.ERROR);
          setError(err.message || 'Unknown GPS error.');
        }
      },
      {
        enableHighAccuracy: true,  // Use GPS chip, not WiFi/cell tower
        maximumAge:         0,     // Never use a cached position
        timeout:            15000, // Give up after 15 s
      }
    );
  }, []);

  // Clean up the watch when the hook unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { status, position, error, startWatching, stopWatching };
}
