# Trail Explorer 🏔️

A beautiful, interactive web application for visualizing and exploring hiking trails from GeoJSON files. Built with React, Vite, Tailwind CSS, and Leaflet.

## Features

* 🗺️ **Interactive Map**: View all your trails on an OpenStreetMap-based interface with multiple base layer options
* 📊 **Elevation Profiles**: Detailed elevation graphs with zoom, pan, and grade overlay
* 🔍 **Search & Filter**: Quickly find trails by name, location, or description
* 📈 **Trail Stats**: Automatic calculation of distance, elevation gain, and energy metrics
* 🌤️ **Weather Integration**: Real-time weather conditions and 5-day forecast for each trail
* 🌬️ **Air Quality**: Current AQI data and 24-hour forecast
* 📍 **GPS Location Sharing**: Real-time location tracking with follow mode (iOS/Android compatible)
* 🎯 **Grade Analysis**: Color-coded grade overlay with detailed metrics breakdown
* 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile
* 🎨 **Beautiful UI**: Custom dark/light theme with smooth animations
* 🗂️ **Smart Caching**: LRU cache for fast track loading (max 4 tracks)
* ⬇️ **GPX Downloads**: Download original GPX files with custom modal UI
* ⬇️ **Tile Downloads**: Download 2D tiles for offline use
* 🏗️ **Build Info**: Display build timestamp to verify deployed version

## Quick Start

### 1. Node.js Environment (Recommended)

This project uses [Volta](https://volta.sh/) to manage Node.js versions. To ensure consistency, it is recommended to install Volta and pin the project to the specified version.

```bash
# Install Volta (macOS/Linux)
curl https://get.volta.sh | bash

# Pin the version (already configured in package.json)
volta pin node@22.x
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Your Trail Data

#### Option A: Using Manifest (Recommended)

Create `public/tracks/manifest.json`:

```json
{
  "tracks": [
    {
      "file": "sample-trail.geojson",
      "name": "Sample Trail",
      "location": "California, USA",
      "description": "A beautiful hiking trail",
      "distance": 5.2,
      "elevationGain": 1200
    }
  ]
}
```

Add your GeoJSON files to `public/tracks/` and corresponding GPX files to `public/tracks/gpx/`.

#### Option B: Legacy Method

Place your GeoJSON trail files in `public/tracks/` and edit `src/App.jsx`:

```javascript
const trackFiles = [
  'sample-trail.geojson',
  'your-trail-1.geojson',
  'your-trail-2.geojson',
];
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see your trail viewer!

### 5. Test on Mobile (Same Network)

```bash
# Expose dev server on your local network
npm run dev -- --host

# You'll see output like:
# ➜  Local:   http://localhost:5173/
# ➜  Network: http://192.168.1.XXX:5173/
```

Open the Network URL on your phone (must be on same WiFi).

**Note:** GPS features require HTTPS. For local HTTPS testing, use [ngrok](https://ngrok.com):

```bash
# In one terminal:
npm run dev

# In another terminal:
ngrok http 5173

# Use the https:// URL on your phone
```

## GeoJSON Format

Your GeoJSON files should follow this structure:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Trail Name",
    "description": "Trail description",
    "location": "State, Country"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [longitude, latitude, elevation_in_meters],
      [longitude, latitude, elevation_in_meters]
    ]
  }
}
```

**Important Notes:**

* Coordinates are in `[longitude, latitude, elevation]` format
* Elevation is optional but enables elevation profile charts
* Both `LineString` and `MultiLineString` geometries are supported
* `FeatureCollection` format is also supported

## GPS Location Features

### Setup

GPS location sharing works automatically on HTTPS (localhost or deployed).

**Features:**
- 📍 Real-time GPS tracking with accuracy indicator
- 🎯 Follow mode (auto-center map on your position)
- 🔵 Blue pulsing dot with accuracy ring
- 📱 iOS Safari and Android Chrome compatible
- 🔋 High accuracy mode enabled

**Browser Requirements:**
- ✅ HTTPS required (or localhost)
- ✅ User permission required (browser prompts automatically)
- ✅ Location services enabled on device

**Troubleshooting:**
- If GPS button not visible on iOS Safari, the positioning is optimized for Safari's dynamic toolbar
- Brave/Chrome browsers use standard positioning
- Works best outdoors (5-20m accuracy typical)

## Build Info Display

The app displays a build timestamp in the TrackList header to help verify deployed versions:

```
Trail Explorer                    [Theme Toggle]
11 tracks loaded    Build: 20260220.005704
```

### Setup Build Info

1. Copy `generate-build-info.js` to project root
2. Create `src/build-info.js` (will be auto-generated)
3. Add to `package.json`:

```json
{
  "scripts": {
    "prebuild": "node generate-build-info.js"
  }
}
```

The build timestamp auto-updates on each `npm run build`.

## Deploying to GitHub Pages

### 1. Update vite.config.js

Set the `base` to your repository name:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',
})
```

### 2. Build for Production

```bash
npm run build
```

This will:
1. Run `prebuild` script (generates build timestamp)
2. Build optimized production files to `dist/`

### 3. Deploy Options

**Option A: Using gh-pages package**

```bash
npm install -D gh-pages

# Add to package.json scripts:
"deploy": "gh-pages -d dist"

# Deploy:
npm run deploy
```

**Option B: GitHub Actions (Recommended)**

Already configured! Just push to `main`:

```bash
git push origin main
```

The `.github/workflows/deploy.yml` file automatically:
1. Builds the app
2. Deploys to GitHub Pages
3. Updates live site in ~2 minutes

**Check deployment status:**
```bash
gh run list --limit 3
gh run watch  # Watch live deployment
```

### 4. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Source should be "GitHub Actions" (if using workflow)
3. Your site will be at `https://username.github.io/repo-name/`

## Converting GPS Data to GeoJSON

If you have GPX files from your GPS device, convert them to GeoJSON:

### Using Online Tools

* [geojson.io](https://geojson.io) - Upload GPX and download as GeoJSON
* [MyGeodata Converter](https://mygeodata.cloud/converter/)

### Using Command Line (gpsbabel)

```bash
# Install gpsbabel
# On macOS: brew install gpsbabel
# On Ubuntu: sudo apt-get install gpsbabel

# Convert GPX to GeoJSON
gpsbabel -i gpx -f input.gpx -o geojson -F output.geojson
```

### Using Python

```python
import gpxpy
import json

with open('track.gpx', 'r') as gpx_file:
    gpx = gpxpy.parse(gpx_file)
    
    coordinates = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                coordinates.append([
                    point.longitude,
                    point.latitude,
                    point.elevation
                ])
    
    geojson = {
        "type": "Feature",
        "properties": {
            "name": gpx.tracks[0].name,
            "description": gpx.tracks[0].description
        },
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates
        }
    }
    
    with open('track.geojson', 'w') as f:
        json.dump(geojson, f, indent=2)
```

## Advanced Features

### Elevation Profile

**Controls:**
- **Zoom:** `+` / `-` keys or zoom buttons
- **Pan:** Arrow keys (when zoomed) or pan buttons
- **Reset:** `0` or `Esc` key
- **Expand:** Full-width graph view (desktop only)
- **Grade Overlay:** Color-coded grade visualization with metrics

**Grade Metrics:**
- Breaks down trail into grade ranges (>25%, 20-25%, 15-20%, etc.)
- Shows distance and percentage for each grade category
- Sortable by distance or grade range

### Energy Metrics

Based on research from ["From Treadmill to Trails" (Crowell, 2021)](https://www.biorxiv.org/content/10.1101/2021.04.03.438339v3.full):

- **Equivalent Flat Distance:** Energy-adjusted distance accounting for elevation
- **Climb Factor:** Percentage increase in effort due to elevation gain

### Smart Caching

The app caches up to 4 tracks in browser memory using LRU (Least Recently Used) eviction:
- Fast switching between recently viewed tracks
- Reduces network requests
- Automatic cleanup when cache is full

## Customization

### Colors & Theme

Edit `src/index.css` to customize the color scheme:

```css
:root {
  --bg-primary: #0a0f0d;        /* Main background */
  --bg-secondary: #141b17;      /* Card backgrounds */
  --accent-primary: #5ab887;    /* Primary accent color */
  --text-primary: #f0f9f4;      /* Main text */
}

[data-theme="light"] {
  --bg-primary: #f0f9f4;
  --bg-secondary: #ffffff;
  --accent-primary: #2d8659;
  --text-primary: #0a0f0d;
}
```

### Map Tiles

The app supports multiple base layers:
- **OSM Standard** (default)
- **CyclOSM** (cycling-focused)
- **Thunderforest Cycle Map** (requires API key)
- **Tracestrack Topo** (requires API key)

Add API keys to `.env`:
```bash
VITE_THUNDERFOREST_API_KEY=your_key_here
VITE_TRACESTRACK_API_KEY=your_key_here
```

Change default tiles in `src/components/Map.jsx`:

```javascript
// Dark theme example
<TileLayer
  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
/>

// Terrain example
<TileLayer
  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
/>
```

### Fonts

Update `tailwind.config.js` to use different Google Fonts:

```javascript
fontFamily: {
  display: ['"Your Display Font"', 'sans-serif'],
  body: ['"Your Body Font"', 'sans-serif'],
}
```

## Tech Stack

### Core
* **React 18** - UI framework
* **Vite** - Build tool and dev server
* **Tailwind CSS** - Styling

### Mapping
* **Leaflet** - Interactive maps
* **react-leaflet** - React bindings for Leaflet

### Visualization
* **Recharts** - Elevation profile charts with zoom/pan
* **Lucide React** - Icon library

### APIs
* **Geolocation API** - GPS location tracking
* **Open-Meteo API** - Weather data (free, no API key required)
* **OpenAQ API** - Air quality data

### Build Tools
* **gh-pages** - Deployment (optional)
* **GitHub Actions** - CI/CD

## Project Structure

```
trail-viewer/
├── public/
│   ├── tracks/          # GeoJSON trail files
│   │   ├── gpx/         # Original GPX files (for download)
│   │   └── manifest.json
│   └── peaks/           # Peak data for 3D view (optional)
├── src/
│   ├── components/
│   │   ├── Map.jsx
│   │   ├── Sidebar.jsx
│   │   ├── TrackList.jsx
│   │   ├── GpsButton.jsx
│   │   └── UserLocationLayer.jsx
│   ├── hooks/
│   │   └── useGeolocation.js
│   ├── App.jsx
│   ├── utils.js
│   └── build-info.js    # Auto-generated
├── generate-build-info.js
└── package.json
```

## Browser Support

* Chrome/Edge (latest)
* Firefox (latest)
* Safari (latest)
* Mobile browsers (iOS Safari, Chrome Mobile)

**GPS Features:**
* ✅ iOS Safari 11+
* ✅ Chrome Mobile
* ✅ Firefox Mobile
* ✅ Any HTTPS-enabled browser with Geolocation API

## Performance

- Lazy loading of track data (manifest mode)
- LRU cache for frequently accessed tracks
- Optimized re-rendering with React keys
- CSS transitions instead of JS animations
- Debounced search input

## Troubleshooting

### GPS Button Not Visible (iOS Safari)

The app uses browser-specific positioning to handle Safari's dynamic toolbar:
- Safari iOS: 120px from bottom
- Chrome/Brave iOS: 80px from bottom
- Desktop: 24px from bottom

If still having issues, check:
1. Is site served over HTTPS? (required for GPS)
2. Did you allow location permissions?
3. Are location services enabled on device?

### Build Timestamp Not Updating

Make sure `prebuild` script is in `package.json`:
```json
"scripts": {
  "prebuild": "node generate-build-info.js",
  "build": "vite build"
}
```

The `prebuild` runs automatically before `build`.

### Tracks Not Loading

1. Check browser console for errors
2. Verify GeoJSON files are in `public/tracks/`
3. Check `manifest.json` format matches example
4. Ensure `base` in `vite.config.js` matches your deployment URL

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check build status (if using GitHub Actions)
gh run list
gh run watch
```


## Offline Maps

Trail Explorer supports offline map functionality, allowing users to download map tiles for specific trail areas and use them without an internet connection.

### Features

- **Automatic Caching**: Map tiles are automatically cached as you browse trails
- **Manual Download**: Download entire trail areas for guaranteed offline access
- **Cache Management**: View cache size and clear offline maps when needed
- **Storage Tracking**: Visual indicators show which trails are available offline
- **GPS Works Offline**: GPS location tracking continues to function without internet

### Usage

1. **View a trail** - Map tiles automatically cache as you browse
2. **Download for offline** - Click "Download for Offline" in the sidebar to preload an entire trail area
3. **Go offline** - Enable airplane mode or lose cell signal
4. **Navigate** - GPS location tracking continues, cached tiles display normally

### Storage Requirements

- **Single trail area**: 50-200 MB (zoom levels 10-15)
- **Desktop browsers**: 2-6 GB available
- **Android**: 500 MB - 6 GB available
- **iOS Safari**: 50-100 MB available (very limited)

**Recommendation**: iOS users should download 1-2 trails maximum due to storage constraints.

### Configuration

#### Adjust Zoom Levels

The default configuration downloads tiles for zoom levels 10-15, providing good detail while keeping download sizes reasonable. You can modify this in `src/components/OfflineMapDownloader.jsx`:

```javascript
// Line ~65
const zoomLevels = [10, 11, 12, 13, 14, 15];
```

**Options**:
- **Fewer levels** (e.g., `[12, 13, 14]`): Smaller download (20-80 MB), less detail when zoomed in/out
- **More levels** (e.g., `[8, 9, 10, 11, 12, 13, 14, 15, 16]`): Larger download (200-500 MB), more detail at all zoom levels
- **High detail only** (e.g., `[14, 15, 16]`): Small download (30-100 MB), only detailed view, no overview

**Zoom level reference**:
- **Level 10**: Regional view (shows 50+ mile area)
- **Level 12**: Area view (shows 10-20 mile area)
- **Level 14**: Trail view (shows 2-5 mile area)
- **Level 16**: Detail view (shows 0.5-1 mile area, ~2 feet per pixel)

#### Adjust Download Batch Size

If downloads fail or timeout, reduce the batch size in `src/components/OfflineMapDownloader.jsx`:

```javascript
// Line ~80
const batchSize = 6;  // Reduce to 3 or 4 if experiencing failures
```

#### Adjust Download Delay

To comply with tile provider rate limits or reduce server load, increase the delay between batches:

```javascript
// Line ~95
await new Promise(resolve => setTimeout(resolve, 500));  // Change to 1000 for slower downloads
```

### Technical Details

**Architecture**:
- Service Worker (`public/sw.js`) intercepts tile requests
- Cache-first strategy for instant tile loading
- Falls back to network if tile not cached
- Automatic cache on successful network fetch

**Cache Strategy**:
1. Request for map tile
2. Check browser cache
3. If found: serve from cache (instant)
4. If not found: fetch from network, cache response, serve to user

**Offline Behavior**:
- Cached tiles: Display normally
- Uncached tiles: Show blank/placeholder
- GPS: Continues to work (hardware-based, no internet required)
- Weather/AQI: Not available offline

### Supported Tile Providers

The following map tile providers are cached for offline use:
- OpenStreetMap (default)
- CyclOSM
- Thunderforest (if API key configured)
- Tracestrack (if API key configured)

To add additional tile providers, edit `public/sw.js`:

```javascript
// Line ~8
const TILE_PATTERNS = [
  /tile\.openstreetmap\.org/,
  /tile-cyclosm\.openstreetmap\.fr/,
  /your-tile-provider\.com/,  // Add new providers here
];
```

### Clear Cache

Users can clear all cached tiles via the "Clear All Offline Maps" button in the Offline Maps section of the sidebar. This will:
1. Delete all cached map tiles
2. Clear download status markers
3. Reload the application
4. Reinstall the service worker

Developers can also clear cache programmatically:

```javascript
const clearOfflineCache = async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  window.location.reload();
};
```

### Browser Compatibility

**Service Worker Requirements**:
- HTTPS connection (or localhost for development)
- Modern browser with Service Worker support
- Sufficient storage quota

**Supported Browsers**:
- Chrome/Edge 40+
- Firefox 44+
- Safari 11.1+
- Chrome Mobile
- Safari iOS 11.3+

### Limitations

**Does NOT work offline**:
- 3D Cesium terrain view (tiles are 10-100x larger than 2D)
- Weather data (requires API connection)
- Air quality data (requires API connection)
- Loading new tracks (unless already cached)
- Areas not previously downloaded

**3D Terrain Note**: 3D tiles are too large for practical offline use. A single trail area in 3D can require 5-30 GB of storage, which exceeds browser storage limits and is impractical for mobile devices. The app automatically disables 3D mode when offline.

### Development

**Local Testing**:
```bash
npm run dev
# Service Worker works on localhost automatically
# Open DevTools > Application > Service Workers to verify registration
```

**Production Deployment**:
```bash
npm run build
# Service Worker will activate on HTTPS domain
# GitHub Pages provides HTTPS by default
```

**Debug Service Worker**:
1. Open DevTools > Application > Service Workers
2. Check "Update on reload" during development
3. Monitor cache in Application > Cache Storage
4. View network requests in Network tab (filter by "ServiceWorker")



## License

MIT License - feel free to use this for your own projects!

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Acknowledgments

* Map data from [OpenStreetMap](https://www.openstreetmap.org)
* Weather data from [Open-Meteo](https://open-meteo.com)
* Air quality data from [OpenAQ](https://openaq.org)
* Energy metrics research from [Crowell (2021)](https://www.biorxiv.org/content/10.1101/2021.04.03.438339v3.full)
* Icons from [Lucide](https://lucide.dev)

---

# 🧭 Operator Workflow (Authoritative Runbook — Added Section)

This section documents the exact operational steps for adding peaks and trails.
It does NOT replace any existing documentation — it simply makes the workflow explicit.

## ⛰ Add a Peak (Interactive)

Run:

    node scripts/addPeak.cjs

You will be prompted for:

- Name
- Latitude
- Longitude
- Elevation (feet or meters — auto‑converted to feet)
- Description

Updates:

    public/peaks/peaks.json

---

## 🥾 Add Trail from GPX

1. Copy GPX file:

    public/tracks/gpx/my-trail.gpx

2. Convert:

    node scripts/gpx-to-geojson.cjs public/tracks/gpx/my-trail.gpx public/tracks/

Generates:

    public/tracks/my-trail.geojson

3. Regenerate manifest:

    node scripts/generate-manifest.cjs

4. Run app:

    npm run dev

---

## 🔁 Full Pipeline

    GPX → GeoJSON → Manifest → UI

Commands:

    node scripts/gpx-to-geojson.cjs
    node scripts/generate-manifest.cjs
    npm run dev

---

# 🧪 JT Developer Workflow (Added Section)

Typical flow when adding new data:

1. Record GPX from watch or export from mapping tool
2. Drop into gpx folder
3. Convert to GeoJSON
4. Regenerate manifest
5. Run locally
6. Verify stats + elevation graph
7. Commit
8. Push + deploy

This mirrors real usage patterns for trail exploration and validation.

---

# 📊 Data Pipeline Diagram (Added Section)

    GPX file
       ↓
    gpx-to-geojson.cjs
       ↓
    GeoJSON
       ↓
    generate-manifest.cjs
       ↓
    manifest.json
       ↓
    Trail Explorer UI

---

# 🛠 Automation Ideas (Optional Enhancements — Added Section)

Future improvements if desired:

- make add-track
- npm run add:track
- npm run add:peak
- precommit manifest generation
- CI validation of GeoJSON schema
- Track linting script

None are required — current workflow remains valid.

---

# 🌍 Open Source Friendly Notes (Added Section)

This project is designed so contributors can:

- Add trails without touching code
- Add peaks via script
- Regenerate manifest safely
- Verify locally before PR

The goal is reproducible data ingestion with minimal friction.

---
