# Trail Explorer - Update Notes

## New Features Added ✨

### 1. Auto-Center Map on Track Selection
When you click on a track in the sidebar, the map now automatically centers and zooms to show the entire selected track perfectly!

**How it works:**
- Automatically calculates the bounds of the selected track
- Smoothly pans and zooms to fit the track in view
- Applies 50px padding around edges for better visibility
- Max zoom of 14 to avoid being too close

### 2. Air Quality Index (AQI) Display
Added real-time and forecasted air quality data for each trail location!

**Features:**
- 🎨 **Color-coded AQI badge** following EPA standards:
  - Green (0-50): Good
  - Yellow (51-100): Moderate
  - Orange (101-150): Unhealthy for Sensitive Groups
  - Red (151-200): Unhealthy
  - Purple (201-300): Very Unhealthy
  - Maroon (300+): Hazardous

- 📊 **Current Air Quality:**
  - Live AQI reading
  - PM2.5 and PM10 particle measurements
  - Category name (Good, Moderate, etc.)

- 🔮 **24-Hour Forecast:**
  - Predicted AQI for the next day
  - Helps plan your hike timing
  - Category prediction

**Data Source:** Open-Meteo Air Quality API (100% free, no API key needed!)

---

## Files Changed

### `/src/components/Map.jsx`
- Updated `FitBounds` component to accept `selectedTrack` prop
- Automatically zooms to selected track when clicked
- Falls back to showing all tracks when nothing is selected

### `/src/components/Sidebar.jsx`
- Added AQI state management
- Added `fetchAQI` call alongside weather fetch
- New Air Quality section with current and forecast display
- Color-coded circular AQI badge
- PM2.5 and PM10 particle measurements

### `/src/utils.js`
- Added `fetchAQI()` function using Open-Meteo Air Quality API
- Added `getAQICategory()` helper for EPA color standards
- Fetches current AQI and 24-hour forecast

### `/src/index.css`
- Fixed CSS opacity syntax issues for Tailwind compatibility
- Fixed shadow syntax for trail cards

---

## Testing the Updates

1. **Map Centering:**
   - Click any track in the left sidebar
   - Watch the map smoothly zoom and center on that track
   - Click a different track to see it re-center

2. **Air Quality:**
   - Select a track
   - Scroll down in the right sidebar past the weather section
   - See the current AQI badge with color coding
   - Check the 24-hour forecast below it

---

## API Details

### Open-Meteo Air Quality API
- **Endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality`
- **Cost:** Free forever, no API key required
- **Rate Limit:** Generous for non-commercial use
- **Data:**
  - US EPA Air Quality Index
  - PM2.5 and PM10 measurements
  - Hourly forecasts for next 48 hours

### Why AQI Matters for Hiking
- Exercise increases breathing rate, so air quality is important
- Helps plan hike timing (early morning often has better air quality)
- Useful during wildfire season
- Important for people with respiratory conditions

---

## Known Limitations

1. **AQI Coverage:** Not all remote areas have AQI monitoring stations. If data is unavailable, it will show "Air quality data unavailable"

2. **Forecast Accuracy:** 24-hour AQI forecast is an average of hourly predictions, actual conditions may vary

3. **Map Zoom:** Max zoom is capped at level 14 to prevent over-zooming on short tracks

---

## Future Enhancement Ideas

Want to add more features? Here are some ideas:
- Sunrise/sunset times for the trail location
- Trail difficulty rating calculator based on distance + elevation
- Estimated hiking time based on Naismith's rule
- Nearby points of interest
- Trailhead parking information
- Cell signal coverage map overlay

Enjoy your enhanced trail viewer! 🏔️
