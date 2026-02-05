# Trail Explorer 🏔️

A beautiful, interactive web application for visualizing and exploring hiking trails from GeoJSON files. Built with React, Vite, Tailwind CSS, and Leaflet.

## Features

* 🗺️ **Interactive Map**: View all your trails on an OpenStreetMap-based interface
* 📊 **Elevation Profiles**: Detailed elevation graphs for each track
* 🔍 **Search & Filter**: Quickly find trails by name, location, or description
* 📈 **Trail Stats**: Automatic calculation of distance and elevation gain
* 🌤️ **Weather Integration**: Real-time weather conditions and 5-day forecast for each trail
* 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile
* 🎨 **Beautiful UI**: Custom dark theme with smooth animations

## Quick Start

### 1. Node.js Environment (Recommended)

This project uses [Volta](https://www.google.com/search?q=https://volta.sh/) to manage Node.js versions. To ensure consistency, it is recommended to install Volta and pin the project to the specified version.

```bash
# Install Volta (macOS/Linux)
curl https://get.volta.sh | bash

# Pin the version (already configured in package.json)
volta pin node@22.22.0

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Add Your GeoJSON Files

Place your GeoJSON trail files in the `public/tracks/` directory. See the example file for the correct format.

### 4. Update Track List

Edit `src/App.jsx` and add your filenames to the `trackFiles` array:

```javascript
const trackFiles = [
  'sample-trail.geojson',
  'your-trail-1.geojson',
  'your-trail-2.geojson',
];

```

### 5. Run Development Server

```bash
npm run dev

```

Visit `http://localhost:5173` to see your trail viewer!

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

### 3. Deploy Options

**Option A: Using gh-pages package**

```bash
npm install -D gh-pages

# Add to package.json scripts:
"deploy": "npm run build && gh-pages -d dist"

# Deploy:
npm run deploy

```

**Option B: Manual deployment**

1. Push your `dist` folder to a `gh-pages` branch
2. Enable GitHub Pages in your repository settings
3. Select the `gh-pages` branch as the source

**Option C: GitHub Actions**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment

```

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

```

### Map Style

Change the map tiles in `src/components/Map.jsx`:

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

* **React 18** - UI framework
* **Vite** - Build tool and dev server
* **Tailwind CSS** - Styling
* **Leaflet** - Interactive maps
* **react-leaflet** - React bindings for Leaflet
* **Recharts** - Elevation profile charts
* **Lucide React** - Icon library
* **Open-Meteo API** - Weather data (free, no API key required)

## Browser Support

* Chrome/Edge (latest)
* Firefox (latest)
* Safari (latest)
* Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - feel free to use this for your own projects!

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Acknowledgments

* Map data from [OpenStreetMap](https://www.openstreetmap.org)
* Weather data from [Open-Meteo](https://open-meteo.com)
* Icons from [Lucide](https://lucide.dev)
