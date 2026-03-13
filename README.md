# Trail Explorer 🏔️

A beautiful, interactive web application for visualizing and exploring hiking trails from GeoJSON files. Built with React, Vite, Tailwind CSS, and Leaflet.

![Build](https://img.shields.io/github/actions/workflow/status/spaceshiptrip/trail-viewer/deploy.yml?label=build)
![Tests](https://img.shields.io/github/actions/workflow/status/spaceshiptrip/trail-viewer/deploy.yml?label=tests)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-22.x-green)
![Vite](https://img.shields.io/badge/vite-5.x-purple)
![React](https://img.shields.io/badge/react-18-blue)



(Original README content continues below — unchanged)



---

# 🚦 Automated GPX Validation Pipeline (New)

A new safety layer was added so bad GPX files cannot silently produce broken GeoJSON.

New scripts:

```
scripts/validate-gpx.cjs
scripts/add-track.cjs
```

## Recommended Way to Add a Trail

Instead of manually converting GPX → GeoJSON:

```
npm run add-track -- path/to/file.gpx
```

This automatically:

1. Validates GPX structure
2. Warns about missing elevation data
3. Copies GPX to `public/tracks/gpx`
4. Converts GPX → GeoJSON
5. Regenerates `manifest.json`

---

# 🔁 Updated Full Data Pipeline

```
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
React Trail Explorer UI
   ↓
Vite build
   ↓
GitHub Pages deploy
```

---

# 🧪 Updated Developer Workflow

Typical developer flow now:

1. Export GPX from watch / mapping tool
2. Validate GPX

```
npm run validate-gpx -- mytrail.gpx
```

3. Add track automatically

```
npm run add-track -- mytrail.gpx
```

4. Run locally

```
npm run dev
```

5. Verify elevation + UI
6. Commit
7. Push → GitHub Actions builds & deploys

This preserves the existing manual workflow while adding a **safer automated ingestion path**.
