// Calculate total distance from coordinates (in miles)
export const calculateDistance = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(
      coordinates[i][1], coordinates[i][0],
      coordinates[i + 1][1], coordinates[i + 1][0]
    );
  }
  return total;
};

// Haversine formula for distance between two points
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees) => degrees * (Math.PI / 180);

// Calculate elevation gain from coordinates with elevation data
export const calculateElevationGain = (coordinates) => {
  if (!coordinates || coordinates.length < 2 || !coordinates[0][2]) return 0;
  
  let gain = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const diff = (coordinates[i][2] - coordinates[i - 1][2]) * 3.28084; // Convert meters to feet
    if (diff > 0) gain += diff;
  }
  return gain;
};

// Get elevation profile data for chart
export const getElevationProfile = (coordinates) => {
  if (!coordinates || coordinates.length < 2 || !coordinates[0][2]) return [];
  
  let distance = 0;
  const profile = [];
  
  for (let i = 0; i < coordinates.length; i++) {
    if (i > 0) {
      distance += haversineDistance(
        coordinates[i - 1][1], coordinates[i - 1][0],
        coordinates[i][1], coordinates[i][0]
      );
    }
    
    profile.push({
      distance: distance,
      elevation: coordinates[i][2] * 3.28084 // Convert meters to feet
    });
  }
  
  return profile;
};

// Get center point of track
export const getTrackCenter = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return [0, 0];
  
  const lats = coordinates.map(c => c[1]);
  const lons = coordinates.map(c => c[0]);
  
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2
  ];
};

// Fetch weather data from Open-Meteo API (free, no API key needed)
export const fetchWeather = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`
    );
    
    if (!response.ok) throw new Error('Weather fetch failed');
    
    const data = await response.json();
    return {
      current: {
        temp: Math.round(data.current.temperature_2m),
        condition: getWeatherCondition(data.current.weathercode),
        windSpeed: Math.round(data.current.windspeed_10m)
      },
      forecast: data.daily.time.slice(0, 5).map((date, i) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
        condition: getWeatherCondition(data.daily.weathercode[i]),
        precip: data.daily.precipitation_sum[i]
      }))
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
};

// Convert WMO weather codes to readable conditions
const getWeatherCondition = (code) => {
  const conditions = {
    0: 'Clear',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm',
    99: 'Thunderstorm'
  };
  return conditions[code] || 'Unknown';
};
