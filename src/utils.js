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

export const calculateElevationGain = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return 0;

  const zs = coordinates
    .map(c => Number(c?.[2]))
    .filter(z => Number.isFinite(z));

  if (zs.length < 2) return 0;

  const start = zs[0];
  const max = Math.max(...zs);
  const floor = max - start; // meters

  const NOISE_FT = 5;
  const M_TO_FT = 3.28084;

  let gainMeters = 0;
  for (let i = 1; i < zs.length; i++) {
    const diff = zs[i] - zs[i - 1]; // meters
    if (diff * M_TO_FT > NOISE_FT) gainMeters += diff;
  }

  const outMeters = Math.max(gainMeters, floor);
  return outMeters * M_TO_FT; // ✅ return FEET
};


export const getElevationProfile = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return [];
  if (!coordinates.some(c => Number.isFinite(Number(c?.[2])))) return [];

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
      elevation: Number(coordinates[i][2]) * 3.28084 // ✅ meters -> feet
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


// Calculate energy cost per meter based on slope (Crowell/Minetti treadmill model Ct)
// Recreational version Cr applies cutoff at i = -0.03 (paper Eq 4)
const calculateEnergyCost = (slope) => {
  // Table 2 parameters (RUNNING) from Crowell paper
  const a = 26.07;     // J/kg·m
  const b = 0.03104;
  const c = 1.381;
  const d = -0.06547;
  const p = 2.181;

  const i0 = -0.03; // recreational cutoff

  // Eq 5 / Appendix treadmill fit
  const Ct = (i) => {
    const num = Math.pow(Math.pow(Math.abs(i), p) + b, 1 / p) + i;
    const den = c + i + d;

    // Avoid divide-by-zero if GPS noise creates pathological i
    const safeDen = Math.abs(den) < 1e-9 ? (den < 0 ? -1e-9 : 1e-9) : den;

    return a * (num / safeDen);
  };

  // Eq 4: recreational cutoff (chop off downhill benefit below -0.03)
  const i = slope;
  if (i < i0) return Ct(i0);
  return Ct(i);
};


// Calculate equivalent flat distance based on energy expenditure
export const calculateEquivalentFlatDistance = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return 0;
  
  let totalEnergy = 0; // in J/kg (joules per kilogram)
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1, elev1] = coordinates[i];
    const [lon2, lat2, elev2] = coordinates[i + 1];
    
    // Calculate 3D distance
    const horizontalDist = haversineDistance(lat1, lon1, lat2, lon2);
    const elevChange = ((elev2 || 0) - (elev1 || 0)) * 3.28084; // meters to feet
    const elevChangeMeters = elevChange / 3.28084;
    const horizontalDistMeters = horizontalDist * 1609.34; // miles to meters
    
    // Calculate slope
    let slope = horizontalDistMeters > 0 ? elevChangeMeters / horizontalDistMeters : 0;
    slope = Math.max(-0.5, Math.min(0.5, slope)); // clamp to avoid GPS/DEM spikes
    
    // Calculate 3D segment distance
    const segmentDist3D = Math.sqrt(horizontalDistMeters ** 2 + elevChangeMeters ** 2);
    
    // Energy cost for this segment (J/kg)
    const energyCost = calculateEnergyCost(slope);
    totalEnergy += energyCost * segmentDist3D;
  }
  
  // Energy cost on flat ground (J/kg·m)
  const flatEnergyCost = calculateEnergyCost(0);
  
  // Equivalent flat distance in meters
  const equivalentMeters = totalEnergy / flatEnergyCost;
  
  // Convert to miles
  return equivalentMeters / 1609.34;
};

// Calculate "climb factor" - fraction of energy devoted to climbing
export const calculateClimbFactor = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return 0;
  
  const horizontalDistance = calculateDistance(coordinates);
  const equivalentDistance = calculateEquivalentFlatDistance(coordinates);
  
  if (equivalentDistance === 0) return 0;
  
  // CF = (E - E0) / E = 1 - (E0 / E)
  // where E0 is energy on flat, E is actual energy
  const climbFactor = 1 - (horizontalDistance / equivalentDistance);
  
  return Math.max(0, Math.min(1, climbFactor)); // Clamp between 0 and 1
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

// Fetch Air Quality Index from Open-Meteo Air Quality API (free, no API key needed)
export const fetchAQI = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5&hourly=us_aqi&timezone=auto&forecast_days=2`
    );
    
    if (!response.ok) throw new Error('AQI fetch failed');
    
    const data = await response.json();
    
    // Get current AQI
    const currentAQI = data.current.us_aqi;
    
    // Get forecast AQI (next 24 hours average)
    const next24Hours = data.hourly.us_aqi.slice(0, 24).filter(v => v !== null);
    const forecastAQI = next24Hours.length > 0 
      ? Math.round(next24Hours.reduce((a, b) => a + b, 0) / next24Hours.length)
      : null;
    
    return {
      current: {
        aqi: Math.round(currentAQI),
        category: getAQICategory(currentAQI),
        pm25: data.current.pm2_5 ? Math.round(data.current.pm2_5) : null,
        pm10: data.current.pm10 ? Math.round(data.current.pm10) : null
      },
      forecast: forecastAQI !== null ? {
        aqi: forecastAQI,
        category: getAQICategory(forecastAQI)
      } : null
    };
  } catch (error) {
    console.error('AQI fetch error:', error);
    return null;
  }
};

// Get AQI category and color based on US EPA standards
const getAQICategory = (aqi) => {
  if (aqi <= 50) return { name: 'Good', color: '#00e400', textColor: '#000' };
  if (aqi <= 100) return { name: 'Moderate', color: '#ffff00', textColor: '#000' };
  if (aqi <= 150) return { name: 'Unhealthy for Sensitive Groups', color: '#ff7e00', textColor: '#000' };
  if (aqi <= 200) return { name: 'Unhealthy', color: '#ff0000', textColor: '#fff' };
  if (aqi <= 300) return { name: 'Very Unhealthy', color: '#8f3f97', textColor: '#fff' };
  return { name: 'Hazardous', color: '#7e0023', textColor: '#fff' };
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
