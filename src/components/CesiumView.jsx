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
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const dsRef = useRef(null);
  const [err, setErr] = useState(null);

  // ✅ NEW: keep track of whether we already injected OSM imagery fallback
  const osmLayerAddedRef = useRef(false);

  // ✅ NEW: refs for track positions + entities (mile markers + cursor)
  const trackCoordsRef = useRef(null); // Cartesian3[]
  const mileMarkerEntitiesRef = useRef([]); // Entity[]
  const cursorEntityRef = useRef(null); // Entity

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

  // ✅ NEW: clear stale positions immediately when URL changes (prevents "one track behind")
  useEffect(() => {
    trackCoordsRef.current = null;
    setTrackPositionsTick((t) => t + 1);

    // Also hide cursor immediately (no deletions)
    try {
      if (cursorEntityRef.current) cursorEntityRef.current.show = false;
    } catch (_) {}

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
    } catch (_) {}
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
          } catch (_) {}
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
          } catch (_) {}
          dsRef.current = null;
        }

        // Load GeoJSON
        const viewer = viewerRef.current;
        const dataSource = await Cesium.GeoJsonDataSource.load(geojsonUrl, {
          clampToGround, // drape polygons/lines when possible
        });

        if (cancelled) return;

        dsRef.current = dataSource;
        viewer.dataSources.add(dataSource);

        // Style polylines a bit (GeoJSON LineString / MultiLineString)
        // This keeps it simple: one consistent style.
        const entities = dataSource.entities.values;
        for (const ent of entities) {
          if (ent.polyline) {
            ent.polyline.width = 4;
            ent.polyline.material = Cesium.Color.fromCssColorString("#22c55e"); // green
            // If clampToGround is true, Cesium uses ground clamping where supported
            // If you want absolute altitudes from your GeoJSON coords, set clampToGround=false.
          }
        }

        // ✅ NEW: capture track polyline positions so we can place mile markers + cursor
        // ALSO: bump tick so mile marker effect runs AFTER positions are ready
        try {
          const now = Cesium.JulianDate.now();
          const firstWithPolyline = dataSource.entities.values.find(
            (e) => e.polyline && e.polyline.positions,
          );
          if (firstWithPolyline) {
            const positions = firstWithPolyline.polyline.positions.getValue(now);
            if (positions && positions.length) {
              trackCoordsRef.current = positions;
              setTrackPositionsTick((t) => t + 1);
            }
          }
        } catch (e) {
          console.warn("Failed to capture track positions:", e);
        }

        // Zoom to track
        await viewer.zoomTo(dataSource);

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
        } catch (_) {}
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
      } catch (_) {}
    };
  }, []);

  // ✅ NEW: build/clear mile marker entities whenever track or toggle changes
  useEffect(() => {
    const viewer = viewerRef.current;
    const positions = trackCoordsRef.current;
    if (!viewer || !positions) return;

    // Clear old markers
    try {
      mileMarkerEntitiesRef.current.forEach((ent) => viewer.entities.remove(ent));
    } catch (_) {}
    mileMarkerEntitiesRef.current = [];

    if (!showMileMarkers) {
      viewer.scene.requestRender();
      return;
    }

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
          label: {
            text: String(m),
            font: "14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          point: {
            pixelSize: 6,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        mileMarkerEntitiesRef.current.push(ent);
      }

      viewer.scene.requestRender();
    } catch (e) {
      console.warn("Failed to build mile markers:", e);
    }
  }, [showMileMarkers, geojsonUrl, trackPositionsTick]);

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
            pixelSize: 10,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
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
      } catch (_) {}

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
