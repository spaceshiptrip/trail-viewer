import { useEffect, useRef, useCallback, useState } from "react";
import { useMap, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// ─── AQI US category helper ───────────────────────────────────────────────────
// EPA breakpoints: Good / Moderate / USG / Unhealthy / Very Unhealthy / Hazardous
const AQI_CATEGORIES = [
  { max:  50, label: "Good",            color: [  0, 228,   0] },
  { max: 100, label: "Moderate",        color: [255, 255,   0] },
  { max: 150, label: "Unhealthy (SG)",  color: [255, 126,   0] },
  { max: 200, label: "Unhealthy",       color: [255,   0,   0] },
  { max: 300, label: "Very Unhealthy",  color: [143,  63, 151] },
  { max: 500, label: "Hazardous",       color: [126,   0,  35] },
];

function aqiCategory(aqi) {
  for (const cat of AQI_CATEGORIES) {
    if (aqi <= cat.max) return cat;
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

// ─── Color scales ─────────────────────────────────────────────────────────────
// Temperature stops in °C (raw API unit). AQI stops are raw AQI index values.

const SCALES = {
  temperature: {
    label: "Temperature", unit: "°F",
    stops: [
      [-40, [ 80,   0, 120, 200]],
      [-20, [ 40,  40, 200, 200]],
      [ -5, [ 50, 130, 240, 195]],
      [  5, [ 60, 200, 180, 190]],
      [ 10, [100, 210, 100, 185]],
      [ 15, [180, 230,  60, 185]],
      [ 20, [255, 220,   0, 190]],
      [ 25, [255, 150,   0, 195]],
      [ 30, [255,  70,   0, 200]],
      [ 35, [210,   0,   0, 205]],
      [ 40, [130,   0,   0, 210]],
    ],
    toDisplay: (c) => Math.round((c * 9) / 5 + 32),
    legendFmt: (c) => `${Math.round((c * 9) / 5 + 32)}°F`,
  },
  precipitation: {
    label: "Precipitation", unit: "mm/h",
    stops: [
      [0,    [100, 180, 255,   0]],
      [0.05, [100, 200, 255,  40]],
      [0.2,  [ 60, 160, 255, 100]],
      [0.5,  [ 30, 100, 255, 140]],
      [1,    [  0,  60, 200, 160]],
      [2,    [  0, 200, 100, 170]],
      [5,    [255, 220,   0, 180]],
      [10,   [255, 100,   0, 190]],
      [20,   [200,   0,   0, 200]],
    ],
    toDisplay: (v) => v.toFixed(1),
    legendFmt: (v) => `${v}mm/h`,
  },
  windspeed: {
    label: "Wind Speed", unit: "mph",
    stops: [
      [  0,  [200, 230, 255,   0]],
      [  8,  [160, 210, 255,  60]],
      [ 16,  [100, 200, 255, 100]],
      [ 32,  [ 60, 240, 180, 130]],
      [ 48,  [255, 230,  60, 150]],
      [ 72,  [255, 140,   0, 170]],
      [ 97,  [220,  30,  30, 185]],
      [129,  [140,   0, 140, 200]],
    ],
    toDisplay: (v) => Math.round(v * 0.621371),
    legendFmt: (v) => `${Math.round(v * 0.621371)}mph`,
  },
  cloudcover: {
    label: "Cloud Cover", unit: "%",
    stops: [
      [  0, [200, 230, 255,   0]],
      [ 10, [220, 235, 255,  20]],
      [ 30, [200, 215, 240,  60]],
      [ 50, [180, 195, 220,  90]],
      [ 70, [160, 170, 195, 120]],
      [ 85, [140, 145, 165, 150]],
      [100, [120, 125, 140, 175]],
    ],
    toDisplay: (v) => Math.round(v),
    legendFmt: (v) => `${v}%`,
  },
  // AQI — stops follow US EPA breakpoints exactly
  aqi: {
    label: "Air Quality (US AQI)", unit: "",
    stops: [
      [  0, [  0, 228,   0,   0]],   // 0    — transparent (no data)
      [  1, [  0, 228,   0, 140]],   // 1+   — Good (green)
      [ 51, [255, 255,   0, 160]],   // Moderate (yellow)
      [101, [255, 126,   0, 175]],   // Unhealthy for SG (orange)
      [151, [255,   0,   0, 185]],   // Unhealthy (red)
      [201, [143,  63, 151, 195]],   // Very Unhealthy (purple)
      [301, [126,   0,  35, 210]],   // Hazardous (maroon)
      [500, [ 80,   0,  20, 220]],
    ],
    toDisplay: (v) => Math.round(v),
    legendFmt: (v) => {
      if (v <=  50) return `${v} Good`;
      if (v <= 100) return `${v} Mod`;
      if (v <= 150) return `${v} USG`;
      if (v <= 200) return `${v} Unhlthy`;
      if (v <= 300) return `${v} V.Unhlthy`;
      return `${v} Hazardous`;
    },
  },
};

// ─── IDW interpolation ────────────────────────────────────────────────────────

function idwInterpolate(px, py, points, power = 2.5) {
  let weightedSum = 0, weightTotal = 0;
  for (const pt of points) {
    const dx = px - pt.x, dy = py - pt.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < 0.00001) return pt.value;
    const w = 1 / Math.pow(dist2, power / 2);
    weightedSum += w * pt.value;
    weightTotal += w;
  }
  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

function colorFromScale(value, stops) {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i], [v1, c1] = stops[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return [
        Math.round(c0[0] + t * (c1[0] - c0[0])),
        Math.round(c0[1] + t * (c1[1] - c0[1])),
        Math.round(c0[2] + t * (c1[2] - c0[2])),
        Math.round(c0[3] + t * (c1[3] - c0[3])),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function tempToRGB(tempC) {
  const [r, g, b] = colorFromScale(tempC ?? 15, SCALES.temperature.stops);
  return { r, g, b, css: `rgb(${r},${g},${b})` };
}

// Spread (°C range across ensemble members) → uncertainty color
// Low spread = transparent, high spread = dark semi-opaque overlay
function spreadToUncertaintyAlpha(spreadC) {
  // Typical ensemble spread: 0–8°C range. Above 5°C = highly uncertain.
  if (spreadC <= 0.5) return 0;
  if (spreadC >= 6)   return 130;
  return Math.round((spreadC - 0.5) / 5.5 * 130);
}

// ─── Open-Meteo APIs ──────────────────────────────────────────────────────────

const OM_FORECAST  = "https://api.open-meteo.com/v1/forecast";
const OM_AQI       = "https://air-quality-api.open-meteo.com/v1/air-quality";
const OM_ENSEMBLE  = "https://ensemble-api.open-meteo.com/v1/ensemble";

async function fetchWeatherPoints(gridPoints, includeAqi) {
  const lats = gridPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = gridPoints.map((p) => p.lon.toFixed(4)).join(",");
  const hourIndex = new Date().getHours();

  // Forecast fetch (always)
  const fParams = new URLSearchParams({
    latitude: lats, longitude: lons,
    hourly: "temperature_2m,precipitation,windspeed_10m,cloudcover",
    forecast_days: "1", timezone: "auto",
  });
  const fRes = await fetch(`${OM_FORECAST}?${fParams}`);
  if (!fRes.ok) throw new Error(`Forecast error: ${fRes.status}`);
  const fData = await fRes.json();
  const fLocs = Array.isArray(fData) ? fData : [fData];

  // AQI fetch (only when layer is active)
  let aqiLocs = null;
  if (includeAqi) {
    const aParams = new URLSearchParams({
      latitude: lats, longitude: lons,
      hourly: "us_aqi",
      forecast_days: "1", timezone: "auto",
    });
    const aRes = await fetch(`${OM_AQI}?${aParams}`);
    if (aRes.ok) {
      const aData = await aRes.json();
      aqiLocs = Array.isArray(aData) ? aData : [aData];
    }
  }

  return fLocs.map((loc, i) => ({
    lat: gridPoints[i].lat,
    lon: gridPoints[i].lon,
    temperature:   loc.hourly?.temperature_2m?.[hourIndex]  ?? null,
    precipitation: loc.hourly?.precipitation?.[hourIndex]   ?? null,
    windspeed:     loc.hourly?.windspeed_10m?.[hourIndex]   ?? null,
    cloudcover:    loc.hourly?.cloudcover?.[hourIndex]      ?? null,
    aqi:           aqiLocs?.[i]?.hourly?.us_aqi?.[hourIndex] ?? null,
  }));
}

// Fetch ensemble spread for grid points — returns [{lat,lon,spreadC}]
async function fetchEnsembleSpread(gridPoints) {
  if (gridPoints.length === 0) return [];
  const lats = gridPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = gridPoints.map((p) => p.lon.toFixed(4)).join(",");
  const hourIndex = new Date().getHours();
  try {
    const params = new URLSearchParams({
      latitude: lats, longitude: lons,
      hourly: "temperature_2m",
      models: "gfs_seamless",
      forecast_days: "1", timezone: "auto",
    });
    const res = await fetch(`${OM_ENSEMBLE}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const locs = Array.isArray(data) ? data : [data];

    return locs.map((loc, i) => {
      // Ensemble members come back as temperature_2m_member01, _member02, …
      const memberKeys = Object.keys(loc.hourly ?? {}).filter((k) =>
        k.startsWith("temperature_2m_member")
      );
      if (memberKeys.length === 0) return { lat: gridPoints[i].lat, lon: gridPoints[i].lon, spreadC: 0 };
      const vals = memberKeys
        .map((k) => loc.hourly[k]?.[hourIndex])
        .filter((v) => v != null);
      const spread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
      return { lat: gridPoints[i].lat, lon: gridPoints[i].lon, spreadC: spread,
               minF: vals.length ? Math.round((Math.min(...vals) * 9/5) + 32) : null,
               maxF: vals.length ? Math.round((Math.max(...vals) * 9/5) + 32) : null,
               memberCount: vals.length };
    });
  } catch {
    return [];
  }
}

// Fetch rich pill data including AQI and ensemble range
async function fetchPillData(pillPoints, includeAqi, includeEnsemble) {
  if (pillPoints.length === 0) return [];
  const lats = pillPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = pillPoints.map((p) => p.lon.toFixed(4)).join(",");
  const hourIndex = new Date().getHours();

  const fParams = new URLSearchParams({
    latitude: lats, longitude: lons,
    hourly: "temperature_2m,precipitation_probability,windspeed_10m,cloudcover",
    daily: "temperature_2m_max,temperature_2m_min",
    forecast_days: "1", timezone: "auto",
  });
  const fRes = await fetch(`${OM_FORECAST}?${fParams}`);
  if (!fRes.ok) throw new Error(`Pill forecast error: ${fRes.status}`);
  const fData = await fRes.json();
  const fLocs = Array.isArray(fData) ? fData : [fData];

  // AQI for pills
  let aqiLocs = null;
  if (includeAqi) {
    try {
      const aParams = new URLSearchParams({
        latitude: lats, longitude: lons,
        hourly: "us_aqi", forecast_days: "1", timezone: "auto",
      });
      const aRes = await fetch(`${OM_AQI}?${aParams}`);
      if (aRes.ok) { const d = await aRes.json(); aqiLocs = Array.isArray(d) ? d : [d]; }
    } catch {}
  }

  // Ensemble range for pills
  let ensembleLocs = null;
  if (includeEnsemble) {
    try {
      const eParams = new URLSearchParams({
        latitude: lats, longitude: lons,
        hourly: "temperature_2m", models: "gfs_seamless",
        forecast_days: "1", timezone: "auto",
      });
      const eRes = await fetch(`${OM_ENSEMBLE}?${eParams}`);
      if (eRes.ok) { const d = await eRes.json(); ensembleLocs = Array.isArray(d) ? d : [d]; }
    } catch {}
  }

  return fLocs.map((loc, i) => {
    const h = loc.hourly, d = loc.daily;
    const tempC = h?.temperature_2m?.[hourIndex] ?? null;
    const highC = d?.temperature_2m_max?.[0] ?? null;
    const lowC  = d?.temperature_2m_min?.[0] ?? null;

    const hours = [];
    for (let offset = 0; offset < 8; offset++) {
      const idx = Math.min(hourIndex + offset, 23);
      const t = new Date(); t.setHours(hourIndex + offset, 0, 0, 0);
      hours.push({
        time: t.toLocaleTimeString([], { hour: "numeric" }),
        tempF: h?.temperature_2m?.[idx] != null ? Math.round((h.temperature_2m[idx] * 9) / 5 + 32) : null,
        precipPct: h?.precipitation_probability?.[idx] ?? null,
        windMph: h?.windspeed_10m?.[idx] != null ? Math.round(h.windspeed_10m[idx] * 0.621371) : null,
        cloud: h?.cloudcover?.[idx] ?? null,
      });
    }

    // Ensemble range at current hour
    let ensembleRange = null;
    if (ensembleLocs?.[i]) {
      const eLoc = ensembleLocs[i];
      const memberKeys = Object.keys(eLoc.hourly ?? {}).filter((k) => k.startsWith("temperature_2m_member"));
      const vals = memberKeys.map((k) => eLoc.hourly[k]?.[hourIndex]).filter((v) => v != null);
      if (vals.length > 1) {
        ensembleRange = {
          minF: Math.round((Math.min(...vals) * 9/5) + 32),
          maxF: Math.round((Math.max(...vals) * 9/5) + 32),
          spreadF: Math.round(((Math.max(...vals) - Math.min(...vals)) * 9/5)),
          members: vals.length,
          confidence: vals.length > 0
            ? (Math.max(...vals) - Math.min(...vals)) < 2 ? "High"
            : (Math.max(...vals) - Math.min(...vals)) < 5 ? "Medium" : "Low"
            : null,
        };
      }
    }

    const currentAqi = aqiLocs?.[i]?.hourly?.us_aqi?.[hourIndex] ?? null;

    return {
      lat: pillPoints[i].lat, lon: pillPoints[i].lon,
      label: pillPoints[i].label, kind: pillPoints[i].kind, tempC,
      current: {
        tempF: tempC != null ? Math.round((tempC * 9) / 5 + 32) : null,
        precipPct: h?.precipitation_probability?.[hourIndex] ?? null,
        windMph: h?.windspeed_10m?.[hourIndex] != null ? Math.round(h.windspeed_10m[hourIndex] * 0.621371) : null,
        cloud: h?.cloudcover?.[hourIndex] ?? null,
        aqi: currentAqi,
        aqiCat: currentAqi != null ? aqiCategory(currentAqi) : null,
      },
      daily: {
        highF: highC != null ? Math.round((highC * 9) / 5 + 32) : null,
        lowF:  lowC  != null ? Math.round((lowC  * 9) / 5 + 32) : null,
      },
      hours, ensembleRange,
    };
  });
}

// ─── Major US cities ──────────────────────────────────────────────────────────

const CITIES = [
  { label: "Los Angeles",    lat: 34.0522,  lon: -118.2437 },
  { label: "San Francisco",  lat: 37.7749,  lon: -122.4194 },
  { label: "San Diego",      lat: 32.7157,  lon: -117.1611 },
  { label: "Las Vegas",      lat: 36.1699,  lon: -115.1398 },
  { label: "Phoenix",        lat: 33.4484,  lon: -112.0740 },
  { label: "Seattle",        lat: 47.6062,  lon: -122.3321 },
  { label: "Portland",       lat: 45.5051,  lon: -122.6750 },
  { label: "Denver",         lat: 39.7392,  lon: -104.9903 },
  { label: "Salt Lake City", lat: 40.7608,  lon: -111.8910 },
  { label: "Albuquerque",    lat: 35.0844,  lon: -106.6504 },
  { label: "New York",       lat: 40.7128,  lon:  -74.0060 },
  { label: "Chicago",        lat: 41.8781,  lon:  -87.6298 },
  { label: "Houston",        lat: 29.7604,  lon:  -95.3698 },
  { label: "Dallas",         lat: 32.7767,  lon:  -96.7970 },
  { label: "Miami",          lat: 25.7617,  lon:  -80.1918 },
  { label: "Atlanta",        lat: 33.7490,  lon:  -84.3880 },
  { label: "Boston",         lat: 42.3601,  lon:  -71.0589 },
  { label: "Washington DC",  lat: 38.9072,  lon:  -77.0369 },
  { label: "Minneapolis",    lat: 44.9778,  lon:  -93.2650 },
  { label: "Kansas City",    lat: 39.0997,  lon:  -94.5786 },
  { label: "Nashville",      lat: 36.1627,  lon:  -86.7816 },
  { label: "New Orleans",    lat: 29.9511,  lon:  -90.0715 },
  { label: "Detroit",        lat: 42.3314,  lon:  -83.0458 },
  { label: "Pittsburgh",     lat: 40.4406,  lon:  -79.9959 },
  { label: "Philadelphia",   lat: 39.9526,  lon:  -75.1652 },
  { label: "Tucson",         lat: 32.2226,  lon: -110.9747 },
  { label: "Fresno",         lat: 36.7378,  lon: -119.7871 },
  { label: "Sacramento",     lat: 38.5816,  lon: -121.4944 },
  { label: "Reno",           lat: 39.5296,  lon: -119.8138 },
  { label: "Boise",          lat: 43.6150,  lon: -116.2023 },
  { label: "Spokane",        lat: 47.6588,  lon: -117.4260 },
  { label: "Anchorage",      lat: 61.2181,  lon: -149.9003 },
  { label: "Honolulu",       lat: 21.3069,  lon: -157.8583 },
];

// ─── Canvas renderers ─────────────────────────────────────────────────────────

function renderWeatherCanvas(canvas, map, weatherData, activeLayer) {
  const ctx = canvas.getContext("2d");
  const size = map.getSize();
  canvas.width = size.x; canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);
  if (!weatherData?.length) return;
  const scale = SCALES[activeLayer];
  if (!scale) return;

  const points = weatherData
    .filter((d) => d[activeLayer] != null)
    .map((d) => { const pt = map.latLngToContainerPoint([d.lat, d.lon]); return { x: pt.x, y: pt.y, value: d[activeLayer] }; });
  if (points.length < 2) return;

  const SF = 4, w = Math.ceil(size.x / SF), h = Math.ceil(size.y / SF);
  const off = document.createElement("canvas"); off.width = w; off.height = h;
  const offCtx = off.getContext("2d");
  const img = offCtx.createImageData(w, h); const px = img.data;
  const sc = points.map((p) => ({ x: p.x / SF, y: p.y / SF, value: p.value }));

  for (let py = 0; py < h; py++) {
    for (let px2 = 0; px2 < w; px2++) {
      const v = idwInterpolate(px2, py, sc, 2.5);
      const [r, g, b, a] = colorFromScale(v, scale.stops);
      const i = (py * w + px2) * 4;
      px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = a;
    }
  }
  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, size.x, size.y);
}

function renderEnsembleCanvas(canvas, map, spreadData) {
  const ctx = canvas.getContext("2d");
  const size = map.getSize();
  canvas.width = size.x; canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);
  if (!spreadData?.length) return;

  const points = spreadData
    .filter((d) => d.spreadC != null)
    .map((d) => { const pt = map.latLngToContainerPoint([d.lat, d.lon]); return { x: pt.x, y: pt.y, value: d.spreadC }; });
  if (points.length < 2) return;

  const SF = 4, w = Math.ceil(size.x / SF), h = Math.ceil(size.y / SF);
  const off = document.createElement("canvas"); off.width = w; off.height = h;
  const offCtx = off.getContext("2d");
  const img = offCtx.createImageData(w, h); const px = img.data;
  const sc = points.map((p) => ({ x: p.x / SF, y: p.y / SF, value: p.value }));

  for (let py = 0; py < h; py++) {
    for (let px2 = 0; px2 < w; px2++) {
      const spread = idwInterpolate(px2, py, sc, 2.5);
      const alpha = spreadToUncertaintyAlpha(spread);
      const i = (py * w + px2) * 4;
      // Uncertainty = dark gray-brown hatching overlay
      px[i] = 40; px[i+1] = 30; px[i+2] = 20; px[i+3] = alpha;
    }
  }
  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, size.x, size.y);
}

// ─── Trail uncertainty band ───────────────────────────────────────────────────

function TrailUncertaintyBand({ selectedTrack, ensembleSpread, visible }) {
  if (!visible || !selectedTrack?.geometry || !ensembleSpread?.length) return null;

  const coords =
    selectedTrack.geometry.type === "LineString"
      ? selectedTrack.geometry.coordinates
      : selectedTrack.geometry.coordinates[0];

  if (coords.length < 2) return null;

  // Compute average spread along trail coords (nearest ensemble point)
  const avgSpread = ensembleSpread.reduce((s, p) => s + p.spreadC, 0) / ensembleSpread.length;
  const alpha = spreadToUncertaintyAlpha(avgSpread) / 255;

  // Uncertainty band = wider semi-transparent polyline behind the trail
  const positions = coords.map((c) => [c[1], c[0]]);
  const bandWidth = 6 + Math.round(alpha * 18); // 6–24px depending on spread

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: `rgba(255, 180, 0, ${Math.min(alpha * 1.5, 0.55)})`,
        weight: bandWidth,
        lineCap: "round",
        lineJoin: "round",
        dashArray: null,
      }}
      interactive={false}
    />
  );
}

// ─── Pill icon ────────────────────────────────────────────────────────────────

function makePillIcon(pill, activeLayer) {
  const isTrail = pill.kind?.startsWith("trail");

  let bgCss, textColor, labelText;

  if (activeLayer === "aqi" && pill.current.aqi != null) {
    const cat = pill.current.aqiCat;
    const [r, g, b] = cat.color;
    bgCss = `rgb(${r},${g},${b})`;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    textColor = lum > 0.55 ? "rgba(0,0,0,0.85)" : "#fff";
    labelText = `AQI ${pill.current.aqi}`;
  } else {
    const { r, g, b, css } = tempToRGB(pill.tempC ?? 15);
    bgCss = css;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    textColor = lum > 0.55 ? "rgba(0,0,0,0.85)" : "#fff";
    labelText = pill.current.tempF != null ? `${pill.current.tempF}°F` : "—";
  }

  const border = isTrail ? "2px solid rgba(90,184,135,0.95)" : "1.5px solid rgba(255,255,255,0.3)";
  const prefix = pill.kind === "trail-start" ? "▶ " : pill.kind === "trail-end" ? "⏹ " : pill.kind === "trail-mid" ? "◉ " : "";

  const html = `<div style="background:${bgCss};border:${border};border-radius:20px;padding:3px 9px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;font-weight:700;color:${textColor};white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:inline-flex;align-items:center;gap:2px;cursor:pointer;">${prefix}${labelText}</div>`;

  const w = isTrail ? 88 : activeLayer === "aqi" ? 76 : 62;
  return L.divIcon({ className: "", html, iconSize: [w, 24], iconAnchor: [w / 2, 12], popupAnchor: [0, -18] });
}

// ─── Pill popup ───────────────────────────────────────────────────────────────

function PillPopup({ pill }) {
  const { label, kind, current, daily, hours, ensembleRange } = pill;
  const kindLabel = kind === "trail-start" ? "Trail Start" : kind === "trail-mid" ? "Trail Midpoint" : kind === "trail-end" ? "Trail End" : null;
  const skyIcon = (pct) => pct == null ? "—" : pct < 20 ? "☀️" : pct < 50 ? "⛅" : pct < 80 ? "🌥️" : "☁️";
  const confidenceColor = { High: "#5ab887", Medium: "#f5a623", Low: "#e05252" };

  return (
    <div style={{ fontFamily: "ui-sans-serif,system-ui,sans-serif", minWidth: 220, maxWidth: 260 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{label}</div>
        {kindLabel && <div style={{ fontSize: 11, color: "#5ab887", fontWeight: 600, marginTop: 1 }}>{kindLabel}</div>}
      </div>

      {/* Current stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 12px", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Now</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>{current.tempF != null ? `${current.tempF}°F` : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>H / L today</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginTop: 2 }}>{daily.highF != null ? `${daily.highF}°` : "—"} / {daily.lowF != null ? `${daily.lowF}°` : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Rain chance</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4a90d9", marginTop: 2 }}>{current.precipPct != null ? `${current.precipPct}%` : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Wind</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginTop: 2 }}>{current.windMph != null ? `${current.windMph} mph` : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sky</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginTop: 2 }}>{skyIcon(current.cloud)}&nbsp;{current.cloud != null ? `${current.cloud}%` : "—"}</div>
        </div>
        {/* AQI cell */}
        {current.aqi != null && (
          <div>
            <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>US AQI</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: `rgb(${current.aqiCat.color.join(",")})`, textShadow: "0 0 2px rgba(0,0,0,0.2)" }}>
              {current.aqi} <span style={{ fontSize: 10, fontWeight: 600 }}>{current.aqiCat.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Ensemble range */}
      {ensembleRange && (
        <div style={{ background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.25)", borderRadius: 8, padding: "7px 10px", marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#b8860b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, fontWeight: 700 }}>
            🎲 Ensemble Forecast ({ensembleRange.members} models)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#555" }}>Range</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#333" }}>{ensembleRange.minF}° – {ensembleRange.maxF}°F</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#555" }}>Spread</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#333" }}>{ensembleRange.spreadF}°F</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#999" }}>Confidence</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: confidenceColor[ensembleRange.confidence] ?? "#888" }}>
                {ensembleRange.confidence}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8-hour strip */}
      <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Next 8 hours</div>
      <div style={{ display: "flex", gap: 3 }}>
        {hours.map((h, i) => (
          <div key={i} style={{ flex: "1 1 0", background: i === 0 ? "rgba(90,184,135,0.1)" : "rgba(0,0,0,0.04)", border: i === 0 ? "1px solid rgba(90,184,135,0.3)" : "1px solid transparent", borderRadius: 6, padding: "4px 3px", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: "#bbb", marginBottom: 2 }}>{h.time}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>{h.tempF != null ? `${h.tempF}°` : "—"}</div>
            <div style={{ fontSize: 8, color: "#4a90d9", marginTop: 1 }}>{h.precipPct != null ? `${h.precipPct}%` : ""}</div>
            <div style={{ fontSize: 8, color: "#888" }}>{h.windMph != null ? `${h.windMph}mph` : ""}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: "#ccc", marginTop: 7, textAlign: "right" }}>Open-Meteo · free &amp; no API key</div>
    </div>
  );
}

// ─── Temp pills layer ─────────────────────────────────────────────────────────

function TempPills({ visible, pillData, activeLayer }) {
  if (!visible || !pillData?.length) return null;
  return (
    <>
      {pillData.map((pill, i) => (
        <Marker key={`pill-${i}-${pill.label}-${pill.kind}`} position={[pill.lat, pill.lon]}
          icon={makePillIcon(pill, activeLayer)} zIndexOffset={pill.kind?.startsWith("trail") ? 600 : 100}>
          <Popup minWidth={230} maxWidth={270}><PillPopup pill={pill} /></Popup>
        </Marker>
      ))}
    </>
  );
}

// ─── AQI category legend chips ────────────────────────────────────────────────

function AqiChips() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
      {AQI_CATEGORIES.map((cat) => (
        <div key={cat.label} style={{
          background: `rgb(${cat.color.join(",")})`,
          borderRadius: 4, padding: "2px 5px",
          fontSize: 9, fontWeight: 700,
          color: (0.299*cat.color[0] + 0.587*cat.color[1] + 0.114*cat.color[2])/255 > 0.55 ? "#000" : "#fff",
        }}>
          {cat.label}
        </div>
      ))}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function WeatherLegend({ activeLayer, opacity, showEnsemble }) {
  const scale = SCALES[activeLayer];
  if (!scale) return null;
  const stops = scale.stops;
  const grad = stops.map((s) => {
    const pct = ((s[0] - stops[0][0]) / (stops[stops.length - 1][0] - stops[0][0])) * 100;
    const [r, g, b] = s[1];
    return `rgba(${r},${g},${b},0.9) ${pct.toFixed(1)}%`;
  }).join(", ");

  return (
    <div style={{
      position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, background: "rgba(15,15,20,0.82)", backdropFilter: "blur(8px)",
      borderRadius: 10, padding: "8px 14px", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 4, border: "1px solid rgba(255,255,255,0.12)",
      pointerEvents: "none", minWidth: activeLayer === "aqi" ? 240 : 180,
    }}>
      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{scale.label}</span>
      <div style={{ width: "100%", height: 10, borderRadius: 5, background: `linear-gradient(to right, ${grad})`, opacity }} />
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{scale.legendFmt(stops[0][0])}</span>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{scale.legendFmt(stops[stops.length - 1][0])}</span>
      </div>
      {activeLayer === "aqi" && <AqiChips />}
      {showEnsemble && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          <div style={{ width: 28, height: 6, background: "rgba(255,180,0,0.5)", borderRadius: 3 }} />
          <span style={{ color: "rgba(255,200,80,0.7)", fontSize: 9 }}>= forecast uncertainty</span>
        </div>
      )}
    </div>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function WeatherControls({
  activeLayer, setActiveLayer, opacity, setOpacity,
  loading, error, lastUpdated, onRefresh,
  visible, setVisible, gridSize, setGridSize,
  showPills, setShowPills, showEnsemble, setShowEnsemble,
}) {
  const layers = [
    { key: "temperature",  icon: "🌡", label: "Temp"  },
    { key: "precipitation",icon: "🌧", label: "Rain"  },
    { key: "windspeed",    icon: "💨", label: "Wind"  },
    { key: "cloudcover",   icon: "☁️", label: "Cloud" },
    { key: "aqi",          icon: "😷", label: "AQI"   },
  ];

  return (
    <div style={{ position: "absolute", top: 80, right: 10, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, pointerEvents: "auto" }}>
      <button onClick={() => setVisible((v) => !v)} style={{
        background: visible ? "rgba(90,184,135,0.92)" : "rgba(15,15,20,0.82)",
        backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8, color: visible ? "#fff" : "rgba(255,255,255,0.7)",
        cursor: "pointer", padding: "6px 10px", fontSize: 18, lineHeight: 1,
        display: "flex", alignItems: "center", gap: 6, fontWeight: 700, transition: "all 0.2s",
      }}>
        🌤 <span style={{ fontSize: 11, letterSpacing: "0.05em" }}>{visible ? "ON" : "OFF"}</span>
      </button>

      {visible && (
        <div style={{ background: "rgba(15,15,20,0.88)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 166 }}>
          {/* Layer picker — 5 buttons in 2+3 layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {layers.slice(0, 4).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setActiveLayer(key)} style={{
                background: activeLayer === key ? "rgba(90,184,135,0.25)" : "rgba(255,255,255,0.05)",
                border: activeLayer === key ? "1px solid rgba(90,184,135,0.6)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, color: activeLayer === key ? "#5ab887" : "rgba(255,255,255,0.6)",
                cursor: "pointer", padding: "5px 6px", fontSize: 11, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 14 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
          {/* AQI full-width button */}
          <button onClick={() => setActiveLayer("aqi")} style={{
            background: activeLayer === "aqi" ? "rgba(90,184,135,0.25)" : "rgba(255,255,255,0.05)",
            border: activeLayer === "aqi" ? "1px solid rgba(90,184,135,0.6)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, color: activeLayer === "aqi" ? "#5ab887" : "rgba(255,255,255,0.6)",
            cursor: "pointer", padding: "5px 8px", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 14 }}>😷</span> Air Quality (US AQI)
          </button>

          {/* Ensemble toggle */}
          <button onClick={() => setShowEnsemble((v) => !v)} style={{
            background: showEnsemble ? "rgba(255,180,0,0.15)" : "rgba(255,255,255,0.04)",
            border: showEnsemble ? "1px solid rgba(255,180,0,0.5)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, color: showEnsemble ? "#f5a623" : "rgba(255,255,255,0.45)",
            cursor: "pointer", padding: "5px 8px", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
          }}>
            🎲 Ensemble {showEnsemble ? "on" : "off"}
          </button>

          {/* Pills toggle */}
          <button onClick={() => setShowPills((v) => !v)} style={{
            background: showPills ? "rgba(90,184,135,0.15)" : "rgba(255,255,255,0.04)",
            border: showPills ? "1px solid rgba(90,184,135,0.5)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, color: showPills ? "#5ab887" : "rgba(255,255,255,0.45)",
            cursor: "pointer", padding: "5px 8px", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
          }}>
            🌡 Labels {showPills ? "on" : "off"}
          </button>

          {/* Opacity */}
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Opacity</div>
            <input type="range" min={5} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} style={{ width: "100%", accentColor: "#5ab887", cursor: "pointer" }} />
          </div>

          {/* Grid density */}
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Grid density</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[3, 5, 7].map((g) => (
                <button key={g} onClick={() => setGridSize(g)} style={{
                  flex: 1,
                  background: gridSize === g ? "rgba(90,184,135,0.25)" : "rgba(255,255,255,0.05)",
                  border: gridSize === g ? "1px solid rgba(90,184,135,0.6)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 5, color: gridSize === g ? "#5ab887" : "rgba(255,255,255,0.45)",
                  cursor: "pointer", padding: "3px 0", fontSize: 11, fontWeight: 600,
                }}>{g}×{g}</button>
              ))}
            </div>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, marginTop: 3 }}>Higher = more detail, slower</div>
          </div>

          {/* Status */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <div>
              {loading && <span style={{ color: "#5ab887", fontSize: 10 }}>⟳ Fetching…</span>}
              {error && !loading && <span style={{ color: "#ff6b6b", fontSize: 10 }}>⚠ Error</span>}
              {!loading && !error && lastUpdated && <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>{lastUpdated}</span>}
            </div>
            <button onClick={onRefresh} disabled={loading} style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5,
              color: loading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)",
              cursor: loading ? "not-allowed" : "pointer", padding: "3px 7px", fontSize: 10,
            }}>Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function WeatherLayer({ selectedTrack }) {
  const map = useMap();
  const weatherCanvasRef  = useRef(null);
  const ensembleCanvasRef = useRef(null);

  const [visible,        setVisible]        = useState(true);
  const [showPills,      setShowPills]      = useState(true);
  const [showEnsemble,   setShowEnsemble]   = useState(false);
  const [activeLayer,    setActiveLayer]    = useState("temperature");
  const [opacity,        setOpacity]        = useState(0.05);
  const [gridSize,       setGridSize]       = useState(5);
  const [weatherData,    setWeatherData]    = useState(null);
  const [ensembleSpread, setEnsembleSpread] = useState(null);
  const [pillData,       setPillData]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [lastUpdated,    setLastUpdated]    = useState(null);

  const buildGrid = useCallback(() => {
    const b = map.getBounds(); const points = [];
    for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++)
      points.push({
        lat: b.getSouth() + (row / (gridSize - 1)) * (b.getNorth() - b.getSouth()),
        lon: b.getWest()  + (col / (gridSize - 1)) * (b.getEast()  - b.getWest()),
      });
    return points;
  }, [map, gridSize]);

  const buildPillPoints = useCallback(() => {
    const b = map.getBounds(); const points = [];
    for (const city of CITIES) if (b.contains([city.lat, city.lon]))
      points.push({ lat: city.lat, lon: city.lon, label: city.label, kind: "city" });
    if (selectedTrack?.geometry) {
      const coords = selectedTrack.geometry.type === "LineString"
        ? selectedTrack.geometry.coordinates
        : selectedTrack.geometry.coordinates[0];
      if (coords.length > 0) {
        const name = selectedTrack.properties?.name || "Trail";
        points.push({ lat: coords[0][1], lon: coords[0][0], label: name, kind: "trail-start" });
        if (coords.length > 4) { const mid = coords[Math.floor(coords.length / 2)]; points.push({ lat: mid[1], lon: mid[0], label: name, kind: "trail-mid" }); }
        const last = coords[coords.length - 1];
        points.push({ lat: last[1], lon: last[0], label: name, kind: "trail-end" });
      }
    }
    return points;
  }, [map, selectedTrack]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const grid = buildGrid();
      const pillPoints = buildPillPoints();
      const includeAqi = activeLayer === "aqi";

      const [heatmap, pills, spread] = await Promise.all([
        fetchWeatherPoints(grid, includeAqi),
        pillPoints.length > 0 ? fetchPillData(pillPoints, true, showEnsemble) : Promise.resolve([]),
        showEnsemble ? fetchEnsembleSpread(grid) : Promise.resolve(null),
      ]);

      setWeatherData(heatmap);
      setPillData(pills);
      setEnsembleSpread(spread);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildGrid, buildPillPoints, activeLayer, showEnsemble]);

  // Mount two canvas overlays: weather layer + ensemble uncertainty layer
  useEffect(() => {
    const setupCanvas = (zIndex) => {
      const canvas = document.createElement("canvas");
      const CanvasOverlay = L.Layer.extend({
        onAdd(map) {
          map.getPane("overlayPane").appendChild(canvas);
          map.on("moveend zoomend resize", this._reset, this);
          this._reset();
        },
        onRemove(map) { canvas.remove(); map.off("moveend zoomend resize", this._reset, this); },
        _reset() {
          L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
          const sz = map.getSize();
          Object.assign(canvas.style, { width: sz.x+"px", height: sz.y+"px", position: "absolute", pointerEvents: "none", zIndex });
        },
      });
      const overlay = new CanvasOverlay();
      overlay.addTo(map);
      return { canvas, overlay };
    };

    const w = setupCanvas(200); weatherCanvasRef.current  = w.canvas;
    const e = setupCanvas(201); ensembleCanvasRef.current = e.canvas;

    return () => { w.overlay.remove(); e.overlay.remove(); };
  }, [map]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { map.on("moveend", fetchAll); return () => map.off("moveend", fetchAll); }, [map, fetchAll]);

  // Redraw weather canvas
  useEffect(() => {
    const canvas = weatherCanvasRef.current; if (!canvas) return;
    if (!visible || !weatherData) { const ctx = canvas.getContext("2d"); const sz = map.getSize(); canvas.width = sz.x; canvas.height = sz.y; ctx.clearRect(0,0,sz.x,sz.y); return; }
    renderWeatherCanvas(canvas, map, weatherData, activeLayer);
    canvas.style.opacity = opacity;
  }, [map, weatherData, activeLayer, opacity, visible]);

  // Redraw ensemble canvas
  useEffect(() => {
    const canvas = ensembleCanvasRef.current; if (!canvas) return;
    if (!visible || !showEnsemble || !ensembleSpread) { const ctx = canvas.getContext("2d"); const sz = map.getSize(); canvas.width = sz.x; canvas.height = sz.y; ctx.clearRect(0,0,sz.x,sz.y); return; }
    renderEnsembleCanvas(canvas, map, ensembleSpread);
    canvas.style.opacity = Math.min(opacity * 2, 0.6);
  }, [map, ensembleSpread, opacity, visible, showEnsemble]);

  // Reproject on pan/zoom
  useEffect(() => {
    const redraw = () => {
      const wc = weatherCanvasRef.current, ec = ensembleCanvasRef.current;
      if (wc && visible && weatherData) { renderWeatherCanvas(wc, map, weatherData, activeLayer); wc.style.opacity = opacity; }
      if (ec && visible && showEnsemble && ensembleSpread) { renderEnsembleCanvas(ec, map, ensembleSpread); ec.style.opacity = Math.min(opacity * 2, 0.6); }
    };
    map.on("move zoom", redraw);
    return () => map.off("move zoom", redraw);
  }, [map, weatherData, ensembleSpread, activeLayer, opacity, visible, showEnsemble]);

  return (
    <>
      {/* Trail uncertainty band (rendered under trail line) */}
      <TrailUncertaintyBand selectedTrack={selectedTrack} ensembleSpread={ensembleSpread} visible={visible && showEnsemble} />

      {/* Temp / AQI pills */}
      <TempPills visible={visible && showPills} pillData={pillData} activeLayer={activeLayer} />

      {/* Controls + legend */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1000 }}>
        <div style={{ pointerEvents: "auto" }}>
          <WeatherControls
            activeLayer={activeLayer} setActiveLayer={setActiveLayer}
            opacity={opacity} setOpacity={setOpacity}
            loading={loading} error={error} lastUpdated={lastUpdated}
            onRefresh={fetchAll} visible={visible} setVisible={setVisible}
            gridSize={gridSize} setGridSize={setGridSize}
            showPills={showPills} setShowPills={setShowPills}
            showEnsemble={showEnsemble} setShowEnsemble={setShowEnsemble}
          />
        </div>
        {visible && <WeatherLegend activeLayer={activeLayer} opacity={Math.min(opacity + 0.2, 1)} showEnsemble={showEnsemble} />}
      </div>
    </>
  );
}
