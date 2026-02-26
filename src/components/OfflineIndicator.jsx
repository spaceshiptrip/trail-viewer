import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * OfflineIndicator
 * 
 * Shows a banner when the app is offline.
 * GPS will still work offline!
 * 
 * Usage in App.jsx:
 *   <OfflineIndicator />
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showTransition, setShowTransition] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowTransition(true);
      // Show "Back Online" message briefly
      setTimeout(() => setShowTransition(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowTransition(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online (unless just came back online)
  if (isOnline && !showTransition) return null;

  return (
    <div 
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[2001] px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 transition-all duration-300"
      style={{
        backgroundColor: isOnline ? '#22c55e' : '#eab308',
        color: isOnline ? '#fff' : '#000',
      }}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          Back Online
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          Offline Mode - GPS Active
        </>
      )}
    </div>
  );
}
