import { GEO_STATUS } from '../hooks/useGeolocation';

/**
 * GpsButton
 * 
 * Floating button that lives over the map.
 * Cycles through:  idle → pending → watching → (tap again) → idle
 * Shows error/denied states with useful messages.
 * 
 * Usage:
 *   <GpsButton
 *     status={status}
 *     position={position}
 *     error={error}
 *     onStart={startWatching}
 *     onStop={stopWatching}
 *     followMe={followMe}
 *     onToggleFollow={() => setFollowMe(f => !f)}
 *   />
 */
export default function GpsButton({
  status,
  position,
  error,
  onStart,
  onStop,
  followMe,
  onToggleFollow,
}) {
  const isActive = status === GEO_STATUS.WATCHING;
  const isPending = status === GEO_STATUS.PENDING;
  const isDenied = status === GEO_STATUS.DENIED;
  const isError = status === GEO_STATUS.ERROR;

  const handleClick = () => {
    if (isActive || isPending) {
      onStop();
    } else {
      onStart();
    }
  };

  // ── Icon SVG ──────────────────────────────────────────────────
  const LocationIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" strokeOpacity="0.3" />
    </svg>
  );

  const SpinnerIcon = () => (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );

  const ErrorIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  // ── Button color / style ───────────────────────────────────────
  const buttonClass = () => {
    const base = 'flex items-center justify-center p-2.5 rounded-lg border shadow-lg transition-all duration-200';

    if (isActive) {
      return `${base} bg-blue-500 border-blue-400 text-white hover:bg-blue-600`;
    }
    if (isPending) {
      return `${base} bg-[var(--bg-secondary)] border-[var(--accent-primary)] text-[var(--accent-primary)]`;
    }
    if (isDenied || isError) {
      return `${base} bg-[var(--bg-secondary)] border-red-400 text-red-400 hover:border-red-300`;
    }
    // idle
    return `${base} bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]`;
  };

  return (
    <div className="flex flex-col items-end gap-1.5">

      {/* Error / denied toast */}
      {(isDenied || isError) && error && (
        <div className="bg-[var(--bg-secondary)] border border-red-400 text-red-400 text-xs rounded-lg px-3 py-2 max-w-[220px] shadow-lg">
          {error}
          {isDenied && (
            <a
              href="app-settings:"
              className="block mt-1 underline text-[var(--accent-primary)]"
              onClick={(e) => {
                e.preventDefault();
                // On mobile Safari, this nudges users to Settings
                window.location.href = 'app-settings:';
              }}
            >
              Open Settings →
            </a>
          )}
        </div>
      )}

      {/* Accuracy badge (when watching) */}
      {isActive && position && (
        <div className="bg-blue-500 text-white text-xs rounded-full px-2.5 py-1 shadow-md font-mono">
          ±{Math.round(position.accuracy)} m
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Follow-me toggle (only when GPS is active) */}
        {isActive && (
          <button
            onClick={onToggleFollow}
            title={followMe ? 'Stop following' : 'Follow my position'}
            className={`
              p-2.5 rounded-lg border shadow-lg transition-all duration-200
              ${followMe
                ? 'bg-blue-500 border-blue-400 text-white hover:bg-blue-600'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]'
              }
            `}
          >
            {/* Navigation arrow icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={followMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </button>
        )}

        {/* Main GPS button */}
        <button
          onClick={handleClick}
          title={
            isActive ? 'Stop GPS' :
              isPending ? 'Waiting for permission…' :
                isDenied ? 'Location denied — tap for info' :
                  isError ? 'GPS error — tap to retry' :
                    'Show my location'
          }
          className={buttonClass()}
        >
          {isPending ? <SpinnerIcon /> :
            isDenied || isError ? <ErrorIcon /> :
              <LocationIcon />}
        </button>
      </div>
    </div>
  );
}
