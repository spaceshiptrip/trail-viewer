#!/usr/bin/env node

/**
 * Manifest Generator for Trail Viewer
 * 
 * This script scans your tracks directory and generates manifest.json
 * 
 * Usage:
 *   node generate-manifest.js
 * 
 * It will:
 * 1. Find all .geojson files in public/tracks/
 * 2. Calculate distance and elevation for each
 * 3. Generate manifest.json with metadata
 */

const fs = require('fs');
const path = require('path');

// Constants for calculations
const EARTH_RADIUS_MILES = 3959;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += EARTH_RADIUS_MILES * c;
  }
  return total;
}

function calculateElevationGain(coords) {
  if (!coords || coords.length < 2) return 0;

  const zs = coords
    .map(c => Number(c?.[2]))
    .filter(z => Number.isFinite(z));

  if (zs.length < 2) return 0;

  const start = zs[0];
  const max = Math.max(...zs);
  const floor = max - start; // meters

  const NOISE_FT = 5;
  const M_TO_FT = 3.28084;

  let gainMeters = 0;
  for (let i = 1; i < zs.length; i++) {
    const diff = zs[i] - zs[i - 1]; // meters
    if (diff * M_TO_FT > NOISE_FT) gainMeters += diff;
  }

  const outMeters = Math.max(gainMeters, floor);
  return outMeters * M_TO_FT; // return FEET
}

function processTrack(filepath) {
  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    let feature;
    if (data.type === 'FeatureCollection' && data.features.length > 0) {
      feature = data.features[0];
    } else if (data.type === 'Feature') {
      feature = data;
    } else {
      return null;
    }

    let coords;
    if (feature.geometry.type === 'LineString') {
      coords = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'MultiLineString') {
      coords = feature.geometry.coordinates[0];
    } else {
      return null;
    }

    const filename = path.basename(filepath);
    const distance = calculateDistance(coords);
    const elevationGain = calculateElevationGain(coords);

    return {
      file: filename,
      name: feature.properties?.name || filename.replace('.geojson', ''),
      location: feature.properties?.location || '',
      description: feature.properties?.description || '',
      distance: Math.round(distance * 100) / 100,
      elevationGain: Math.round(elevationGain)
    };
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return null;
  }
}

function generateManifest() {
  const tracksDir = path.join(process.cwd(), 'public', 'tracks');
  
  if (!fs.existsSync(tracksDir)) {
    console.error(`Error: Directory not found: ${tracksDir}`);
    console.error('Make sure you run this from your project root');
    process.exit(1);
  }

  const files = fs.readdirSync(tracksDir)
    .filter(f => f.endsWith('.geojson'))
    .sort();

  console.log(`Found ${files.length} GeoJSON files`);

  const tracks = files
    .map(filename => {
      console.log(`Processing ${filename}...`);
      return processTrack(path.join(tracksDir, filename));
    })
    .filter(Boolean);

  const manifest = { tracks };

  const outputPath = path.join(tracksDir, 'manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Generated manifest.json with ${tracks.length} tracks`);
  console.log(`   Location: ${outputPath}`);
  
  // Print summary
  console.log('\nTracks:');
  tracks.forEach(t => {
    console.log(`  - ${t.name} (${t.distance} mi, ${t.elevationGain} ft)`);
  });
}

// Run it
generateManifest();
