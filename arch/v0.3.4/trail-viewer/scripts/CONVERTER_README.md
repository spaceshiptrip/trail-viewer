# GPX to GeoJSON Converters

Two scripts to convert GPX files to GeoJSON format for your Trail Explorer app.

## Python Version (Recommended - Easier to Install)

### Installation
```bash
pip install gpxpy
```

### Usage

**Convert a single file:**
```bash
python gpx_to_geojson.py track.gpx track.geojson
```

**Convert all GPX files in a directory:**
```bash
python gpx_to_geojson.py ./my-gpx-files ./trail-viewer/public/tracks
```

**Add location metadata to existing GeoJSON:**
```bash
python gpx_to_geojson.py --add-location track.geojson "Rocky Mountain National Park, CO"
```

### Features
- Preserves elevation data
- Extracts track name and description
- Handles multiple tracks/segments
- Batch converts entire directories
- Can add location metadata after conversion

---

## Node.js Version

### Installation
```bash
npm install @tmcw/togeojson xmldom
# Or use the provided package.json:
# npm install
```

### Usage

**Convert a single file:**
```bash
node gpx-to-geojson.js track.gpx track.geojson
```

**Convert all GPX files in a directory:**
```bash
node gpx-to-geojson.js ./my-gpx-files ./trail-viewer/public/tracks
```

### Features
- Same functionality as Python version
- Uses industry-standard togeojson library
- Great for JavaScript-based workflows

---

## Output Format

Both scripts produce GeoJSON files in the correct format for Trail Explorer:

```json
{
  "type": "Feature",
  "properties": {
    "name": "My Awesome Trail",
    "description": "A beautiful hike through the mountains",
    "location": "Optional - add manually or use Python script"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-105.5894, 40.3428, 2750],
      [-105.5892, 40.3435, 2755]
    ]
  }
}
```

Coordinates are in `[longitude, latitude, elevation_in_meters]` format.

---

## Quick Workflow

1. **Export GPX from your GPS device or app** (Strava, Garmin, AllTrails, etc.)

2. **Convert to GeoJSON:**
   ```bash
   # Put all your GPX files in one folder
   mkdir my-tracks
   # Copy your GPX files there
   
   # Convert them all at once
   python gpx_to_geojson.py my-tracks trail-viewer/public/tracks
   ```

3. **Add to Trail Explorer:**
   ```javascript
   // In trail-viewer/src/App.jsx
   const trackFiles = [
     'track1.geojson',
     'track2.geojson',
     'track3.geojson',
   ];
   ```

4. **Run your app:**
   ```bash
   cd trail-viewer
   npm run dev
   ```

---

## Troubleshooting

**Python: "No module named 'gpxpy'"**
```bash
pip install gpxpy
# or
pip3 install gpxpy
```

**Node.js: "Cannot find module '@tmcw/togeojson'"**
```bash
npm install @tmcw/togeojson xmldom
```

**"No coordinates found in GPX file"**
- Make sure your GPX file has track points (not just waypoints)
- Open the GPX in a text editor to verify it has `<trkpt>` elements

**Elevation data is missing**
- Some GPS exports don't include elevation
- The converter will still work, just without the elevation profile chart
- You can manually add elevation using tools like GPS Visualizer

---

## Advanced: Batch Processing with Metadata

If you want to add custom metadata to all your tracks:

**Python:**
```python
import json
from pathlib import Path

tracks_dir = Path('trail-viewer/public/tracks')
for geojson_file in tracks_dir.glob('*.geojson'):
    with open(geojson_file, 'r') as f:
        data = json.load(f)
    
    # Add custom properties
    data['properties']['location'] = 'Colorado, USA'
    data['properties']['difficulty'] = 'Moderate'
    
    with open(geojson_file, 'w') as f:
        json.dump(data, f, indent=2)
```

**Node.js:**
```javascript
const fs = require('fs');
const path = require('path');

const tracksDir = 'trail-viewer/public/tracks';
fs.readdirSync(tracksDir)
  .filter(f => f.endsWith('.geojson'))
  .forEach(file => {
    const filepath = path.join(tracksDir, file);
    const data = JSON.parse(fs.readFileSync(filepath));
    
    // Add custom properties
    data.properties.location = 'Colorado, USA';
    data.properties.difficulty = 'Moderate';
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  });
```

---

## Tips

- **Name your GPX files descriptively** - the filename becomes the track name if not specified in the GPX metadata
- **Use one GPX file per track** - don't combine multiple hikes in one file
- **Keep elevation data** - it enables the elevation profile chart feature
- **Add locations** - helps users search and filter tracks
- **Organize by region** - you can create subdirectories and load different sets of tracks

Enjoy mapping your adventures! 🏔️
