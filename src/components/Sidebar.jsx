import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom"; // createPortal must come from react-dom, not react
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Expand,
  Minimize2,
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
  const [showGradeOverlay, setShowGradeOverlay] = useState(false);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);
  const [sortGradeMetrics, setSortGradeMetrics] = useState(false);

  // Zoom state
  const [zoomDomain, setZoomDomain] = useState(null);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);

  const gradeMenuRef = useRef(null);
  const profileRef = useRef(null);

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

  const handleChartMouseMove = (data) => {
    if (data && data.activeTooltipIndex !== undefined) {
      setHoveredPoint(data.activeTooltipIndex);
      if (onCursorPosition) onCursorPosition(data.activeTooltipIndex);
    }
  };

  const handleChartMouseLeave = () => {
    setHoveredPoint(null);
    if (onCursorPosition) onCursorPosition(null);
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

      fetchWeather(center[1], center[0])
        .then((data) => { setWeather(data); setLoadingWeather(false); })
        .catch(() => setLoadingWeather(false));

      fetchAQI(center[1], center[0])
        .then((data) => { setAqi(data); setLoadingAQI(false); })
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

  const gradePerPoint = useMemo(() => calculateGradePerPoint(coords), [coords]);

  const isZoomed = zoomDomain !== null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!elevationProfile?.length) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowLeft":
          if (isZoomed) { e.preventDefault(); handlePanLeft(); }
          break;
        case "ArrowRight":
          if (isZoomed) { e.preventDefault(); handlePanRight(); }
          break;
        case "+": case "=":
          e.preventDefault(); handleZoomIn();
          break;
        case "-": case "_":
          if (isZoomed) { e.preventDefault(); handleZoomOut(); }
          break;
        case "0": case "Escape":
          if (isZoomed) { e.preventDefault(); handleZoomReset(); }
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed, elevationProfile]);

  // Zoom helpers
  const getDistanceDomain = () => {
    if (!elevationProfile?.length) return [0, 0];
    return [
      Number(elevationProfile[0].distance) || 0,
      Number(elevationProfile[elevationProfile.length - 1].distance) || 0,
    ];
  };
  const [fullMin, fullMax] = getDistanceDomain();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const handleZoomIn = () => {
    const [min, max] = zoomDomain || [fullMin, fullMax];
    const span = max - min;
    if (span <= 0.1) return;
    const mid = (min + max) / 2;
    const nextSpan = span * 0.6;
    setZoomDomain([clamp(mid - nextSpan / 2, fullMin, fullMax), clamp(mid + nextSpan / 2, fullMin, fullMax)]);
  };

  const handleZoomOut = () => {
    const [min, max] = zoomDomain || [fullMin, fullMax];
    const span = max - min;
    if (span <= 0) return;
    const mid = (min + max) / 2;
    const nextSpan = span * 1.67;
    let nextMin = mid - nextSpan / 2;
    let nextMax = mid + nextSpan / 2;
    if (nextMin < fullMin) { nextMax += fullMin - nextMin; nextMin = fullMin; }
    if (nextMax > fullMax) { nextMin -= nextMax - fullMax; nextMax = fullMax; }
    nextMin = clamp(nextMin, fullMin, fullMax);
    nextMax = clamp(nextMax, fullMin, fullMax);
    if (nextMax - nextMin >= (fullMax - fullMin) * 0.95) { handleZoomReset(); return; }
    setZoomDomain([nextMin, nextMax]);
  };

  const handleZoomReset = () => setZoomDomain(null);

  const handlePanLeft = () => {
    const [min, max] = zoomDomain || [fullMin, fullMax];
    const span = max - min;
    if (span <= 0) return;
    const shift = span * 0.25;
    let nextMin = min - shift;
    let nextMax = max - shift;
    if (nextMin < fullMin) { nextMin = fullMin; nextMax = fullMin + span; }
    setZoomDomain([nextMin, nextMax]);
  };

  const handlePanRight = () => {
    const [min, max] = zoomDomain || [fullMin, fullMax];
    const span = max - min;
    if (span <= 0) return;
    const shift = span * 0.25;
    let nextMin = min + shift;
    let nextMax = max + shift;
    if (nextMax > fullMax) { nextMax = fullMax; nextMin = fullMax - span; }
    setZoomDomain([nextMin, nextMax]);
  };

  const handleToggleExpand = () => setIsGraphExpanded((v) => !v);

  const GRADE_BINS = useMemo(() => [
    { key: "g25",  label: "≥ 25%",      min: 25,       max: Infinity, color: "#ff0000" },
    { key: "g20",  label: "20–24.9%",   min: 20,       max: 25,       color: "#ff6600" },
    { key: "g15",  label: "15–19.9%",   min: 15,       max: 20,       color: "#ff9900" },
    { key: "g10",  label: "10–14.9%",   min: 10,       max: 15,       color: "#ffcc00" },
    { key: "g5",   label: "5–9.9%",     min: 5,        max: 10,       color: "#ccff00" },
    { key: "g0",   label: "0–4.9%",     min: 0,        max: 5,        color: "#00ff00" },
    { key: "gm5",  label: "-5–-0.1%",   min: -5,       max: 0,        color: "#00ccff" },
    { key: "gm10", label: "-10–-5.1%",  min: -10,      max: -5,       color: "#3399ff" },
    { key: "gmInf",label: "< -10%",     min: -Infinity,max: -10,      color: "#6666ff" },
  ], []);

  const haversineMeters = (a, b) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371e3;
    const lat1 = toRad(a[1]), lat2 = toRad(b[1]);
    const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };

  const gradeMetrics = useMemo(() => {
    if (!coords || coords.length < 2) return null;
    if (!gradePerPoint || gradePerPoint.length !== coords.length) return null;
    const sumsMeters = Object.fromEntries(GRADE_BINS.map((b) => [b.key, 0]));
    let totalMeters = 0;
    const binForGrade = (g) => GRADE_BINS.find((b) => g >= b.min && g < b.max) ?? GRADE_BINS[GRADE_BINS.length - 1];
    for (let i = 1; i < coords.length; i++) {
      const seg = haversineMeters(coords[i - 1], coords[i]);
      if (!Number.isFinite(seg) || seg <= 0) continue;
      const b = binForGrade(Number(gradePerPoint[i] ?? 0));
      sumsMeters[b.key] += seg;
      totalMeters += seg;
    }
    if (totalMeters <= 0) return null;
    const toMi = (m) => m / 1609.34;
    return {
      totalMiles: toMi(totalMeters),
      rows: GRADE_BINS.map((b) => {
        const m = sumsMeters[b.key] || 0;
        return { ...b, meters: m, miles: toMi(m), percent: (m / totalMeters) * 100 };
      }),
    };
  }, [coords, gradePerPoint, GRADE_BINS]);

  const gradeMetricsRows = useMemo(() => {
    if (!gradeMetrics?.rows) return [];
    if (!sortGradeMetrics) return gradeMetrics.rows;
    return [...gradeMetrics.rows].sort((a, b) => b.miles - a.miles || (b.percent ?? 0) - (a.percent ?? 0));
  }, [gradeMetrics, sortGradeMetrics]);

  const gradeAtDistance = (distMi) => {
    if (!elevationProfile?.length) return null;
    let bestIdx = 0, bestDelta = Infinity;
    for (let i = 0; i < elevationProfile.length; i++) {
      const d = Math.abs(elevationProfile[i].distance - distMi);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    const g = gradePerPoint?.[bestIdx];
    return typeof g === "number" ? g : null;
  };

  const gradeColors = useMemo(() => gradePerPoint.map((g) => gradeColorForPct(g)), [gradePerPoint]);

  const getHeight = () => {
    if (snapState === "minimized") return "h-[80px]";
    if (snapState === "mid") return "h-[330px]";
    return "h-[85vh]";
  };

  // Expanded graph takes ~370px at bottom (260 chart + 48 header + 36 padding + 24 hint + 2 border)
  const EXPANDED_GRAPH_HEIGHT = 370;
  const getSidebarStyle = () => {
    if (!isDesktop || !isGraphExpanded) return {};
    return { maxHeight: `calc(100vh - ${EXPANDED_GRAPH_HEIGHT}px)` };
  };

  // Smart close: if graph expanded, just minimize graph; otherwise close sidebar
  const handleCloseSidebar = () => {
    if (isGraphExpanded) {
      setIsGraphExpanded(false);
    } else {
      onClose();
    }
  };

  const hexToRgba = (hex, a = 0.22) => {
    if (!hex) return `rgba(0,0,0,${a})`;
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const renderGradeOverlay = (rechartsProps) => {
    if (!showGradeOverlay) return null;
    const items = rechartsProps?.formattedGraphicalItems || [];
    const elevItem = items.find((it) => it?.props?.dataKey === "elevation") || items.find((it) => it?.item?.props?.dataKey === "elevation") || null;
    const points = elevItem?.props?.points || elevItem?.item?.props?.points || null;
    const offset = rechartsProps?.offset;
    if (!points || points.length < 2 || !offset) return null;
    const baselineY = offset.top + offset.height;
    const fills = [], lines = [];
    for (let i = 1; i < points.length; i++) {
      const { x: x0, y: y0 } = points[i - 1];
      const { x: x1, y: y1 } = points[i];
      if (![x0, y0, x1, y1, baselineY].every(Number.isFinite)) continue;
      const stroke = gradeColors[i] || "var(--accent-primary)";
      fills.push(
        <polygon key={`gfill-${i}`} points={`${x0},${baselineY} ${x0},${y0} ${x1},${y1} ${x1},${baselineY}`} fill={hexToRgba(stroke, 0.2)} stroke="none" style={{ pointerEvents: "none" }} />
      );
      lines.push(
        <line key={`gline-${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={stroke} strokeWidth={3} strokeLinecap="round" style={{ pointerEvents: "none" }} />
      );
    }
    return <g>{fills}{lines}</g>;
  };

  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  return (
    <>
      {/* Expanded graph overlay — portal renders it on <body>, not inside the w-96 sidebar */}
      {isGraphExpanded && isDesktop && (
        <ExpandedGraphOverlay
          track={track}
          onClose={() => setIsGraphExpanded(false)}
          zoomDomain={zoomDomain}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onPanLeft={handlePanLeft}
          onPanRight={handlePanRight}
          isZoomed={isZoomed}
          onCursorPosition={onCursorPosition}
          mapHoverIndex={mapHoverIndex}
          showGradeOverlay={showGradeOverlay}
          onToggleGradeOverlay={() => setShowGradeOverlay((v) => !v)}
          gradeColors={gradeColors}
          gradeAtDistance={gradeAtDistance}
        />
      )}

      {/* Main Sidebar */}
      <div
        className={`w-full lg:w-96 lg:h-full bg-[var(--bg-secondary)] lg:border-l border-[var(--border-color)] overflow-hidden flex flex-col transition-all duration-300 ${getHeight()} lg:!h-full`}
        style={getSidebarStyle()}
      >
        {/* Mobile Drag Handle */}
        <button
          onClick={cycleSnapState}
          className={`lg:hidden w-full flex items-center justify-center shrink-0 cursor-pointer active:bg-[var(--bg-tertiary)] ${snapState === "minimized" ? "py-1" : "py-3"}`}
        >
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className={`border-b border-[var(--border-color)] lg:sticky lg:top-0 bg-[var(--bg-secondary)] z-10 ${snapState === "minimized" ? "px-4 pt-0 pb-2" : "p-6"}`}>
            <div className={`flex justify-between items-start gap-3 ${snapState === "minimized" ? "mb-1" : "mb-4"}`}>
              <h2 className={`text-2xl font-display font-bold text-[var(--accent-primary)] ${snapState === "minimized" ? "line-clamp-2" : ""}`}>
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
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleCloseSidebar}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
                  title={isGraphExpanded ? "Minimize graph" : "Close sidebar"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

          {/* Stats */}
          <div className={`${snapState === "minimized" ? "hidden lg:block" : ""}`}>
            {(snapState !== "minimized" || isDesktop) && (
              <div className="p-6 space-y-4">

                {track.properties.location && (
                  <div className="sidebar-section">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div className="stat-label">Location</div>
                    </div>
                    <div className="text-[var(--text-primary)] font-medium">{track.properties.location}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="sidebar-section">
                    <div className="flex items-center gap-2 mb-2">
                      <Mountain className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div className="stat-label">Distance</div>
                    </div>
                    <div className="stat-value">{track.properties.distance?.toFixed(2) || "0"} mi</div>
                  </div>
                  <div className="sidebar-section">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div className="stat-label">Elevation Gain</div>
                    </div>
                    <div className="stat-value">{track.properties.elevationGain?.toFixed(0) || "0"} ft</div>
                  </div>
                </div>

                {/* Elevation Profile */}
                {hasElevation && (
                  <div ref={profileRef} className="sidebar-section">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">
                        Elevation Profile
                      </h3>

                      <div className="flex items-center gap-1">
                        {/* Pan (only when zoomed) */}
                        {isZoomed && (
                          <>
                            <button onClick={handlePanLeft} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" title="Pan left" aria-label="Pan left">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={handlePanRight} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" title="Pan right" aria-label="Pan right">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
                          </>
                        )}

                        {/* Zoom */}
                        <button onClick={handleZoomOut} disabled={!isZoomed} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="Zoom out" aria-label="Zoom out">
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        <button onClick={handleZoomIn} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" title="Zoom in" aria-label="Zoom in">
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button onClick={handleZoomReset} disabled={!isZoomed} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="Reset zoom" aria-label="Reset zoom">
                          <Maximize2 className="w-5 h-5" />
                        </button>

                        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

                        {/* Expand (desktop only) */}
                        <button
                          onClick={handleToggleExpand}
                          className="hidden lg:block text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1"
                          title={isGraphExpanded ? "Minimize graph" : "Expand graph"}
                          aria-label={isGraphExpanded ? "Minimize graph" : "Expand graph"}
                        >
                          {isGraphExpanded ? <Minimize2 className="w-5 h-5" /> : <Expand className="w-5 h-5" />}
                        </button>

                        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

                        {/* Options menu */}
                        <div className="relative" ref={gradeMenuRef}>
                          <button onClick={() => setGradeMenuOpen((v) => !v)} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" title="Options" aria-label="Options">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5"  r="1.5" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                              <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                            </svg>
                          </button>
                          {gradeMenuOpen && (
                            <div className="absolute top-8 right-0 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-3 min-w-[200px]">
                              <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-[var(--text-primary)]">Grade overlay</span>
                                <input type="checkbox" checked={showGradeOverlay} onChange={(e) => setShowGradeOverlay(e.target.checked)} className="ml-2" />
                              </label>
                              <label className="flex items-center justify-between cursor-pointer mt-2">
                                <span className="text-sm text-[var(--text-primary)]">Sort grade metrics</span>
                                <input type="checkbox" checked={sortGradeMetrics} onChange={(e) => setSortGradeMetrics(e.target.checked)} className="ml-2" />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={elevationProfile} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                        <XAxis
                          dataKey="distance"
                          stroke="var(--text-secondary)"
                          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                          label={{ value: "Distance (mi)", position: "insideBottom", offset: -5, fill: "var(--text-secondary)" }}
                          tickFormatter={(v) => v.toFixed(1)}
                          domain={zoomDomain || [fullMin, fullMax]}
                          type="number"
                          allowDataOverflow
                        />
                        <YAxis
                          stroke="var(--text-secondary)"
                          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                          label={{ value: "Elevation (ft)", angle: -90, position: "insideLeft", fill: "var(--text-secondary)" }}
                          tickFormatter={(v) => Math.round(v)}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)" }}
                          labelFormatter={(v) => `${v.toFixed(2)} mi`}
                          formatter={(value, name, payload) => {
                            const elevationFt = Math.round(value);
                            if (!showGradeOverlay) return [`${elevationFt} ft`, "Elevation"];
                            const distMi = payload?.payload?.distance;
                            const g = typeof distMi === "number" ? gradeAtDistance(distMi) : null;
                            const gradeStr = typeof g === "number" ? `${g.toFixed(1)}%` : "—";
                            return [`${elevationFt} ft\n${gradeStr}`, "Elevation / Grade"];
                          }}
                        />
                        <Line type="monotone" dataKey="elevation" stroke="var(--accent-primary)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "var(--accent-primary)" }} />
                        {showGradeOverlay && <Customized component={renderGradeOverlay} />}
                        {mapHoverIndex !== null && elevationProfile[mapHoverIndex] && (
                          <ReferenceDot x={elevationProfile[mapHoverIndex].distance} y={elevationProfile[mapHoverIndex].elevation} r={8} fill="var(--accent-primary)" stroke="#fff" strokeWidth={3} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Grade Metrics */}
                {gradeMetrics && (
                  <div className="sidebar-section">
                    <h3 className="text-lg font-display font-semibold mb-4 text-[var(--accent-primary)]">Grade Metrics</h3>
                    <div className="space-y-2">
                      {gradeMetricsRows.map((r) => (
                        <div key={r.key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="text-sm text-[var(--text-primary)] truncate">{r.label}</span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-sm text-[var(--text-secondary)] tabular-nums">{r.percent.toFixed(1)}%</span>
                            <span className="text-sm text-[var(--text-secondary)] tabular-nums w-[72px] text-right">{r.miles.toFixed(2)} mi</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Total</span>
                      <span className="text-[var(--text-primary)] font-medium tabular-nums">{gradeMetrics.totalMiles.toFixed(2)} mi</span>
                    </div>
                  </div>
                )}

                {/* Energy Metrics */}
                {equivalentDistance > 0 && (
                  <div className="sidebar-section">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                      <div className="stat-label">Energy Metrics</div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[var(--text-secondary)] text-sm">Equivalent Flat Distance</span>
                        <span className="text-lg font-display font-bold text-[var(--accent-primary)]">{equivalentDistance.toFixed(2)} mi</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[var(--text-secondary)] text-sm">Climb Factor</span>
                        <span className="text-lg font-display font-bold text-[var(--accent-primary)]">{(climbFactor * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2 italic">
                      Source:{" "}
                      <a href="https://www.biorxiv.org/content/10.1101/2021.04.03.438339v3.full" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">
                        Crowell, "From Treadmill to Trails" (2021)
                      </a>
                    </p>
                  </div>
                )}

                {/* Weather */}
                <div className={`${snapState !== "full" ? "hidden lg:block" : ""}`}>
                  {(snapState === "full" || isDesktop) && (
                    <div className="sidebar-section">
                      <div className="flex items-center gap-2 mb-4">
                        <Cloud className="w-5 h-5 text-[var(--accent-primary)]" />
                        <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">Weather Conditions</h3>
                      </div>
                      {loadingWeather && <div className="text-[var(--text-secondary)] text-center py-4 loading-pulse">Loading weather...</div>}
                      {!loadingWeather && weather && (
                        <>
                          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                            <div className="text-[var(--text-secondary)] text-sm mb-2">Current Conditions</div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-4xl font-display font-bold text-[var(--accent-primary)]">{weather.current.temp}°F</div>
                                <div className="text-[var(--text-secondary)] mt-1">{weather.current.condition}</div>
                              </div>
                              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                <Wind className="w-4 h-4" />
                                {weather.current.windSpeed} mph
                              </div>
                            </div>
                          </div>
                          <div className="text-[var(--text-secondary)] text-sm mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            5-Day Forecast
                          </div>
                          <div className="space-y-2">
                            {weather.forecast.map((day, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-[var(--bg-tertiary)] rounded-lg">
                                <div className="text-[var(--text-primary)] font-medium w-16">{day.date}</div>
                                <div className="text-[var(--text-secondary)] text-sm flex-1">{day.condition}</div>
                                <div className="flex items-center gap-3">
                                  <div className="text-[var(--accent-primary)] font-semibold">{day.high}°</div>
                                  <div className="text-[var(--text-secondary)]">{day.low}°</div>
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
                      {!loadingWeather && !weather && <div className="text-[var(--text-secondary)] text-center py-4">Weather data unavailable</div>}
                    </div>
                  )}
                </div>

                {/* Air Quality */}
                <div className={`${snapState !== "full" ? "hidden lg:block" : ""}`}>
                  {(snapState === "full" || isDesktop) && (
                    <div className="sidebar-section">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-[var(--accent-primary)]" />
                        <h3 className="text-lg font-display font-semibold text-[var(--accent-primary)]">Air Quality</h3>
                      </div>
                      {loadingAQI && <div className="text-[var(--text-secondary)] text-center py-4 loading-pulse">Loading air quality...</div>}
                      {!loadingAQI && aqi && (
                        <>
                          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
                            <div className="text-[var(--text-secondary)] text-sm mb-3">Current Air Quality Index</div>
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-20 rounded-full flex items-center justify-center font-display font-bold text-2xl"
                                style={{ backgroundColor: aqi.current.category.color, color: aqi.current.category.textColor }}>
                                {aqi.current.aqi}
                              </div>
                              <div className="flex-1">
                                <div className="text-[var(--text-primary)] font-semibold mb-1">{aqi.current.category.name}</div>
                                {aqi.current.pm25 && <div className="text-[var(--text-secondary)] text-sm">PM2.5: {aqi.current.pm25} µg/m³</div>}
                                {aqi.current.pm10 && <div className="text-[var(--text-secondary)] text-sm">PM10: {aqi.current.pm10} µg/m³</div>}
                              </div>
                            </div>
                          </div>
                          {aqi.forecast && (
                            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                              <div className="text-[var(--text-secondary)] text-sm mb-3">24-Hour Forecast</div>
                              <div className="flex items-center justify-between">
                                <div className="text-[var(--text-primary)] font-medium">Expected AQI</div>
                                <div className="flex items-center gap-3">
                                  <div className="px-3 py-1 rounded-full font-display font-bold"
                                    style={{ backgroundColor: aqi.forecast.category.color, color: aqi.forecast.category.textColor }}>
                                    {aqi.forecast.aqi}
                                  </div>
                                  <div className="text-[var(--text-secondary)] text-sm">{aqi.forecast.category.name}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {!loadingAQI && !aqi && <div className="text-[var(--text-secondary)] text-center py-4">Air quality data unavailable</div>}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ExpandedGraphOverlay
// Uses createPortal → renders on <body>, NOT inside the sidebar,
// so it goes full-width across the entire screen.
// ─────────────────────────────────────────────────────────────
function ExpandedGraphOverlay({
  track,
  onClose,
  zoomDomain,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onPanLeft,
  onPanRight,
  isZoomed,
  onCursorPosition,
  mapHoverIndex,
  showGradeOverlay,
  onToggleGradeOverlay,
  gradeColors,
  gradeAtDistance,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const coords =
    track.geometry.type === "LineString"
      ? track.geometry.coordinates
      : track.geometry.coordinates[0];

  const elevationProfile = getElevationProfile(coords);

  const fullMin = Number(elevationProfile[0]?.distance) || 0;
  const fullMax = Number(elevationProfile[elevationProfile.length - 1]?.distance) || 0;

  const handleChartMouseMove = (data) => {
    if (data?.activeTooltipIndex !== undefined && onCursorPosition) {
      onCursorPosition(data.activeTooltipIndex);
    }
  };
  const handleChartMouseLeave = () => onCursorPosition?.(null);

  // Grade overlay renderer (same logic as sidebar)
  const hexToRgba = (hex, a = 0.2) => {
    if (!hex) return `rgba(0,0,0,${a})`;
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const renderGradeOverlay = (rechartsProps) => {
    if (!showGradeOverlay || !gradeColors) return null;
    const items = rechartsProps?.formattedGraphicalItems || [];
    const elevItem =
      items.find((it) => it?.props?.dataKey === "elevation") ||
      items.find((it) => it?.item?.props?.dataKey === "elevation") ||
      null;
    const points = elevItem?.props?.points || elevItem?.item?.props?.points || null;
    const offset = rechartsProps?.offset;
    if (!points || points.length < 2 || !offset) return null;
    const baselineY = offset.top + offset.height;
    const fills = [], lines = [];
    for (let i = 1; i < points.length; i++) {
      const { x: x0, y: y0 } = points[i - 1];
      const { x: x1, y: y1 } = points[i];
      if (![x0, y0, x1, y1, baselineY].every(Number.isFinite)) continue;
      const stroke = gradeColors[i] || "var(--accent-primary)";
      fills.push(
        <polygon key={`gfill-${i}`} points={`${x0},${baselineY} ${x0},${y0} ${x1},${y1} ${x1},${baselineY}`} fill={hexToRgba(stroke)} stroke="none" style={{ pointerEvents: "none" }} />
      );
      lines.push(
        <line key={`gline-${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={stroke} strokeWidth={3} strokeLinecap="round" style={{ pointerEvents: "none" }} />
      );
    }
    return <g>{fills}{lines}</g>;
  };

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[2000] bg-[var(--bg-secondary)] border-t-2 border-[var(--accent-primary)] shadow-2xl">
      <div className="px-6 pt-4 pb-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Mountain className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="text-base font-display font-semibold text-[var(--accent-primary)] truncate">
              {track.properties.name || "Unnamed Track"}
              <span className="text-[var(--text-secondary)] font-normal ml-2 text-sm">— Elevation Profile</span>
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-4">
            {/* Pan */}
            {isZoomed && (
              <>
                <button onClick={onPanLeft}  className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1.5" title="Pan left">  <ChevronLeft  className="w-5 h-5" /></button>
                <button onClick={onPanRight} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1.5" title="Pan right"> <ChevronRight className="w-5 h-5" /></button>
                <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
              </>
            )}

            {/* Zoom */}
            <button onClick={onZoomOut}   disabled={!isZoomed} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Zoom out">  <ZoomOut  className="w-5 h-5" /></button>
            <button onClick={onZoomIn}                         className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] p-1.5 transition-colors"                                                  title="Zoom in">   <ZoomIn   className="w-5 h-5" /></button>
            <button onClick={onZoomReset} disabled={!isZoomed} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Reset zoom"><Maximize2 className="w-5 h-5" /></button>

            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

            {/* ⋮ Settings menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`p-1.5 transition-colors ${menuOpen || showGradeOverlay ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"}`}
                title="Options"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5"  r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute bottom-9 right-0 z-50 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl p-3 min-w-[200px]">
                  <label className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm text-[var(--text-primary)]">Grade overlay</span>
                    <input
                      type="checkbox"
                      checked={showGradeOverlay}
                      onChange={onToggleGradeOverlay}
                      className="ml-2"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

            {/* Minimize */}
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1.5" title="Minimize graph">
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full-width chart */}
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={elevationProfile} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave} margin={{ top: 4, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
            <XAxis
              dataKey="distance"
              stroke="var(--text-secondary)"
              tick={{ fill: "var(--text-secondary)", fontSize: 13 }}
              label={{ value: "Distance (mi)", position: "insideBottom", offset: -8, fill: "var(--text-secondary)", fontSize: 13 }}
              tickFormatter={(v) => v.toFixed(1)}
              domain={zoomDomain || [fullMin, fullMax]}
              type="number"
              allowDataOverflow
            />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 13 }} tickFormatter={(v) => Math.round(v)} width={52} />
            <Tooltip
              position={{ y: 3 }}  // 5px from top, x follows cursor horizontally
              offset={30}
              contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)" }}
              labelFormatter={(v) => `${v.toFixed(2)} mi`}
              formatter={(value, name, payload) => {
                const elevationFt = Math.round(value);
                if (!showGradeOverlay) return [`${elevationFt} ft`, "Elevation"];
                const distMi = payload?.payload?.distance;
                const g = typeof distMi === "number" ? gradeAtDistance(distMi) : null;
                const gradeStr = typeof g === "number" ? `${g.toFixed(1)}%` : "—";
                return [`${elevationFt} ft\n${gradeStr}`, "Elevation / Grade"];
              }}
            />
            <Line type="monotone" dataKey="elevation" stroke="var(--accent-primary)" strokeWidth={7} dot={false} activeDot={{ r: 7, fill: "var(--accent-primary)" }} />

            {/* Grade overlay (same as sidebar) */}
            {showGradeOverlay && <Customized component={renderGradeOverlay} />}

            {mapHoverIndex !== null && elevationProfile[mapHoverIndex] && (
              <ReferenceDot x={elevationProfile[mapHoverIndex].distance} y={elevationProfile[mapHoverIndex].elevation} r={9} fill="var(--accent-primary)" stroke="#fff" strokeWidth={3} />
            )}
          </LineChart>
        </ResponsiveContainer>

        <p className="text-xs text-[var(--text-secondary)] mt-1 text-center italic">
          {isZoomed ? "← → to pan  •  +/- to zoom  •  0 or Esc to reset" : "+/- to zoom  •  Arrow keys to pan when zoomed"}
        </p>
      </div>
    </div>,
    document.body
  );
}
