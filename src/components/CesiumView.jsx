// src/components/CesiumView.jsx

import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

// ✅ Cesium needs its static assets (Workers, etc.).
// In Vite, the common approach is to set CESIUM_BASE_URL to where you copy Cesium assets.
// Example: public/cesium/  (see notes below)
window.CESIUM_BASE_URL =
  window.CESIUM_BASE_URL || `${import.meta.env.BASE_URL}cesium/`;

export default function CesiumView({
  // Point this at one of your existing files like: `${import.meta.env.BASE_URL}tracks/Lukens.geojson`
  geojsonUrl,
  // Optional: if you want to pass a token explicitly; otherwise it uses VITE_CESIUM_ION_TOKEN
  ionToken,
  // Optional: clamp line to terrain (requires terrain)
  clampToGround = true,
  // Optional: width/height styling
  style = { width: "100%", height: "100%" },

  // ✅ NEW: optional cursor + mile markers controls
  cursorIndex = null,
  showMileMarkers = true,

  // ✅ NEW: peaks data - array of {name, lat, lon, elevation}
  peaks = [],
  showPeaks = true, // NEW
  showPeakLabels = true, // NEW
  peakRadius = 10, // NEW
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const dsRef = useRef(null);
  const [err, setErr] = useState(null);

  // ✅ NEW: keep track of whether we already injected OSM imagery fallback
  const osmLayerAddedRef = useRef(false);

  // ✅ NEW: refs for track positions + entities (mile markers + cursor + peaks)
  const trackCoordsRef = useRef(null); // Cartesian3[]
  const mileMarkerEntitiesRef = useRef([]); // Entity[]
  const cursorEntityRef = useRef(null); // Entity
  const peakEntitiesRef = useRef([]); // Entity[] for peaks

  // ✅ NEW: refs for the track polyline entities (outline + core)
  const trackOutlineEntityRef = useRef(null);
  const trackCoreEntityRef = useRef(null);

  // ✅ NEW: "positions ready" tick to prevent markers from using stale coords
  const [trackPositionsTick, setTrackPositionsTick] = useState(0);

  // ✅ NEW: helpers for distances / interpolation along the track
  function metersBetween(a, b) {
    const ca = Cesium.Cartographic.fromCartesian(a);
    const cb = Cesium.Cartographic.fromCartesian(b);
    const geodesic = new Cesium.EllipsoidGeodesic(ca, cb);
    return geodesic.surfaceDistance;
  }

  function interpolateAlong(positions, targetMeters) {
    let acc = 0;
    for (let i = 1; i < positions.length; i++) {
      const seg = metersBetween(positions[i - 1], positions[i]);
      if (acc + seg >= targetMeters) {
        const t = (targetMeters - acc) / seg;
        return Cesium.Cartesian3.lerp(
          positions[i - 1],
          positions[i],
          t,
          new Cesium.Cartesian3(),
        );
      }
      acc += seg;
    }
    return positions[positions.length - 1];
  }

  // ✅ Helper to create Google Maps-style marker WITH TEXT BAKED IN AND GROUND SHADOW
  function createPeakMarkerCanvas(name, elevText, showLabels) {
    const canvas = document.createElement("canvas");
    canvas.width = showLabels ? 200 : 48;
    canvas.height = 64; // Reduced height since shadow will be separate billboard
    const ctx = canvas.getContext("2d");

    // Draw the pin shape (inverted teardrop)
    const pinX = 24;
    const pinY = 16;

    ctx.beginPath();
    ctx.arc(pinX, pinY, 16, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = "#EA4335";
    ctx.fill();
    ctx.strokeStyle = "#B71C1C";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw the point
    ctx.beginPath();
    ctx.moveTo(pinX, 32);
    ctx.lineTo(pinX - 8, 44);
    ctx.lineTo(pinX + 8, 44);
    ctx.closePath();
    ctx.fillStyle = "#EA4335";
    ctx.fill();
    ctx.strokeStyle = "#B71C1C";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw white circle in the middle
    ctx.beginPath();
    ctx.arc(pinX, pinY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();

    // Draw text label (if enabled)
    if (showLabels) {
      const textX = 56;
      const textY = 20;

      ctx.font = "bold 14px sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "black";
      ctx.strokeText(name, textX, textY);
      ctx.fillStyle = "white";
      ctx.fillText(name, textX, textY);

      if (elevText) {
        ctx.font = "12px sans-serif";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "black";
        ctx.strokeText(elevText, textX, textY + 16);
        ctx.fillStyle = "white";
        ctx.fillText(elevText, textX, textY + 16);
      }
    }

    return canvas;
  }

  // ✅ Helper to create shadow canvas (separate from pin)
  function createShadowCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 20;
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.translate(20, 10);
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fill();
    ctx.restore();

    return canvas;
  }


  // ✅ NEW: clear stale positions immediately when URL changes (prevents "one track behind")
  useEffect(() => {
    trackCoordsRef.current = null;
    setTrackPositionsTick((t) => t + 1);

    // Also hide cursor immediately (no deletions)
    try {
      if (cursorEntityRef.current) cursorEntityRef.current.show = false;
    } catch (_) { }

    // Also clear mile markers immediately (no deletions)
    try {
      const viewer = viewerRef.current;
      if (viewer) {
        mileMarkerEntitiesRef.current.forEach((ent) =>
          viewer.entities.remove(ent),
        );
        mileMarkerEntitiesRef.current = [];
        viewer.scene.requestRender();
      }
    } catch (_) { }

    // Clear track core entity (we only use trackCoreEntityRef now)
    try {
      const viewer = viewerRef.current;
      if (viewer) {
        if (trackCoreEntityRef.current) {
          viewer.entities.remove(trackCoreEntityRef.current);
          trackCoreEntityRef.current = null;
        }
        viewer.scene.requestRender();
      }
    } catch (_) { }
  }, [geojsonUrl]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setErr(null);

        // Token (free tier is fine for 1–2 users)
        console.log(
          "Has ion token?",
          !!(ionToken || import.meta.env.VITE_CESIUM_ION_TOKEN),
        );

        // Token (free tier is fine for 1–2 users)
        const token = ionToken || import.meta.env.VITE_CESIUM_ION_TOKEN;
        if (token) {
          Cesium.Ion.defaultAccessToken = token;
        }

        if (!containerRef.current) return;

        // Create viewer once
        if (!viewerRef.current) {
          viewerRef.current = new Cesium.Viewer(containerRef.current, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            navigationHelpButton: false,
            sceneModePicker: true, // lets you switch 2D / 3D
            selectionIndicator: true,
            infoBox: false,
            fullscreenButton: false,
            // We'll provide imagery explicitly below
            imageryProvider: new Cesium.OpenStreetMapImageryProvider({
              url: "https://a.tile.openstreetmap.org/",
            }),

            baseLayer: false, // prevent Cesium from creating its own base layer
          });

          // ✅ Force OSM as the first imagery layer (tiles)
          try {
            const layers = viewerRef.current.imageryLayers;
            const osm = new Cesium.OpenStreetMapImageryProvider({
              url: "https://tile.openstreetmap.org/",
            });
            layers.addImageryProvider(osm, 0);
            layers.raiseToTop(layers.get(0));
            viewerRef.current.scene.requestRender();
          } catch (e) {
            console.warn("Failed to force-add OSM imagery layer:", e);
          }

          // ✅ NEW: ensure Cesium continuously renders while you interact (helps after resize)
          viewerRef.current.scene.requestRenderMode = true;
          viewerRef.current.scene.maximumRenderTimeChange = Infinity;

          // Nice defaults
          viewerRef.current.scene.globe.depthTestAgainstTerrain = true;
          viewerRef.current.scene.globe.enableLighting = false;

          // ✅ NEW: Force-add an OSM imagery layer (some Cesium versions ignore imageryProvider option)
          // We DO NOT remove your imageryProvider. This is an additive fallback.
          try {
            if (!osmLayerAddedRef.current && viewerRef.current.imageryLayers) {
              const osmProvider = new Cesium.OpenStreetMapImageryProvider({
                url: "https://tile.openstreetmap.org/",
              });
              viewerRef.current.imageryLayers.addImageryProvider(osmProvider);
              osmLayerAddedRef.current = true;
            }
          } catch (e) {
            console.warn("OSM imagery fallback add failed:", e);
          }

          // Terrain: Cesium World Terrain (requires ion token)
          // If you omit token, this may fail depending on Cesium settings.
          try {
            const terrain = await Cesium.createWorldTerrainAsync();
            if (!cancelled && viewerRef.current) {
              viewerRef.current.terrainProvider = terrain;

              // ✅ NEW: make sure the globe is actually showing terrain
              viewerRef.current.scene.globe.show = true;

              // ✅ NEW: kick a render after terrain attaches
              viewerRef.current.scene.requestRender();

              viewerRef.current.scene.globe.depthTestAgainstTerrain = true;
              viewerRef.current.scene.requestRender();
            }
          } catch (e) {
            // Terrain is optional — you can still render GeoJSON without it
            // Keep going, but note the issue.
            console.warn("Cesium terrain init failed:", e);
          }

          // ✅ NEW: If token exists but terrain is still flat, log a hint
          // (Doesn't change behavior; just helps debugging)
          try {
            if (
              token &&
              viewerRef.current &&
              viewerRef.current.terrainProvider
            ) {
              // no-op; just confirms terrain provider exists
            }
          } catch (_) { }
        }

        requestAnimationFrame(() => {
          if (viewerRef.current) {
            viewerRef.current.resize();
            viewerRef.current.scene.requestRender();
          }
        });

        setTimeout(() => {
          if (viewerRef.current) {
            viewerRef.current.resize();
            viewerRef.current.scene.requestRender();
          }
        }, 250);

        // ✅ NEW: one more delayed resize because your layout animates/collapses panels
        setTimeout(() => {
          if (viewerRef.current) {
            viewerRef.current.resize();
            viewerRef.current.scene.requestRender();
          }
        }, 750);

        // If no URL provided, just show globe
        if (!geojsonUrl) return;

        // ✅ NEW: clear positions before loading new datasource (prevents stale marker build)
        trackCoordsRef.current = null;
        setTrackPositionsTick((t) => t + 1);

        // Remove previous datasource
        if (dsRef.current && viewerRef.current) {
          try {
            viewerRef.current.dataSources.remove(dsRef.current, true);
          } catch (_) { }
          dsRef.current = null;
        }

        // Remove previous track entities (outline + core)
        if (trackCoreEntityRef.current && viewerRef.current) {
          try {
            viewerRef.current.entities.remove(trackCoreEntityRef.current);
          } catch (_) { }
          trackCoreEntityRef.current = null;
        }

        // Load GeoJSON
        const viewer = viewerRef.current;
        const dataSource = await Cesium.GeoJsonDataSource.load(geojsonUrl, {
          clampToGround: false, // We'll manually create polylines with proper styling
        });

        if (cancelled) return;

        dsRef.current = dataSource;

        // ✅ NEW: Extract positions but don't add the datasource (we'll render manually)
        const entities = dataSource.entities.values;
        let positions = null;

        for (const ent of entities) {
          if (ent.polyline) {
            const now = Cesium.JulianDate.now();
            positions = ent.polyline.positions.getValue(now);
            if (positions && positions.length) {
              break;
            }
          }
        }

        if (!positions || positions.length === 0) {
          console.warn("No valid polyline positions found in GeoJSON");
          return;
        }

        // ✅ Shadow layer (dark, semi-transparent, widest)
        //        trackOutlineEntityRef.current = viewer.entities.add({
        //          polyline: {
        //            positions: positions,
        //            width: 11, // Wider than the main track
        //            material: Cesium.Color.fromCssColorString("rgba(0, 0, 0, 0.3)"), // Semi-transparent black
        //            clampToGround: clampToGround,
        //            classificationType: clampToGround
        //              ? Cesium.ClassificationType.TERRAIN
        //              : undefined,
        //          },
        //        });

        // ✅ Main track with white outline + green core
        trackCoreEntityRef.current = viewer.entities.add({
          polyline: {
            positions: positions,
            width: 10, // Total width
            material: new Cesium.PolylineOutlineMaterialProperty({
              color: Cesium.Color.fromCssColorString("#5ab887"), // Green core
              outlineWidth: 3.5, // White outline thickness (adjust as needed)
              outlineColor: Cesium.Color.WHITE,
            }),
            clampToGround: clampToGround,
            classificationType: clampToGround
              ? Cesium.ClassificationType.TERRAIN
              : undefined,
          },
        });

        // ✅ Capture track positions for mile markers + cursor
        trackCoordsRef.current = positions;
        setTrackPositionsTick((t) => t + 1);

        // Zoom to track using bounding sphere
        try {
          const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
          await viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(
              0,
              Cesium.Math.toRadians(-30), // Look down at 30 degrees
              boundingSphere.radius * 2.5,
            ),
          });
        } catch (e) {
          console.warn("Failed to fly to track bounds:", e);
        }

        // ✅ NEW: render after zoom
        viewer.scene.requestRender();
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setErr(e?.message || String(e));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [geojsonUrl, ionToken, clampToGround]);

  // Destroy viewer on unmount (important!)
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (_) { }
        viewerRef.current = null;
        dsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      if (viewerRef.current) {
        viewerRef.current.resize();
        viewerRef.current.scene.requestRender();
      }
    });

    ro.observe(el);

    return () => {
      try {
        ro.disconnect();
      } catch (_) { }
    };
  }, []);

  // ✅ FIX: Restoration of visible numbers with Billboard + EyeOffset
  // ✅ FIX: Render text directly on canvas to avoid z-fighting
  useEffect(() => {
    const viewer = viewerRef.current;
    const positions = trackCoordsRef.current;
    if (!viewer || !positions) return;

    // Clear old markers
    try {
      mileMarkerEntitiesRef.current.forEach((ent) =>
        viewer.entities.remove(ent),
      );
    } catch (_) { }
    mileMarkerEntitiesRef.current = [];

    if (!showMileMarkers) {
      viewer.scene.requestRender();
      return;
    }

    // Helper to create the marker with text baked into the canvas
    const createMileMarkerCanvas = (mileNumber) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");

      // Draw circle background
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#5ab887"; // Green border
      ctx.stroke();

      // Draw text on top
      ctx.font = "bold 30px sans-serif";
      ctx.fillStyle = "#1e6f4c"; // Green text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(mileNumber), 32, 32);

      return canvas;
    };

    try {
      let total = 0;
      for (let i = 1; i < positions.length; i++) {
        total += metersBetween(positions[i - 1], positions[i]);
      }

      const metersPerMile = 1609.344;
      const mileCount = Math.floor(total / metersPerMile);

      for (let m = 1; m <= mileCount; m++) {
        const pos = interpolateAlong(positions, m * metersPerMile);

        const ent = viewer.entities.add({
          position: pos,
          billboard: {
            image: createMileMarkerCanvas(m), // Text baked into canvas
            width: 26,
            height: 26,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          // NO LABEL - text is part of the billboard now
        });

        mileMarkerEntitiesRef.current.push(ent);
      }

      viewer.scene.requestRender();
    } catch (e) {
      console.warn("Failed to build mile markers:", e);
    }
  }, [showMileMarkers, geojsonUrl, trackPositionsTick]);


  // ✅ Peak markers effect with radius filtering
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.terrainProvider) {
      console.log('Viewer not ready for peaks yet');
      return;
    }

    // Clear old peak markers
    try {
      peakEntitiesRef.current.forEach((ent) => viewer.entities.remove(ent));
    } catch (_) { }
    peakEntitiesRef.current = [];

    if (!peaks || peaks.length === 0 || !showPeaks) {
      viewer.scene.requestRender();
      return;
    }

    console.log('Adding peak markers:', peaks);

    const addPeaksWithTerrain = async () => {
      try {
        // Get viewer center position for radius filtering
        const cameraPos = viewer.camera.positionCartographic;
        const viewerLat = Cesium.Math.toDegrees(cameraPos.latitude);
        const viewerLon = Cesium.Math.toDegrees(cameraPos.longitude);

        // Helper to calculate distance in miles
        const haversineDistance = (lat1, lon1, lat2, lon2) => {
          const R = 3959; // Earth radius in miles
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        // Filter peaks by radius
        const filteredPeaks = peaks.filter(peak => {
          const dist = haversineDistance(viewerLat, viewerLon, peak.lat, peak.lon);
          return dist <= peakRadius;
        });

        console.log(`Filtered ${filteredPeaks.length} peaks within ${peakRadius} miles`);

        const positions = filteredPeaks.map(peak =>
          Cesium.Cartographic.fromDegrees(peak.lon, peak.lat)
        );

        try {
          await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
        } catch (terrainError) {
          console.warn('Terrain sampling failed:', terrainError);
        }

        filteredPeaks.forEach((peak, index) => {
          const { name, lat, lon, elevation } = peak;

          const terrainHeight = positions[index].height || 0;
          const position = Cesium.Cartesian3.fromRadians(
            positions[index].longitude,
            positions[index].latitude,
            terrainHeight
          );

          const elevText = elevation ? `${Math.round(elevation).toLocaleString()} ft` : '';

          // Add shadow (clamped to ground)
          const shadowEnt = viewer.entities.add({
            position: position,
            billboard: {
              image: createShadowCanvas(),
              width: 40,
              height: 20,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });

          // Add pin marker (above ground)
          const ent = viewer.entities.add({
            position: position,
            billboard: {
              image: createPeakMarkerCanvas(name, elevText, showPeakLabels),
              width: showPeakLabels ? 200 : 48,
              height: 64,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              pixelOffset: new Cesium.Cartesian2(-24, 0),
            },
          });

          peakEntitiesRef.current.push(shadowEnt, ent);
        });

        viewer.scene.requestRender();
        console.log('Peak markers rendered:', peakEntitiesRef.current.length);
      } catch (e) {
        console.error("Failed to build peak markers:", e);
      }
    };

    setTimeout(addPeaksWithTerrain, 1000);
  }, [peaks, showPeaks, showPeakLabels, peakRadius]);

  // ✅ NEW: cursor entity driven by cursorIndex (hook up to your graph hover)
  useEffect(() => {
    const viewer = viewerRef.current;
    const positions = trackCoordsRef.current;
    if (!viewer || !positions) return;

    try {
      if (!cursorEntityRef.current) {
        cursorEntityRef.current = viewer.entities.add({
          position: positions[0],
          point: {
            pixelSize: 9,
            color: Cesium.Color.fromCssColorString("#5ab887"), // Match 2D cursor color
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: "",
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(12, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }

      if (cursorIndex === null || cursorIndex === undefined) {
        cursorEntityRef.current.show = false;
        viewer.scene.requestRender();
        return;
      }

      const idx = Math.max(0, Math.min(positions.length - 1, cursorIndex));
      cursorEntityRef.current.position = positions[idx];
      cursorEntityRef.current.show = true;

      // Elevation readout (may be 0 if your GeoJSON doesn't include altitude)
      try {
        const c = Cesium.Cartographic.fromCartesian(positions[idx]);
        const elevFt = (c.height || 0) * 3.28084;
        cursorEntityRef.current.label.text = `${Math.round(
          idx,
        )} • ${Math.round(elevFt)} ft`;
      } catch (_) { }

      viewer.scene.requestRender();
    } catch (e) {
      console.warn("Failed to update cursor entity:", e);
    }
  }, [cursorIndex, geojsonUrl, trackPositionsTick]);

  return (
    <div style={{ position: "relative", ...style }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {err ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            right: 12,
            padding: "10px 12px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.3,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Cesium error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
        </div>
      ) : null}
    </div>
  );
}
