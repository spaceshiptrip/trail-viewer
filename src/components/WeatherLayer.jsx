import { useEffect, useRef, useCallback, useState } from "react";
import { useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// ─── Color scales ────────────────────────────────────────────────────────────

const SCALES = {
  temperature: {
    label: "Temperature",
    unit: "°F",
    stops: [
      [-10,  [130,  22, 180, 190]],
      [  0,  [ 55,  80, 220, 190]],
      [ 32,  [ 80, 180, 240, 180]],
      [ 50,  [100, 220, 180, 170]],
      [ 65,  [160, 230,  80, 170]],
      [ 80,  [255, 200,   0, 180]],
      [ 95,  [255,  80,   0, 185]],
      [110,  [180,   0,   0, 190]],
    ],
    toDisplay: (c) => ((c * 9) / 5 + 32).toFixed(0),
  },
  precipitation: {
    label: "Precipitation",
    unit: "mm/h",
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
  },
  windspeed: {
    label: "Wind Speed",
    unit: "mph",
    stops: [
      [  0,  [200, 230, 255,   0]],
      [  5,  [160, 210, 255,  60]],
      [ 10,  [100, 200, 255, 100]],
      [ 20,  [ 60, 240, 180, 130]],
      [ 30,  [255, 230,  60, 150]],
      [ 45,  [255, 140,   0, 170]],
      [ 60,  [220,  30,  30, 185]],
      [ 80,  [140,   0, 140, 200]],
    ],
    toDisplay: (v) => (v * 0.621371).toFixed(0),
  },
  cloudcover: {
    label: "Cloud Cover",
    unit: "%",
    stops: [
      [  0, [200, 230, 255,   0]],
      [ 10, [220, 235, 255,  20]],
      [ 30, [200, 215, 240,  60]],
      [ 50, [180, 195, 220,  90]],
      [ 70, [160, 170, 195, 120]],
      [ 85, [140, 145, 165, 150]],
      [100, [120, 125, 140, 175]],
    ],
    toDisplay: (v) => v.toFixed(0),
  },
};

// ─── IDW interpolation ───────────────────────────────────────────────────────

function idwInterpolate(px, py, points, power = 2.5) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const pt of points) {
    const dx = px - pt.x;
    const dy = py - pt.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < 0.00001) return pt.value;
    const w = 1 / Math.pow(dist2, power / 2);
    weightedSum += w * pt.value;
    weightTotal += w;
  }
  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorFromScale(value, stops) {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i + 1];
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
  const f = (tempC * 9) / 5 + 32;
  const [r, g, b] = colorFromScale(f, SCALES.temperature.stops);
  return { r, g, b, css: `rgb(${r},${g},${b})` };
}

// ─── Open-Meteo API ───────────────────────────────────────────────────────────

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

async function fetchWeatherPoints(gridPoints) {
  const lats = gridPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = gridPoints.map((p) => p.lon.toFixed(4)).join(",");
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: "temperature_2m,precipitation,windspeed_10m,cloudcover",
    forecast_days: "1",
    timezone: "auto",
  });
  const res = await fetch(`${OPEN_METEO}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  const locations = Array.isArray(data) ? data : [data];
  const hourIndex = new Date().getHours();
  return locations.map((loc, i) => ({
    lat: gridPoints[i].lat,
    lon: gridPoints[i].lon,
    temperature: loc.hourly?.temperature_2m?.[hourIndex] ?? null,
    precipitation: loc.hourly?.precipitation?.[hourIndex] ?? null,
    windspeed: loc.hourly?.windspeed_10m?.[hourIndex] ?? null,
    cloudcover: loc.hourly?.cloudcover?.[hourIndex] ?? null,
  }));
}

// Fetch rich pill data: current + daily high/low + 8-hour strip
async function fetchPillData(pillPoints) {
  if (pillPoints.length === 0) return [];
  const lats = pillPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = pillPoints.map((p) => p.lon.toFixed(4)).join(",");
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: "temperature_2m,precipitation_probability,windspeed_10m,cloudcover",
    daily: "temperature_2m_max,temperature_2m_min",
    forecast_days: "1",
    timezone: "auto",
  });
  const res = await fetch(`${OPEN_METEO}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo pill error: ${res.status}`);
  const data = await res.json();
  const locations = Array.isArray(data) ? data : [data];
  const hourIndex = new Date().getHours();

  return locations.map((loc, i) => {
    const h = loc.hourly;
    const d = loc.daily;
    const tempC = h?.temperature_2m?.[hourIndex] ?? null;
    const highC = d?.temperature_2m_max?.[0] ?? null;
    const lowC  = d?.temperature_2m_min?.[0] ?? null;

    const hours = [];
    for (let offset = 0; offset < 8; offset++) {
      const idx = Math.min(hourIndex + offset, 23);
      const t = new Date();
      t.setHours(hourIndex + offset, 0, 0, 0);
      hours.push({
        time: t.toLocaleTimeString([], { hour: "numeric" }),
        tempF: h?.temperature_2m?.[idx] != null
          ? Math.round((h.temperature_2m[idx] * 9) / 5 + 32) : null,
        precipPct: h?.precipitation_probability?.[idx] ?? null,
        windMph: h?.windspeed_10m?.[idx] != null
          ? Math.round(h.windspeed_10m[idx] * 0.621371) : null,
        cloud: h?.cloudcover?.[idx] ?? null,
      });
    }

    return {
      lat: pillPoints[i].lat,
      lon: pillPoints[i].lon,
      label: pillPoints[i].label,
      kind: pillPoints[i].kind,
      tempC,
      current: {
        tempF: tempC != null ? Math.round((tempC * 9) / 5 + 32) : null,
        precipPct: h?.precipitation_probability?.[hourIndex] ?? null,
        windMph: h?.windspeed_10m?.[hourIndex] != null
          ? Math.round(h.windspeed_10m[hourIndex] * 0.621371) : null,
        cloud: h?.cloudcover?.[hourIndex] ?? null,
      },
      daily: {
        highF: highC != null ? Math.round((highC * 9) / 5 + 32) : null,
        lowF:  lowC  != null ? Math.round((lowC  * 9) / 5 + 32) : null,
      },
      hours,
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

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function renderCanvas(canvas, map, weatherData, activeLayer) {
  const ctx = canvas.getContext("2d");
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);
  if (!weatherData || weatherData.length === 0) return;
  const scale = SCALES[activeLayer];
  if (!scale) return;

  const points = weatherData
    .filter((d) => d[activeLayer] != null)
    .map((d) => {
      const pt = map.latLngToContainerPoint([d.lat, d.lon]);
      return { x: pt.x, y: pt.y, value: d[activeLayer] };
    });
  if (points.length < 2) return;

  const SF = 4;
  const w = Math.ceil(size.x / SF);
  const h = Math.ceil(size.y / SF);
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const offCtx = offscreen.getContext("2d");
  const imgData = offCtx.createImageData(w, h);
  const pixels = imgData.data;
  const scaled = points.map((p) => ({ x: p.x / SF, y: p.y / SF, value: p.value }));

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const value = idwInterpolate(px, py, scaled, 2.5);
      const [r, g, b, a] = colorFromScale(value, scale.stops);
      const idx = (py * w + px) * 4;
      pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = a;
    }
  }

  offCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, 0, 0, size.x, size.y);
}

// ─── Pill icon ────────────────────────────────────────────────────────────────

function makePillIcon(tempF, tempC, kind) {
  const { r, g, b, css: bg } = tempToRGB(tempC ?? 15);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = lum > 0.55 ? "rgba(0,0,0,0.85)" : "#fff";
  const isTrail = kind?.startsWith("trail");
  const border = isTrail ? "2px solid rgba(90,184,135,0.95)" : "1.5px solid rgba(255,255,255,0.3)";
  const prefix =
    kind === "trail-start" ? "▶ " :
    kind === "trail-end"   ? "⏹ " :
    kind === "trail-mid"   ? "◉ " : "";

  const html = `<div style="
    background:${bg};border:${border};border-radius:20px;
    padding:3px 9px;font-family:ui-sans-serif,system-ui,sans-serif;
    font-size:12px;font-weight:700;color:${textColor};white-space:nowrap;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);display:inline-flex;
    align-items:center;gap:2px;cursor:pointer;
  ">${prefix}${tempF != null ? `${tempF}°F` : "—"}</div>`;

  const w = isTrail ? 78 : 62;
  return L.divIcon({ className: "", html, iconSize: [w, 24], iconAnchor: [w / 2, 12], popupAnchor: [0, -18] });
}

// ─── Pill popup ───────────────────────────────────────────────────────────────

function PillPopup({ pill }) {
  const { label, kind, current, daily, hours } = pill;
  const kindLabel =
    kind === "trail-start" ? "Trail Start" :
    kind === "trail-mid"   ? "Trail Midpoint" :
    kind === "trail-end"   ? "Trail End" : null;

  const skyIcon = (pct) =>
    pct == null ? "—" : pct < 20 ? "☀️" : pct < 50 ? "⛅" : pct < 80 ? "🌥️" : "☁️";

  const s = { fontFamily: "ui-sans-serif,system-ui,sans-serif" };

  return (
    <div style={{ ...s, minWidth: 210, maxWidth: 250 }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{label}</div>
        {kindLabel && (
          <div style={{ fontSize: 11, color: "#5ab887", fontWeight: 600, marginTop: 1 }}>
            {kindLabel}
          </div>
        )}
      </div>

      {/* Current stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 12px",
        background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "8px 10px", marginBottom: 8,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Now</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>
            {current.tempF != null ? `${current.tempF}°F` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>H / L today</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginTop: 2 }}>
            {daily.highF != null ? `${daily.highF}°` : "—"} / {daily.lowF != null ? `${daily.lowF}°` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Rain chance</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#4a90d9", marginTop: 2 }}>
            {current.precipPct != null ? `${current.precipPct}%` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Wind</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginTop: 2 }}>
            {current.windMph != null ? `${current.windMph} mph` : "—"}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: "0.07em" }}>Sky</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginTop: 2 }}>
            {skyIcon(current.cloud)}&nbsp;{current.cloud != null ? `${current.cloud}% cloud` : "—"}
          </div>
        </div>
      </div>

      {/* 8-hour forecast strip */}
      <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        Next 8 hours
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {hours.map((h, i) => (
          <div key={i} style={{
            flex: "1 1 0", background: i === 0 ? "rgba(90,184,135,0.1)" : "rgba(0,0,0,0.04)",
            border: i === 0 ? "1px solid rgba(90,184,135,0.3)" : "1px solid transparent",
            borderRadius: 6, padding: "4px 3px", textAlign: "center",
          }}>
            <div style={{ fontSize: 8, color: "#bbb", marginBottom: 2 }}>{h.time}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
              {h.tempF != null ? `${h.tempF}°` : "—"}
            </div>
            <div style={{ fontSize: 8, color: "#4a90d9", marginTop: 1 }}>
              {h.precipPct != null ? `${h.precipPct}%` : ""}
            </div>
            <div style={{ fontSize: 8, color: "#888" }}>
              {h.windMph != null ? `${h.windMph}mph` : ""}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 8, color: "#ccc", marginTop: 7, textAlign: "right" }}>
        Open-Meteo · free &amp; no API key
      </div>
    </div>
  );
}

// ─── Temp pill markers ────────────────────────────────────────────────────────

function TempPills({ visible, pillData }) {
  if (!visible || !pillData || pillData.length === 0) return null;
  return (
    <>
      {pillData.map((pill, i) => (
        <Marker
          key={`pill-${i}-${pill.label}-${pill.kind}`}
          position={[pill.lat, pill.lon]}
          icon={makePillIcon(pill.current.tempF, pill.tempC, pill.kind)}
          zIndexOffset={pill.kind?.startsWith("trail") ? 600 : 100}
        >
          <Popup minWidth={220} maxWidth={260}>
            <PillPopup pill={pill} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function WeatherLegend({ activeLayer, opacity }) {
  const scale = SCALES[activeLayer];
  if (!scale) return null;
  const stops = scale.stops;
  const grad = stops
    .map((s) => {
      const pct = ((s[0] - stops[0][0]) / (stops[stops.length - 1][0] - stops[0][0])) * 100;
      const [r, g, b] = s[1];
      return `rgba(${r},${g},${b},0.9) ${pct.toFixed(1)}%`;
    })
    .join(", ");
  const fmt = (v) =>
    activeLayer === "temperature" ? `${Math.round((v * 9) / 5 + 32)}°F` : `${v}${scale.unit}`;

  return (
    <div style={{
      position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, background: "rgba(15,15,20,0.82)", backdropFilter: "blur(8px)",
      borderRadius: 10, padding: "8px 14px", display: "flex", flexDirection: "column",
      alignItems: "center", gap: 4, border: "1px solid rgba(255,255,255,0.12)",
      pointerEvents: "none", minWidth: 180,
    }}>
      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {scale.label}
      </span>
      <div style={{ width: "100%", height: 10, borderRadius: 5, background: `linear-gradient(to right, ${grad})`, opacity }} />
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{fmt(stops[0][0])}</span>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>{fmt(stops[stops.length - 1][0])}</span>
      </div>
    </div>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function WeatherControls({
  activeLayer, setActiveLayer, opacity, setOpacity,
  loading, error, lastUpdated, onRefresh,
  visible, setVisible, gridSize, setGridSize,
  showPills, setShowPills,
}) {
  const layers = [
    { key: "temperature", icon: "🌡", label: "Temp" },
    { key: "precipitation", icon: "🌧", label: "Rain" },
    { key: "windspeed", icon: "💨", label: "Wind" },
    { key: "cloudcover", icon: "☁️", label: "Cloud" },
  ];

  return (
    <div style={{
      position: "absolute", top: 80, right: 10, zIndex: 1000,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
      pointerEvents: "auto",
    }}>
      {/* Master toggle */}
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
        <div style={{
          background: "rgba(15,15,20,0.88)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
          padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 162,
        }}>
          {/* Layer picker */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {layers.map(({ key, icon, label }) => (
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

          {/* Pills toggle */}
          <button onClick={() => setShowPills((v) => !v)} style={{
            background: showPills ? "rgba(90,184,135,0.15)" : "rgba(255,255,255,0.04)",
            border: showPills ? "1px solid rgba(90,184,135,0.5)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, color: showPills ? "#5ab887" : "rgba(255,255,255,0.45)",
            cursor: "pointer", padding: "5px 8px", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
          }}>
            🌡 Temp labels {showPills ? "on" : "off"}
          </button>

          {/* Opacity */}
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Opacity</div>
            <input type="range" min={10} max={100} value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "#5ab887", cursor: "pointer" }} />
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
                }}>
                  {g}×{g}
                </button>
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
              background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 5, color: loading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)",
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
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [visible, setVisible] = useState(true);
  const [showPills, setShowPills] = useState(true);
  const [activeLayer, setActiveLayer] = useState("temperature");
  const [opacity, setOpacity] = useState(0.65);
  const [gridSize, setGridSize] = useState(5);
  const [weatherData, setWeatherData] = useState(null);
  const [pillData, setPillData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Build heatmap grid from current viewport
  const buildGrid = useCallback(() => {
    const b = map.getBounds();
    const points = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        points.push({
          lat: b.getSouth() + (row / (gridSize - 1)) * (b.getNorth() - b.getSouth()),
          lon: b.getWest()  + (col / (gridSize - 1)) * (b.getEast()  - b.getWest()),
        });
      }
    }
    return points;
  }, [map, gridSize]);

  // Build pill points: cities in viewport + trail start/mid/end
  const buildPillPoints = useCallback(() => {
    const b = map.getBounds();
    const points = [];

    // Cities visible in viewport
    for (const city of CITIES) {
      if (b.contains([city.lat, city.lon])) {
        points.push({ lat: city.lat, lon: city.lon, label: city.label, kind: "city" });
      }
    }

    // Trail anchor points
    if (selectedTrack?.geometry) {
      const coords =
        selectedTrack.geometry.type === "LineString"
          ? selectedTrack.geometry.coordinates
          : selectedTrack.geometry.coordinates[0];

      if (coords.length > 0) {
        const name = selectedTrack.properties?.name || "Trail";
        points.push({ lat: coords[0][1], lon: coords[0][0], label: name, kind: "trail-start" });
        if (coords.length > 4) {
          const mid = coords[Math.floor(coords.length / 2)];
          points.push({ lat: mid[1], lon: mid[0], label: name, kind: "trail-mid" });
        }
        const last = coords[coords.length - 1];
        points.push({ lat: last[1], lon: last[0], label: name, kind: "trail-end" });
      }
    }

    return points;
  }, [map, selectedTrack]);

  // Fetch everything
  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pillPoints = buildPillPoints();
      const [heatmap, pills] = await Promise.all([
        fetchWeatherPoints(buildGrid()),
        pillPoints.length > 0 ? fetchPillData(pillPoints) : Promise.resolve([]),
      ]);
      setWeatherData(heatmap);
      setPillData(pills);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildGrid, buildPillPoints]);

  // Mount canvas overlay
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    const CanvasOverlay = L.Layer.extend({
      onAdd(map) {
        map.getPane("overlayPane").appendChild(canvas);
        map.on("moveend zoomend resize", this._reset, this);
        this._reset();
      },
      onRemove(map) {
        canvas.remove();
        map.off("moveend zoomend resize", this._reset, this);
      },
      _reset() {
        L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
        const sz = map.getSize();
        Object.assign(canvas.style, { width: sz.x + "px", height: sz.y + "px", position: "absolute", pointerEvents: "none", zIndex: 200 });
      },
    });
    const overlay = new CanvasOverlay();
    overlay.addTo(map);
    overlayRef.current = overlay;
    return () => overlay.remove();
  }, [map]);

  // Initial + track-change fetch
  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  // Re-fetch on moveend
  useEffect(() => {
    map.on("moveend", fetchWeather);
    return () => map.off("moveend", fetchWeather);
  }, [map, fetchWeather]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!visible || !weatherData) {
      const ctx = canvas.getContext("2d");
      const sz = map.getSize();
      canvas.width = sz.x; canvas.height = sz.y;
      ctx.clearRect(0, 0, sz.x, sz.y);
      return;
    }
    renderCanvas(canvas, map, weatherData, activeLayer);
    canvas.style.opacity = opacity;
  }, [map, weatherData, activeLayer, opacity, visible]);

  // Reproject on pan/zoom
  useEffect(() => {
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !visible || !weatherData) return;
      renderCanvas(canvas, map, weatherData, activeLayer);
      canvas.style.opacity = opacity;
    };
    map.on("move zoom", redraw);
    return () => map.off("move zoom", redraw);
  }, [map, weatherData, activeLayer, opacity, visible]);

  return (
    <>
      <TempPills visible={visible && showPills} pillData={pillData} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1000 }}>
        <div style={{ pointerEvents: "auto" }}>
          <WeatherControls
            activeLayer={activeLayer} setActiveLayer={setActiveLayer}
            opacity={opacity} setOpacity={setOpacity}
            loading={loading} error={error} lastUpdated={lastUpdated}
            onRefresh={fetchWeather} visible={visible} setVisible={setVisible}
            gridSize={gridSize} setGridSize={setGridSize}
            showPills={showPills} setShowPills={setShowPills}
          />
        </div>
        {visible && <WeatherLegend activeLayer={activeLayer} opacity={Math.min(opacity + 0.2, 1)} />}
      </div>
    </>
  );
}
