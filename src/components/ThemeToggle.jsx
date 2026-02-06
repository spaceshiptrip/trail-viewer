import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-primary)] theme-toggle-button"
      style={{
        backgroundColor: theme === 'dark' ? 'var(--bg-tertiary)' : '#e5e7eb'
      }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* Sliding circle */}
      <div
        className="absolute top-1 left-1 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center"
        style={{
          backgroundColor: theme === 'dark' ? 'var(--accent-primary)' : '#fbbf24',
          transform: theme === 'dark' ? 'translateX(0)' : 'translateX(32px)'
        }}
      >
        {theme === 'dark' ? (
          <Moon className="w-4 h-4 text-black" />
        ) : (
          <Sun className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* Background icons */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <Moon 
          className="w-4 h-4 transition-opacity duration-300" 
          style={{ 
            color: theme === 'dark' ? 'var(--text-secondary)' : '#9ca3af',
            opacity: theme === 'dark' ? 0.3 : 0.5
          }}
        />
        <Sun 
          className="w-4 h-4 transition-opacity duration-300" 
          style={{ 
            color: theme === 'dark' ? 'var(--text-secondary)' : '#9ca3af',
            opacity: theme === 'dark' ? 0.5 : 0.3
          }}
        />
      </div>
    </button>
  );
}
