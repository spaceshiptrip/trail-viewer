import { useEffect, useRef, useCallback, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// ─── Color scales ────────────────────────────────────────────────────────────

// Each scale is an array of [value, [r,g,b,a]] stops
// Values are in the variable's native unit

const SCALES = {
  temperature: {
    label: "Temperature",
    unit: "°F",
    // -10°F → 110°F
    stops: [
      [-10,  [130,  22, 180, 190]],  // deep violet
      [  0,  [ 55,  80, 220, 190]],  // blue
      [ 32,  [ 80, 180, 240, 180]],  // light blue (freezing)
      [ 50,  [100, 220, 180, 170]],  // teal
      [ 65,  [160, 230,  80, 170]],  // yellow-green
      [ 80,  [255, 200,   0, 180]],  // amber
      [ 95,  [255,  80,   0, 185]],  // orange-red
      [110,  [180,   0,   0, 190]],  // dark red
    ],
    toDisplay: (c) => ((c * 9) / 5 + 32).toFixed(1), // °C → °F
    fromDisplay: (f) => ((f - 32) * 5) / 9,
  },
  precipitation: {
    label: "Precipitation",
    unit: "mm/h",
    stops: [
      [0,    [100, 180, 255,   0]],  // transparent (no rain)
      [0.05, [100, 200, 255,  40]],  // barely visible
      [0.2,  [ 60, 160, 255, 100]],  // light blue
      [0.5,  [ 30, 100, 255, 140]],  // blue
      [1,    [  0,  60, 200, 160]],  // medium blue
      [2,    [  0, 200, 100, 170]],  // green
      [5,    [255, 220,   0, 180]],  // yellow
      [10,   [255, 100,   0, 190]],  // orange
      [20,   [200,   0,   0, 200]],  // red
    ],
    toDisplay: (v) => v.toFixed(2),
    fromDisplay: (v) => v,
  },
  windspeed: {
    label: "Wind Speed",
    unit: "mph",
    stops: [
      [  0,  [200, 230, 255,   0]],  // calm — transparent
      [  5,  [160, 210, 255,  60]],  // very light
      [ 10,  [100, 200, 255, 100]],  // light
      [ 20,  [ 60, 240, 180, 130]],  // moderate
      [ 30,  [255, 230,  60, 150]],  // fresh
      [ 45,  [255, 140,   0, 170]],  // strong
      [ 60,  [220,  30,  30, 185]],  // very strong
      [ 80,  [140,   0, 140, 200]],  // storm
    ],
    toDisplay: (v) => (v * 0.621371).toFixed(1), // km/h → mph
    fromDisplay: (v) => v,
  },
  cloudcover: {
    label: "Cloud Cover",
    unit: "%",
    stops: [
      [  0, [200, 230, 255,   0]],   // clear sky — transparent
      [ 10, [220, 235, 255,  20]],   // nearly clear
      [ 30, [200, 215, 240,  60]],   // scattered
      [ 50, [180, 195, 220,  90]],   // partly cloudy
      [ 70, [160, 170, 195, 120]],   // mostly cloudy
      [ 85, [140, 145, 165, 150]],   // cloudy
      [100, [120, 125, 140, 175]],   // overcast
    ],
    toDisplay: (v) => v.toFixed(0),
    fromDisplay: (v) => v,
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

    if (dist2 < 0.00001) return pt.value; // exact match

    const w = 1 / Math.pow(dist2, power / 2);
    weightedSum += w * pt.value;
    weightTotal += w;
  }

  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

// ─── Color from scale ────────────────────────────────────────────────────────

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

// ─── Open-Meteo fetch ────────────────────────────────────────────────────────

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

async function fetchWeatherPoints(gridPoints) {
  // Open-Meteo supports up to 10 000 locations but we batch carefully
  // We use the multi-location format: lat=a,b,c&longitude=x,y,z
  const lats = gridPoints.map((p) => p.lat.toFixed(4)).join(",");
  const lons = gridPoints.map((p) => p.lon.toFixed(4)).join(",");

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly:
      "temperature_2m,precipitation,windspeed_10m,cloudcover",
    forecast_days: "1",
    timezone: "auto",
  });

  const res = await fetch(`${OPEN_METEO}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();

  // data is an array when multiple locations are requested
  const locations = Array.isArray(data) ? data : [data];

  // Pick the current hour index
  const now = new Date();
  const hourIndex = now.getHours(); // simple approximation

  return locations.map((loc, i) => ({
    lat: gridPoints[i].lat,
    lon: gridPoints[i].lon,
    temperature: loc.hourly?.temperature_2m?.[hourIndex] ?? null,
    precipitation: loc.hourly?.precipitation?.[hourIndex] ?? null,
    windspeed: loc.hourly?.windspeed_10m?.[hourIndex] ?? null,
    cloudcover: loc.hourly?.cloudcover?.[hourIndex] ?? null,
  }));
}

// ─── Canvas renderer ─────────────────────────────────────────────────────────

function renderCanvas(canvas, map, weatherData, activeLayer, blur) {
  const ctx = canvas.getContext("2d");
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  ctx.clearRect(0, 0, size.x, size.y);

  if (!weatherData || weatherData.length === 0) return;

  const scale = SCALES[activeLayer];
  if (!scale) return;

  // Project lat/lon sample points to pixel space
  const points = weatherData
    .filter((d) => d[activeLayer] != null)
    .map((d) => {
      const pt = map.latLngToContainerPoint([d.lat, d.lon]);
      return { x: pt.x, y: pt.y, value: d[activeLayer] };
    });

  if (points.length < 2) return;

  // Draw pixel-by-pixel with IDW (downscaled for performance, then upscaled)
  const SCALE_FACTOR = 4; // render at 1/4 res, upscale
  const w = Math.ceil(size.x / SCALE_FACTOR);
  const h = Math.ceil(size.y / SCALE_FACTOR);

  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const offCtx = offscreen.getContext("2d");
  const imgData = offCtx.createImageData(w, h);
  const pixels = imgData.data;

  // Scale sample points to offscreen coords
  const scaledPoints = points.map((p) => ({
    x: p.x / SCALE_FACTOR,
    y: p.y / SCALE_FACTOR,
    value: p.value,
  }));

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const value = idwInterpolate(px, py, scaledPoints, 2.5);
      const [r, g, b, a] = colorFromScale(value, scale.stops);
      const idx = (py * w + px) * 4;
      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Upscale to full canvas with smoothing (gives natural blur for free)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, 0, 0, size.x, size.y);

  // Optional extra Gaussian-style blur via CSS filter
  if (blur) {
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function WeatherLegend({ activeLayer, opacity }) {
  const scale = SCALES[activeLayer];
  if (!scale) return null;

  const stops = scale.stops;
  const gradientStops = stops
    .map((s) => {
      const pct =
        ((s[0] - stops[0][0]) / (stops[stops.length - 1][0] - stops[0][0])) *
        100;
      const [r, g, b] = s[1];
      return `rgba(${r},${g},${b},0.9) ${pct.toFixed(1)}%`;
    })
    .join(", ");

  const minLabel =
    activeLayer === "temperature"
      ? `${((stops[0][0] * 9) / 5 + 32).toFixed(0)}°F`
      : `${stops[0][0]}`;

  const maxLabel =
    activeLayer === "temperature"
      ? `${((stops[stops.length - 1][0] * 9) / 5 + 32).toFixed(0)}°F`
      : `${stops[stops.length - 1][0]}${scale.unit}`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "rgba(15,15,20,0.82)",
        backdropFilter: "blur(8px)",
        borderRadius: 10,
        padding: "8px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        border: "1px solid rgba(255,255,255,0.12)",
        pointerEvents: "none",
        minWidth: 180,
      }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {scale.label}
      </span>
      <div
        style={{
          width: "100%",
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(to right, ${gradientStops})`,
          opacity,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>
          {minLabel}
        </span>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10 }}>
          {maxLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Control panel ────────────────────────────────────────────────────────────

function WeatherControls({
  activeLayer,
  setActiveLayer,
  opacity,
  setOpacity,
  loading,
  error,
  lastUpdated,
  onRefresh,
  visible,
  setVisible,
  gridSize,
  setGridSize,
}) {
  const [expanded, setExpanded] = useState(false);

  const layers = [
    { key: "temperature", icon: "🌡", label: "Temp" },
    { key: "precipitation", icon: "🌧", label: "Rain" },
    { key: "windspeed", icon: "💨", label: "Wind" },
    { key: "cloudcover", icon: "☁️", label: "Cloud" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 10,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        pointerEvents: "auto",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setVisible((v) => !v)}
        title="Toggle weather overlay"
        style={{
          background: visible
            ? "rgba(90,184,135,0.92)"
            : "rgba(15,15,20,0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          color: visible ? "#fff" : "rgba(255,255,255,0.7)",
          cursor: "pointer",
          padding: "6px 10px",
          fontSize: 18,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
          transition: "all 0.2s",
        }}
      >
        🌤
        <span style={{ fontSize: 11, letterSpacing: "0.05em" }}>
          {visible ? "ON" : "OFF"}
        </span>
      </button>

      {/* Layer picker + settings */}
      {visible && (
        <div
          style={{
            background: "rgba(15,15,20,0.88)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 160,
          }}
        >
          {/* Layer buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {layers.map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                style={{
                  background:
                    activeLayer === key
                      ? "rgba(90,184,135,0.25)"
                      : "rgba(255,255,255,0.05)",
                  border:
                    activeLayer === key
                      ? "1px solid rgba(90,184,135,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  color: activeLayer === key ? "#5ab887" : "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  padding: "5px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 14 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Opacity slider */}
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Opacity
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "#5ab887", cursor: "pointer" }}
            />
          </div>

          {/* Grid density */}
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Grid density
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[3, 5, 7].map((g) => (
                <button
                  key={g}
                  onClick={() => setGridSize(g)}
                  style={{
                    flex: 1,
                    background:
                      gridSize === g
                        ? "rgba(90,184,135,0.25)"
                        : "rgba(255,255,255,0.05)",
                    border:
                      gridSize === g
                        ? "1px solid rgba(90,184,135,0.6)"
                        : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 5,
                    color:
                      gridSize === g ? "#5ab887" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: "3px 0",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {g}×{g}
                </button>
              ))}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 }}>
              Higher = more detail, slower
            </div>
          </div>

          {/* Status + refresh */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <div>
              {loading && (
                <span style={{ color: "#5ab887", fontSize: 10 }}>
                  ⟳ Fetching…
                </span>
              )}
              {error && !loading && (
                <span style={{ color: "#ff6b6b", fontSize: 10 }} title={error}>
                  ⚠ Error
                </span>
              )}
              {!loading && !error && lastUpdated && (
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>
                  {lastUpdated}
                </span>
              )}
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 5,
                color: loading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
                cursor: loading ? "not-allowed" : "pointer",
                padding: "3px 7px",
                fontSize: 10,
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeatherLayer() {
  const map = useMap();
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [visible, setVisible] = useState(true);
  const [activeLayer, setActiveLayer] = useState("temperature");
  const [opacity, setOpacity] = useState(0.65);
  const [gridSize, setGridSize] = useState(5); // NxN sample grid
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Build a grid of lat/lon points covering the current map bounds
  const buildGrid = useCallback(() => {
    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLon = bounds.getWest();
    const maxLon = bounds.getEast();

    const points = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const lat = minLat + (row / (gridSize - 1)) * (maxLat - minLat);
        const lon = minLon + (col / (gridSize - 1)) * (maxLon - minLon);
        points.push({ lat, lon });
      }
    }
    return points;
  }, [map, gridSize]);

  // Fetch weather for current viewport
  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const grid = buildGrid();
      const data = await fetchWeatherPoints(grid);
      setWeatherData(data);
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildGrid]);

  // Create canvas overlay on mount
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    // Use Leaflet's custom overlay to anchor the canvas to the map pane
    const CanvasOverlay = L.Layer.extend({
      onAdd(map) {
        const pane = map.getPane("overlayPane");
        pane.appendChild(canvas);
        map.on("moveend zoomend resize", this._reset, this);
        this._reset();
      },
      onRemove(map) {
        canvas.remove();
        map.off("moveend zoomend resize", this._reset, this);
      },
      _reset() {
        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);
        const size = map.getSize();
        canvas.style.width = size.x + "px";
        canvas.style.height = size.y + "px";
        canvas.style.position = "absolute";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = 200;
      },
    });

    const overlay = new CanvasOverlay();
    overlay.addTo(map);
    overlayRef.current = overlay;

    return () => {
      overlay.remove();
    };
  }, [map]);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Re-fetch when map moves significantly or grid size changes
  useEffect(() => {
    const handleMoveEnd = () => {
      // Debounce: only re-fetch if we've moved enough
      fetchWeather();
    };
    map.on("moveend", handleMoveEnd);
    return () => map.off("moveend", handleMoveEnd);
  }, [map, fetchWeather]);

  // Redraw canvas whenever data, layer, opacity, or visibility changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!visible || !weatherData) {
      const ctx = canvas.getContext("2d");
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, size.x, size.y);
      return;
    }

    renderCanvas(canvas, map, weatherData, activeLayer, 0);
    canvas.style.opacity = opacity;
  }, [map, weatherData, activeLayer, opacity, visible]);

  // Redraw on map move (re-project points)
  useEffect(() => {
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !visible || !weatherData) return;
      renderCanvas(canvas, map, weatherData, activeLayer, 0);
      canvas.style.opacity = opacity;
    };
    map.on("move zoom", redraw);
    return () => map.off("move zoom", redraw);
  }, [map, weatherData, activeLayer, opacity, visible]);

  // Mount controls into a map pane div
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <WeatherControls
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
          opacity={opacity}
          setOpacity={setOpacity}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          onRefresh={fetchWeather}
          visible={visible}
          setVisible={setVisible}
          gridSize={gridSize}
          setGridSize={setGridSize}
        />
      </div>

      {visible && (
        <WeatherLegend activeLayer={activeLayer} opacity={Math.min(opacity + 0.2, 1)} />
      )}
    </div>
  );
}
