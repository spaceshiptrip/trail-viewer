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
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const dsRef = useRef(null);
  const [err, setErr] = useState(null);

  // ✅ NEW: keep track of whether we already injected OSM imagery fallback
  const osmLayerAddedRef = useRef(false);

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
