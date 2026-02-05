import { useState } from 'react';
import { Search, Mountain, TrendingUp } from 'lucide-react';

export default function TrackList({ tracks, selectedTrack, onTrackSelect, themeToggle }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredTracks = tracks.filter(track => {
    const name = track.properties.name?.toLowerCase() || '';
    const location = track.properties.location?.toLowerCase() || '';
    const description = track.properties.description?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    
    return name.includes(search) || location.includes(search) || description.includes(search);
  });
  
  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-display font-bold text-[var(--accent-primary)]">
            Trail Explorer
          </h1>
          {themeToggle}
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} loaded
        </p>
      </div>
      
      {/* Search */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search trails, locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] 
                     rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)]
                     focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>
      </div>
      
      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTracks.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            {tracks.length === 0 ? (
              <>
                <Mountain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-2">No tracks loaded</p>
                <p className="text-sm">Add GeoJSON files to /public/tracks/</p>
              </>
            ) : (
              <>
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-2">No tracks found</p>
                <p className="text-sm">Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          filteredTracks.map((track, idx) => (
            <div
              key={track.properties.id}
              onClick={() => onTrackSelect(track)}
              className={`trail-card fade-in-up ${
                selectedTrack?.properties.id === track.properties.id
                  ? 'border-[var(--accent-primary)] bg-[var(--bg-tertiary)]'
                  : ''
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <h3 className="font-display font-semibold text-lg mb-2 text-[var(--text-primary)]">
                {track.properties.name || `Track ${idx + 1}`}
              </h3>
              
              {track.properties.location && (
                <p className="text-[var(--text-secondary)] text-sm mb-3">
                  {track.properties.location}
                </p>
              )}
              
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <Mountain className="w-4 h-4" />
                  <span className="font-mono font-medium">
                    {track.properties.distance?.toFixed(2) || '0'} mi
                  </span>
                </div>
                
                {track.properties.elevationGain > 0 && (
                  <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-mono font-medium">
                      {track.properties.elevationGain?.toFixed(0)} ft
                    </span>
                  </div>
                )}
              </div>
              
              {track.properties.description && (
                <p className="text-[var(--text-secondary)] text-sm mt-3 line-clamp-2">
                  {track.properties.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
