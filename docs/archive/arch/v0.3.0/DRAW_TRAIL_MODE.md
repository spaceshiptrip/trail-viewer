# Draw Trail Mode - Create Trails from Scratch! 🎨🗺️

## Overview

The **Draw Trail Mode** is a powerful new feature that lets you create trail maps directly in the app by drawing on the map! The app automatically snaps your drawn points to roads, trails, and paths using the free **OSRM (Open Source Routing Machine)** API.

## Perfect For:

- 🏃 **Planning a new route** - Draw where you want to go
- 🚴 **Creating custom bike routes** - Design your perfect ride
- 🥾 **Trail mapping** - Document trails that don't exist in databases
- 📱 **Mobile-friendly** - Works great on phones and tablets
- 🗺️ **Route sharing** - Export and share with friends

---

## How It Works

### The Technology

**Route Snapping / Map Matching:**
When you click points on the map, the app sends them to OSRM's public server which uses OpenStreetMap data to find the most likely path you intended to draw. This "snaps" your rough clicks to actual roads and trails.

**Why It's Smart:**
- Accounts for one-way streets
- Follows actual trail/road geometry
- Fills in gaps between your points
- Creates smooth, accurate routes

**API Used:**
- **OSRM Match Service** - https://router.project-osrm.org
- **Free & Open Source** - No API key needed
- **OpenStreetMap Data** - Worldwide coverage
- **Profile: Foot** - Best for trails (ignores one-way restrictions)

---

## Step-by-Step Guide

### 1. Enter Draw Mode
Click the **"Draw New Trail"** button at the bottom of the track list panel.

### 2. Start Drawing
Click the **"Start Drawing"** button in the control panel.
- Your cursor becomes a crosshair
- Click on the map to add points along your intended route
- Add points every few hundred meters for best results

**Tips for Drawing:**
- ✅ Click along the path you want to follow
- ✅ Add more points on curvy sections
- ✅ Points should be relatively close (within a few blocks)
- ❌ Don't skip large sections
- ❌ Don't put points too far from roads/trails

### 3. Snap to Roads
When you're done placing points, click **"Snap to Road"**.
- The app sends your points to OSRM
- OSRM finds the most logical route
- A green line appears showing the snapped route
- Your original red dots remain visible

### 4. Enter Trail Details
Fill in the trail information:
- **Trail Name*** (required) - Give your trail a memorable name
- **Location** - Where is this trail? (State Park, City, etc.)
- **Description** - Add details about the trail

**Automatic Calculations:**
- Distance is calculated from the snapped route
- Duration can be estimated (though not currently displayed)

### 5. Save Your Trail
Choose your export format:
- **Download GeoJSON** - Works with this app and most mapping tools
- **Download GPX** - Works with GPS devices, Strava, AllTrails, etc.

**After Download:**
- The file saves to your Downloads folder
- You can upload the GeoJSON to the app's `/public/tracks/` folder
- Share the GPX with hiking/biking apps
- The trail also gets added to your current session automatically!

### 6. Start Over (Optional)
Click **"Start New Trail"** to clear and draw another route.

---

## Mobile Usage

### Touch Drawing
- Tap on the map to add points
- Works just like clicking on desktop
- Zoom and pan between taps
- The control panel floats over the map

### Best Practices for Mobile:
1. **Zoom in first** - Closer zoom = more accurate placement
2. **Take your time** - Carefully tap along the route
3. **Use landmarks** - Tap at intersections, trailheads, etc.
4. **Check the route** - Zoom out after snapping to verify

---

## Technical Details

### OSRM Match Service

**Endpoint:**
```
GET https://router.project-osrm.org/match/v1/foot/{coordinates}
```

**Parameters:**
- `overview=full` - Returns complete route geometry
- `geometries=geojson` - Returns GeoJSON format
- `steps=true` - Includes turn-by-turn steps
- `annotations=true` - Includes metadata

**Input Format:**
```
lon1,lat1;lon2,lat2;lon3,lat3
```

**Output:**
```json
{
  "code": "Ok",
  "matchings": [{
    "geometry": {
      "coordinates": [[lon, lat], [lon, lat], ...]
    },
    "distance": 5280,  // meters
    "duration": 3600   // seconds
  }]
}
```

### File Formats

**GeoJSON Output:**
```json
{
  "type": "Feature",
  "properties": {
    "name": "My Trail",
    "description": "A beautiful hike",
    "location": "State Park, CA",
    "distance": "3.28",
    "created": "2026-02-04T12:00:00Z"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[lon, lat, 0], ...]
  }
}
```

**GPX Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trail Explorer">
  <trk>
    <name>My Trail</name>
    <desc>A beautiful hike</desc>
    <trkseg>
      <trkpt lat="40.7128" lon="-74.0060">
        <ele>0</ele>
      </trkpt>
      <!-- more trackpoints -->
    </trkseg>
  </trk>
</gpx>
```

---

## Common Use Cases

### 1. Planning a Hike
**Scenario:** You want to hike from Point A to Point B but aren't sure of the exact route.

**Steps:**
1. Enter Draw Mode
2. Click at your starting point (parking lot, trailhead)
3. Click at key landmarks along the way
4. Click at your destination
5. Snap to roads to see the actual trail path
6. Download GPX and load on your GPS device

### 2. Creating a Bike Route
**Scenario:** You want to design a scenic bike ride through your city.

**Steps:**
1. Enter Draw Mode
2. Click along streets you want to ride
3. The route will snap to bike-friendly paths
4. Add your own notes in the description
5. Export and share with friends

### 3. Documenting a Trail
**Scenario:** You hiked an unmapped trail and want to document it.

**Steps:**
1. While hiking, note key waypoints
2. Later, enter Draw Mode
3. Recreate the route by clicking waypoints
4. Snap to roads (it works for trails too!)
5. Export as GeoJSON for your collection

### 4. Route Comparison
**Scenario:** You want to compare two different routes to the same destination.

**Steps:**
1. Draw first route, save as "Route A"
2. Start new trail, draw second route
3. Save as "Route B"
4. Load both GeoJSON files in the app
5. Compare distance and terrain

---

## Troubleshooting

### "Could not match route to roads"
**Problem:** OSRM couldn't find a valid path.

**Solutions:**
- Add more points (especially in complex areas)
- Make sure points are close together
- Check that you're clicking on/near actual roads/trails
- Try a different path

### Points Too Far Apart
**Problem:** The snapped route goes a strange way.

**Solutions:**
- Add intermediate points
- Be more specific with your clicks
- Follow the actual road/trail more closely

### Route Goes Wrong Way
**Problem:** The route takes an unexpected path.

**Solutions:**
- Add a point at the specific location where it goes wrong
- The more points, the more control you have
- OSRM uses OpenStreetMap data, so it follows that network

### App is Slow
**Problem:** Snapping takes a long time.

**Reasons:**
- OSRM public server can be busy
- You have many points (100+ coordinates)
- Network connectivity

**Solutions:**
- Use fewer points (15-30 is usually enough)
- Try again in a few moments
- For heavy usage, consider running your own OSRM server

---

## API Limitations

### OSRM Public Server
- **Free to use** - No API key required
- **Rate limits** - Please be respectful, don't spam
- **No SLA** - It's a demo server, availability not guaranteed
- **Point limit** - Keep under 100 points for best results

### For Production Use
If you're building an app or need guaranteed uptime:
1. Run your own OSRM server (it's open source!)
2. Use a commercial routing API (Mapbox, Google, etc.)
3. See OSRM documentation: https://project-osrm.org/

---

## Advanced Tips

### Optimizing Point Placement
- **Intersections** - Always add a point at turns
- **Curved sections** - Add 2-3 points on curves
- **Straight roads** - Can skip intermediate points
- **Complex areas** - Add points every block

### Getting Better Elevation Data
The current implementation sets elevation to 0. To add real elevation:
1. Use the Open-Meteo Elevation API
2. Or use Google Elevation API
3. Or manually add elevation from topo maps

### Batch Creating Trails
Want to create many trails?
1. Draw and export each one
2. Place all GeoJSON files in `/public/tracks/`
3. Update `trackFiles` array in `App.jsx`
4. All trails load automatically!

### Using Your Own OSRM Server
If you want full control:
```bash
# Run OSRM locally with Docker
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/foot.lua /data/map.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/map.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/map.osrm
docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/map.osrm
```

Then update the OSRM_SERVER constant in `DrawTrailMode.jsx`:
```javascript
const OSRM_SERVER = 'http://localhost:5000';
```

---

## Future Enhancements

Potential improvements for this feature:
- **Real-time elevation** - Fetch elevation for each point
- **Multiple route options** - Show alternative paths
- **Route profiles** - Car, bike, hike with different snapping
- **Undo/Redo** - Go back if you make a mistake
- **Edit mode** - Adjust snapped routes after creation
- **Waypoint labels** - Name each point you click
- **Distance preview** - Show distance as you draw
- **Offline mode** - Cache maps for offline drawing

---

## Privacy & Data

**What data is sent:**
- Your clicked coordinates (latitude/longitude)
- That's it!

**What data is NOT sent:**
- No personal information
- No device info
- No location tracking

**Where it goes:**
- OSRM public server operated by FOSSGIS
- Used only for route calculation
- Not stored or logged (to our knowledge)

**Your files:**
- Saved locally to your device
- You control where they go
- No cloud upload unless you choose

---

## Comparison to Other Tools

### vs. Google My Maps
- ✅ Free and open source
- ✅ Works offline after drawing
- ✅ Better for trails (not just roads)
- ❌ No satellite imagery
- ❌ No real-time traffic

### vs. Strava Route Builder
- ✅ No account required
- ✅ Export to any format
- ✅ More control over path
- ❌ No heatmaps
- ❌ No popularity routing

### vs. AllTrails
- ✅ Create trails, not just view
- ✅ Full control over route
- ✅ Export to GPS device
- ❌ No crowd-sourced reviews
- ❌ No photos/conditions

### vs. Caltopo
- ✅ Simpler interface
- ✅ Faster for basic routes
- ❌ No topo maps
- ❌ No advanced planning tools

---

## Credits

- **OSRM** - Open Source Routing Machine (project-osrm.org)
- **OpenStreetMap** - Map data (openstreetmap.org)
- **Leaflet** - Map rendering (leafletjs.com)
- **FOSSGIS** - Hosting the public OSRM server

---

Enjoy creating your custom trails! Share your routes and happy adventuring! 🏔️✨
