import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Mountain, TrendingUp, MapPin, Cloud, Wind, Droplets, Calendar, Activity } from 'lucide-react';
import { getElevationProfile, fetchWeather, fetchAQI } from '../utils';

export default function Sidebar({ track, onClose, onCursorPosition, mapHoverIndex }) {
  const [weather, setWeather] = useState(null);
  const [aqi, setAqi] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingAQI, setLoadingAQI] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  // Handle elevation graph hover
  const handleChartMouseMove = (data) => {
    if (data && data.activeTooltipIndex !== undefined) {
      setHoveredPoint(data.activeTooltipIndex);
      if (onCursorPosition) {
        onCursorPosition(data.activeTooltipIndex);
      }
    }
  };
  
  const handleChartMouseLeave = () => {
    setHoveredPoint(null);
    if (onCursorPosition) {
      onCursorPosition(null);
    }
  };
  
  useEffect(() => {
    if (track) {
      setLoadingWeather(true);
      setLoadingAQI(true);
      
      const center = track.geometry.type === 'LineString' 
        ? track.geometry.coordinates[Math.floor(track.geometry.coordinates.length / 2)]
        : track.geometry.coordinates[0][Math.floor(track.geometry.coordinates[0].length / 2)];
      
      // Fetch weather
      fetchWeather(center[1], center[0])
        .then(data => {
          setWeather(data);
          setLoadingWeather(false);
        })
        .catch(() => setLoadingWeather(false));
      
      // Fetch AQI
      fetchAQI(center[1], center[0])
        .then(data => {
          setAqi(data);
          setLoadingAQI(false);
        })
        .catch(() => setLoadingAQI(false));
    }
  }, [track]);
  
  if (!track) return null;
  
  const coords = track.geometry.type === 'LineString' 
    ? track.geometry.coordinates 
    : track.geometry.coordinates[0];
  
  const elevationProfile = getElevationProfile(coords);
  const hasElevation = elevationProfile.length > 0 && elevationProfile[0].elevation !== 0;
  
  return (
    <div className="w-full lg:w-96 h-full bg-[var(--bg-secondary)] border-l border-[var(--border-color)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)] z-10">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-display font-bold text-[var(--accent-primary)]">
            {track.properties.name || 'Unnamed Track'}
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {track.properties.description && (
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            {track.properties.description}
          </p>
        )}
      </div>
      
      {/* Stats Grid */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="sidebar-section">
            <div className="flex items-center gap-2 mb-2">
              <Mountain className="w-4 h-4 text-[var(--accent-primary)]" />
              <div className="stat-label">Distance</div>
            </div>
            <div className="stat-value">
              {track.properties.distance?.toFixed(2) || '0'} mi
            </div>
          </div>
          
          <div className="sidebar-section">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
              <div className="stat-label">Elevation Gain</div>
            </div>
            <div className="stat-value">
              {track.properties.elevationGain?.toFixed(0) || '0'} ft
            </div>
          </div>
        </div>
        
        {/* Location Info */}
        {track.properties.location && (
          <div className="sidebar-section">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
              <div className="stat-label">Location</div>
            </div>
            <div className="text-[var(--text-primary)] font-medium">
              {track.properties.location}
            </div>
          </div>
        )}
        
        {/* Elevation Profile */}
        {hasElevation && (
          <div className="sidebar-section">
            <h3 className="text-lg font-display font-semibold mb-4 text-[var(--accent-primary)]">
              Elevation Profile
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart 
                data={elevationProfile}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                <XAxis 
                  dataKey="distance" 
                  stroke="var(--text-secondary)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  label={{ value: 'Distance (mi)', position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)' }}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  label={{ value: 'Elevation (ft)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
                  tickFormatter={(value) => Math.round(value)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                  formatter={(value) => [`${Math.round(value)} ft`, 'Elevation']}
                  labelFormatter={(value) => `${value.toFixed(2)} mi`}
                />
                <Line 
                  type="monotone" 
                  dataKey="elevation" 
                  stroke="var(--accent-primary)" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
                />
                {mapHoverIndex !== null && elevationProfile[mapHoverIndex] && (
                  <ReferenceDot
                    x={elevationProfile[mapHoverIndex].distance}
                    y={elevationProfile[mapHoverIndex].elevation}
                    r={8}
                    fill="var(--accent-primary)"
                    stroke="#fff"
                    strokeWidth={3}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Weather Section */}
        <div className="sidebar-section">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">
              Weather Conditions
            </h3>
          </div>
          
          {loadingWeather && (
            <div className="text-[var(--text-secondary)] text-center py-4 loading-pulse">
              Loading weather...
            </div>
          )}
          
          {!loadingWeather && weather && (
            <>
              {/* Current Weather */}
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                <div className="text-[var(--text-secondary)] text-sm mb-2">Current Conditions</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-display font-bold text-[var(--accent-primary)]">
                      {weather.current.temp}°F
                    </div>
                    <div className="text-[var(--text-secondary)] mt-1">
                      {weather.current.condition}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-1">
                      <Wind className="w-4 h-4" />
                      {weather.current.windSpeed} mph
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 5-Day Forecast */}
              <div className="text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                5-Day Forecast
              </div>
              <div className="space-y-2">
                {weather.forecast.map((day, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-[var(--bg-tertiary)] rounded-lg"
                  >
                    <div className="text-[var(--text-primary)] font-medium w-16">
                      {day.date}
                    </div>
                    <div className="text-[var(--text-secondary)] text-sm flex-1">
                      {day.condition}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[var(--accent-primary)] font-semibold">
                        {day.high}°
                      </div>
                      <div className="text-[var(--text-secondary)]">
                        {day.low}°
                      </div>
                      {day.precip > 0 && (
                        <div className="flex items-center gap-1 text-[var(--text-secondary)] text-xs">
                          <Droplets className="w-3 h-3" />
                          {day.precip.toFixed(1)}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {!loadingWeather && !weather && (
            <div className="text-[var(--text-secondary)] text-center py-4">
              Weather data unavailable
            </div>
          )}
        </div>
        
        {/* Air Quality Section */}
        <div className="sidebar-section">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">
              Air Quality
            </h3>
          </div>
          
          {loadingAQI && (
            <div className="text-[var(--text-secondary)] text-center py-4 loading-pulse">
              Loading air quality...
            </div>
          )}
          
          {!loadingAQI && aqi && (
            <>
              {/* Current AQI */}
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                <div className="text-[var(--text-secondary)] text-sm mb-3">Current Air Quality Index</div>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center font-display font-bold text-2xl"
                    style={{ 
                      backgroundColor: aqi.current.category.color,
                      color: aqi.current.category.textColor
                    }}
                  >
                    {aqi.current.aqi}
                  </div>
                  <div className="flex-1">
                    <div className="text-[var(--text-primary)] font-semibold mb-1">
                      {aqi.current.category.name}
                    </div>
                    {aqi.current.pm25 && (
                      <div className="text-[var(--text-secondary)] text-sm">
                        PM2.5: {aqi.current.pm25} µg/m³
                      </div>
                    )}
                    {aqi.current.pm10 && (
                      <div className="text-[var(--text-secondary)] text-sm">
                        PM10: {aqi.current.pm10} µg/m³
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Forecast AQI */}
              {aqi.forecast && (
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-[var(--text-secondary)] text-sm mb-3">24-Hour Forecast</div>
                  <div className="flex items-center justify-between">
                    <div className="text-[var(--text-primary)] font-medium">
                      Expected AQI
                    </div>
                    <div className="flex items-center gap-3">
                      <div 
                        className="px-3 py-1 rounded-full font-display font-bold"
                        style={{ 
                          backgroundColor: aqi.forecast.category.color,
                          color: aqi.forecast.category.textColor
                        }}
                      >
                        {aqi.forecast.aqi}
                      </div>
                      <div className="text-[var(--text-secondary)] text-sm">
                        {aqi.forecast.category.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          {!loadingAQI && !aqi && (
            <div className="text-[var(--text-secondary)] text-center py-4">
              Air quality data unavailable
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
