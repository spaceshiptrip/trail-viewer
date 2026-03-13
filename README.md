
# Trail Explorer 🏔️

![Build](https://img.shields.io/github/actions/workflow/status/spaceshiptrip/trail-viewer/deploy.yml?label=build)
![Tests](https://img.shields.io/github/actions/workflow/status/spaceshiptrip/trail-viewer/deploy.yml?label=tests)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-22.x-green)
![Vite](https://img.shields.io/badge/vite-5.x-purple)
![React](https://img.shields.io/badge/react-18-blue)

A beautiful, interactive web application for visualizing and exploring hiking trails from GeoJSON files. Built with React, Vite, Tailwind CSS, and Leaflet.

---

# 🚦 Automated GPX Ingestion Pipeline

This project includes a **validated ingestion pipeline** to prevent bad GPX data from entering the system.

## New Scripts

scripts/validate-gpx.cjs  
scripts/add-track.cjs

### Validate GPX

Checks:

- XML validity
- `<gpx>` root
- `<trkpt>` / `<rtept>` presence
- lat/lon attributes
- elevation values

Run:

npm run validate-gpx -- path/to/file.gpx

Example output:

Validating: my-track.gpx  
WARNING: No elevation data found  
Track points: 3322  
Points with elevation: 0  
✔ GPX validation passed

---

# 🥾 Add Track Automatically

Instead of manually converting GPX → GeoJSON:

npm run add-track -- path/to/file.gpx

This automatically:

1. Validates GPX
2. Copies to public/tracks/gpx
3. Converts GPX → GeoJSON
4. Regenerates manifest.json

---

# 🔁 Full Data Pipeline

GPX file
   ↓
validate-gpx.cjs
   ↓
add-track.cjs
   ↓
gpx-to-geojson.cjs
   ↓
generate-manifest.cjs
   ↓
manifest.json
   ↓
Trail Explorer UI
   ↓
Vite build
   ↓
GitHub Pages deployment

---

# 🧪 Developer Workflow

1. Export GPX from watch or mapping tool
2. Validate GPX

npm run validate-gpx -- mytrack.gpx

3. Add track

npm run add-track -- mytrack.gpx

4. Run locally

npm run dev

5. Verify elevation + map
6. Commit and push
7. GitHub Actions builds and deploys

---

# 🧭 Summary

This pipeline ensures:

- Invalid GPX files are caught early
- GeoJSON generation is reproducible
- Manifest updates are automatic
- Builds remain deterministic

The result is a **reliable, testable trail ingestion pipeline** for Trail Explorer.
