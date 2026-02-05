#!/usr/bin/env node

/**
 * GPX to GeoJSON Converter (Node.js)
 * 
 * Usage:
 *   npm install togeojson xmldom
 *   node gpx-to-geojson.js input.gpx output.geojson
 * 
 * Or convert all GPX files in a directory:
 *   node gpx-to-geojson.js ./gpx-files ./output-geojson
 */

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const toGeoJSON = require('@tmcw/togeojson');

function convertGPXtoGeoJSON(gpxPath, geojsonPath) {
  try {
    // Read GPX file
    const gpxData = fs.readFileSync(gpxPath, 'utf8');
    
    // Parse XML
    const gpx = new DOMParser().parseFromString(gpxData);
    
    // Convert to GeoJSON
    const geoJSON = toGeoJSON.gpx(gpx);
    
    // If it's a FeatureCollection, get the first feature
    let feature;
    if (geoJSON.type === 'FeatureCollection' && geoJSON.features.length > 0) {
      feature = geoJSON.features[0];
    } else if (geoJSON.type === 'Feature') {
      feature = geoJSON;
    } else {
      throw new Error('No valid features found in GPX');
    }
    
    // Clean up and enhance properties
    const properties = {
      name: feature.properties.name || path.basename(gpxPath, '.gpx'),
      description: feature.properties.desc || feature.properties.description || '',
      // Add any other metadata you want
    };
    
    // Create clean GeoJSON feature
    const cleanFeature = {
      type: 'Feature',
      properties: properties,
      geometry: feature.geometry
    };
    
    // Write to file
    fs.writeFileSync(geojsonPath, JSON.stringify(cleanFeature, null, 2));
    console.log(`✓ Converted: ${gpxPath} → ${geojsonPath}`);
    
    return true;
  } catch (error) {
    console.error(`✗ Error converting ${gpxPath}:`, error.message);
    return false;
  }
}

function convertDirectory(inputDir, outputDir) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Get all GPX files
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.gpx'));
  
  console.log(`Found ${files.length} GPX files to convert...\n`);
  
  let successCount = 0;
  files.forEach(file => {
    const gpxPath = path.join(inputDir, file);
    const geojsonPath = path.join(outputDir, file.replace(/\.gpx$/i, '.geojson'));
    
    if (convertGPXtoGeoJSON(gpxPath, geojsonPath)) {
      successCount++;
    }
  });
  
  console.log(`\nConverted ${successCount}/${files.length} files successfully!`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
GPX to GeoJSON Converter

Usage:
  node gpx-to-geojson.js <input> <output>

Examples:
  # Convert single file
  node gpx-to-geojson.js track.gpx track.geojson
  
  # Convert all GPX files in a directory
  node gpx-to-geojson.js ./gpx-files ./geojson-output

Prerequisites:
  npm install @tmcw/togeojson xmldom
    `);
    process.exit(1);
  }
  
  const input = args[0];
  const output = args[1];
  
  // Check if input is a file or directory
  const inputStats = fs.statSync(input);
  
  if (inputStats.isDirectory()) {
    convertDirectory(input, output);
  } else if (inputStats.isFile()) {
    convertGPXtoGeoJSON(input, output);
  } else {
    console.error('Invalid input path');
    process.exit(1);
  }
}

main();
