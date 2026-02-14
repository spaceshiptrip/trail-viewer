import { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Customized,
} from "recharts";
import {
  Mountain,
  TrendingUp,
  MapPin,
  Cloud,
  Wind,
  Droplets,
  Calendar,
  Activity,
  Share2,
  Download,
  Zap,
} from "lucide-react";
import {
  getElevationProfile,
  fetchWeather,
  fetchAQI,
  calculateEquivalentFlatDistance,
  calculateClimbFactor,
  calculateGradePerPoint,
  gradeColorForPct,
} from "../utils";

function gpxUrlForTrack(track) {
  const file = track?.file;
  const name = track?.properties?.name;

  if (file) {
    return `${import.meta.env.BASE_URL}tracks/gpx/${file.replace(".geojson", ".gpx")}`;
  }

  if (name) {
    return `${import.meta.env.BASE_URL}tracks/gpx/${encodeURIComponent(name)}.gpx`;
  }

  return "#";
}

export default function Sidebar({
  track,
  onClose,
  onCursorPosition,
  mapHoverIndex,
}) {
  const [weather, setWeather] = useState(null);
  const [aqi, setAqi] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingAQI, setLoadingAQI] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [snapState, setSnapState] = useState("minimized"); // 'minimized', 'mid', 'full'
  const [copySuccess, setCopySuccess] = useState(false);
  const [showGradeOverlay, setShowGradeOverlay] = useState(false); // default OFF
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);

  const gradeMenuRef = useRef(null);
  const profileRef = useRef(null);

  // Calculate equivalent flat distance and climb factor
  const { equivalentDistance, climbFactor } = useMemo(() => {
    if (!track) return { equivalentDistance: 0, climbFactor: 0 };

    const coords =
      track.geometry.type === "LineString"
        ? track.geometry.coordinates
        : track.geometry.coordinates[0];

    return {
      equivalentDistance: calculateEquivalentFlatDistance(coords),
      climbFactor: calculateClimbFactor(coords),
    };
  }, [track]);

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

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("track", track.properties.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const cycleSnapState = () => {
    if (snapState === "minimized") setSnapState("mid");
    else if (snapState === "mid") setSnapState("full");
    else setSnapState("minimized");
  };

  useEffect(() => {
    if (track) {
      setLoadingWeather(true);
      setLoadingAQI(true);

      const center =
        track.geometry.type === "LineString"
          ? track.geometry.coordinates[
              Math.floor(track.geometry.coordinates.length / 2)
            ]
          : track.geometry.coordinates[0][
              Math.floor(track.geometry.coordinates[0].length / 2)
            ];

      // Fetch weather
      fetchWeather(center[1], center[0])
        .then((data) => {
          setWeather(data);
          setLoadingWeather(false);
        })
        .catch(() => setLoadingWeather(false));

      // Fetch AQI
      fetchAQI(center[1], center[0])
        .then((data) => {
          setAqi(data);
          setLoadingAQI(false);
        })
        .catch(() => setLoadingAQI(false));
    }
  }, [track]);

  if (!track) return null;

  useEffect(() => {
    if (snapState === "mid" && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [snapState]);

  useEffect(() => {
    if (!gradeMenuOpen) return;

    const onDown = (e) => {
      if (gradeMenuRef.current && !gradeMenuRef.current.contains(e.target)) {
        setGradeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [gradeMenuOpen]);

  const coords =
    track.geometry.type === "LineString"
      ? track.geometry.coordinates
      : track.geometry.coordinates[0];

  const elevationProfile = getElevationProfile(coords);
  const hasElevation =
    elevationProfile.length > 0 && elevationProfile[0].elevation !== 0;

  const gradePerPoint = useMemo(() => {
    // aligned to coords; sidebar elevationProfile is expected to match indexing
    return calculateGradePerPoint(coords);
  }, [coords]);

  const gradeAtDistance = (distMi) => {
    if (!elevationProfile?.length) return null;

    // Find nearest point by distance
    let bestIdx = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < elevationProfile.length; i++) {
      const d = Math.abs(elevationProfile[i].distance - distMi);
      if (d < bestDelta) {
        bestDelta = d;
        bestIdx = i;
      }
    }

    const g = gradePerPoint?.[bestIdx];
    return typeof g === "number" ? g : null;
  };

  const gradeColors = useMemo(() => {
    return gradePerPoint.map((g) => gradeColorForPct(g));
  }, [gradePerPoint]);

  // Calculate height based on snap state
  const getHeight = () => {
    if (snapState === "minimized") return "h-[80px]";
    if (snapState === "mid") return "h-[330px]";
    return "h-[85vh]";
  };

  const renderGradeOverlay = (rechartsProps) => {
    if (!showGradeOverlay) return null;

    // Recharts provides the already-laid-out points for the Line(s)
    const items = rechartsProps?.formattedGraphicalItems || [];

    // Find the elevation Line item (dataKey === "elevation")
    const elevItem =
      items.find((it) => it?.props?.dataKey === "elevation") ||
      items.find((it) => it?.item?.props?.dataKey === "elevation") ||
      null;

    const points =
      elevItem?.props?.points || elevItem?.item?.props?.points || null;

    if (!points || points.length < 2) return null;

    const segs = [];

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];

      const x0 = Number(p0?.x);
      const y0 = Number(p0?.y);
      const x1 = Number(p1?.x);
      const y1 = Number(p1?.y);

      if (![x0, y0, x1, y1].every(Number.isFinite)) continue;

      const stroke = gradeColors[i] || "var(--accent-primary)";

      segs.push(
        <line
          key={`gseg-${i}`}
          x1={x0}
          y1={y0}
          x2={x1}
          y2={y1}
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />,
      );
    }

    return <g>{segs}</g>;
  };

  // ✅ FIX: allow desktop to render full content even if snapState is minimized/full-gated
  const isDesktop =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches;

  return (
    <div
      className={`w-full lg:w-96 lg:h-full bg-[var(--bg-secondary)] lg:border-l border-[var(--border-color)] overflow-hidden flex flex-col transition-all duration-300 ${getHeight()} lg:!h-full`}
    >
      {/* Mobile Drag Handle - single unified one */}
      <button
        onClick={cycleSnapState}
        className={`lg:hidden w-full flex items-center justify-center shrink-0 cursor-pointer active:bg-[var(--bg-tertiary)] ${snapState === "minimized" ? "py-1" : "py-3"}`}
      >
        <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div
          className={`border-b border-[var(--border-color)] lg:sticky lg:top-0 bg-[var(--bg-secondary)] z-10 ${snapState === "minimized" ? "px-4 pt-0 pb-2" : "p-6"}`}
        >
          <div
            className={`flex justify-between items-start gap-3 ${snapState === "minimized" ? "mb-1" : "mb-4"}`}
          >
            <h2
              className={`text-2xl font-display font-bold text-[var(--accent-primary)] ${snapState === "minimized" ? "line-clamp-2" : ""}`}
            >
              {track.properties.name || "Unnamed Track"}
            </h2>
            <div className="flex gap-2 shrink-0 ml-2">
              <a
                href={gpxUrlForTrack(track)}
                download
                title="Download GPX"
                aria-label="Download GPX"
                onClick={(e) => e.stopPropagation()}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={handleCopyLink}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1"
                title="Copy link"
              >
                {copySuccess ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {snapState !== "minimized" && track.properties.description && (
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              {track.properties.description}
            </p>
          )}
        </div>

        {/* Stats Grid */}

        <div
          className={`${snapState === "minimized" ? "hidden lg:block" : ""}`}
        >
          {(snapState !== "minimized" || isDesktop) && (
            <div className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="sidebar-section">
                  <div className="flex items-center gap-2 mb-2">
                    <Mountain className="w-4 h-4 text-[var(--accent-primary)]" />
                    <div className="stat-label">Distance</div>
                  </div>
                  <div className="stat-value">
                    {track.properties.distance?.toFixed(2) || "0"} mi
                  </div>
                </div>

                <div className="sidebar-section">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                    <div className="stat-label">Elevation Gain</div>
                  </div>
                  <div className="stat-value">
                    {track.properties.elevationGain?.toFixed(0) || "0"} ft
                  </div>
                </div>
              </div>

              {/* Elevation Profile */}
              {hasElevation && (
                <div ref={profileRef} className="sidebar-section">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">
                      Elevation Profile
                    </h3>

                    <div className="relative" ref={gradeMenuRef}>
                      <button
                        onClick={() => setGradeMenuOpen((v) => !v)}
                        className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1"
                        title="Options"
                        aria-label="Options"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      </button>

                      {gradeMenuOpen && (
                        <div className="absolute top-8 right-0 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-3 min-w-[200px]">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-[var(--text-primary)]">
                              Grade overlay
                            </span>
                            <input
                              type="checkbox"
                              checked={showGradeOverlay}
                              onChange={(e) =>
                                setShowGradeOverlay(e.target.checked)
                              }
                              className="ml-2"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={elevationProfile}
                      onMouseMove={handleChartMouseMove}
                      onMouseLeave={handleChartMouseLeave}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-color)"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="distance"
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                        label={{
                          value: "Distance (mi)",
                          position: "insideBottom",
                          offset: -5,
                          fill: "var(--text-secondary)",
                        }}
                        tickFormatter={(value) => value.toFixed(1)}
                      />
                      <YAxis
                        stroke="var(--text-secondary)"
                        tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                        label={{
                          value: "Elevation (ft)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "var(--text-secondary)",
                        }}
                        tickFormatter={(value) => Math.round(value)}
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                        }}
                        // title line: miles (unchanged)
                        labelFormatter={(value) => `${value.toFixed(2)} mi`}
                        // body lines: elevation (+ grade if overlay enabled)
                        formatter={(value, name, payload) => {
                          // For the elevation line, `value` is elevation.
                          const elevationFt = Math.round(value);

                          if (!showGradeOverlay) {
                            return [`${elevationFt} ft`, "Elevation"];
                          }

                          // When overlay is on, include grade %
                          const distMi = payload?.payload?.distance;
                          const g =
                            typeof distMi === "number"
                              ? gradeAtDistance(distMi)
                              : null;
                          const gradeStr =
                            typeof g === "number" ? `${g.toFixed(1)}%` : "—";

                          // Recharts Tooltip expects an array of [value, name] pairs when returning arrays,
                          // but its "formatter" runs per item. We can return a multiline string value.
                          return [
                            `${elevationFt} ft\n${gradeStr}`,
                            "Elevation / Grade",
                          ];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="elevation"
                        stroke="var(--accent-primary)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: "var(--accent-primary)" }}
                      />

                      {showGradeOverlay && (
                        <Customized component={renderGradeOverlay} />
                      )}

                      {mapHoverIndex !== null &&
                        elevationProfile[mapHoverIndex] && (
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

              {/* Energy Expenditure Metrics */}
              {equivalentDistance > 0 && (
                <div className="sidebar-section">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                    <div className="stat-label">Energy Metrics</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[var(--text-secondary)] text-sm">
                        Equivalent Flat Distance
                      </span>
                      <span className="text-lg font-display font-bold text-[var(--accent-primary)]">
                        {equivalentDistance.toFixed(2)} mi
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[var(--text-secondary)] text-sm">
                        Climb Factor
                      </span>
                      <span className="text-lg font-display font-bold text-[var(--accent-primary)]">
                        {(climbFactor * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] mt-2 italic">
                    Source:{" "}
                    <a
                      href="https://www.biorxiv.org/content/10.1101/2021.04.03.438339v3.full"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[var(--accent-primary)]"
                    >
                      Crowell, "From Treadmill to Trails" (2021)
                    </a>
                  </p>
                </div>
              )}

              {/* Weather Section - only show in full mode */}

              <div
                className={`${snapState !== "full" ? "hidden lg:block" : ""}`}
              >
                {(snapState === "full" || isDesktop) && (
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
                          <div className="text-[var(--text-secondary)] text-sm mb-2">
                            Current Conditions
                          </div>
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
                )}
              </div>

              {/* Air Quality Section - only show in full mode */}

              <div
                className={`${snapState !== "full" ? "hidden lg:block" : ""}`}
              >
                {(snapState === "full" || isDesktop) && (
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
                          <div className="text-[var(--text-secondary)] text-sm mb-3">
                            Current Air Quality Index
                          </div>
                          <div className="flex items-center gap-4">
                            <div
                              className="w-20 h-20 rounded-full flex items-center justify-center font-display font-bold text-2xl"
                              style={{
                                backgroundColor: aqi.current.category.color,
                                color: aqi.current.category.textColor,
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
                            <div className="text-[var(--text-secondary)] text-sm mb-3">
                              24-Hour Forecast
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-[var(--text-primary)] font-medium">
                                Expected AQI
                              </div>
                              <div className="flex items-center gap-3">
                                <div
                                  className="px-3 py-1 rounded-full font-display font-bold"
                                  style={{
                                    backgroundColor:
                                      aqi.forecast.category.color,
                                    color: aqi.forecast.category.textColor,
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
