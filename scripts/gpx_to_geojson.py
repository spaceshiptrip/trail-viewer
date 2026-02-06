#!/usr/bin/env python3

"""
GPX to GeoJSON Converter (Python)

Usage:
    pip install gpxpy
    python gpx_to_geojson.py input.gpx output.geojson

Or convert all GPX files in a directory:
    python gpx_to_geojson.py ./gpx-files ./output-geojson
"""

import gpxpy
import json
import sys
import os
from pathlib import Path


def convert_gpx_to_geojson(gpx_path, geojson_path):
    """Convert a single GPX file to GeoJSON format."""
    try:
        with open(gpx_path, 'r', encoding='utf-8') as gpx_file:
            gpx = gpxpy.parse(gpx_file)
        
        # Extract coordinates from all tracks and segments
        coordinates = []
        for track in gpx.tracks:
            for segment in track.segments:
                for point in segment.points:
                    # Format: [longitude, latitude, elevation]
                    coord = [point.longitude, point.latitude]
                    if point.elevation is not None:
                        coord.append(point.elevation)
                    coordinates.append(coord)
        
        if not coordinates:
            raise ValueError("No coordinates found in GPX file")
        
        # Get metadata from the first track
        name = gpx.tracks[0].name if gpx.tracks and gpx.tracks[0].name else Path(gpx_path).stem
        description = gpx.tracks[0].description if gpx.tracks and gpx.tracks[0].description else ""
        
        # Create GeoJSON feature
        geojson = {
            "type": "Feature",
            "properties": {
                "name": name,
                "description": description,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            }
        }
        
        # Write to file
        with open(geojson_path, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"✓ Converted: {gpx_path} → {geojson_path}")
        return True
        
    except Exception as e:
        print(f"✗ Error converting {gpx_path}: {str(e)}")
        return False


def convert_directory(input_dir, output_dir):
    """Convert all GPX files in a directory to GeoJSON."""
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all GPX files
    gpx_files = list(Path(input_dir).glob('*.gpx')) + list(Path(input_dir).glob('*.GPX'))
    
    if not gpx_files:
        print(f"No GPX files found in {input_dir}")
        return
    
    print(f"Found {len(gpx_files)} GPX files to convert...\n")
    
    success_count = 0
    for gpx_path in gpx_files:
        geojson_path = Path(output_dir) / f"{gpx_path.stem}.geojson"
        if convert_gpx_to_geojson(str(gpx_path), str(geojson_path)):
            success_count += 1
    
    print(f"\nConverted {success_count}/{len(gpx_files)} files successfully!")


def add_location_to_geojson(geojson_path, location):
    """Add a location property to an existing GeoJSON file."""
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson = json.load(f)
        
        geojson['properties']['location'] = location
        
        with open(geojson_path, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2)
        
        print(f"✓ Added location '{location}' to {geojson_path}")
        
    except Exception as e:
        print(f"✗ Error updating {geojson_path}: {str(e)}")


def main():
    """Main execution function."""
    if len(sys.argv) < 3:
        print("""
GPX to GeoJSON Converter

Usage:
  python gpx_to_geojson.py <input> <output>

Examples:
  # Convert single file
  python gpx_to_geojson.py track.gpx track.geojson
  
  # Convert all GPX files in a directory
  python gpx_to_geojson.py ./gpx-files ./geojson-output
  
  # Add location to existing GeoJSON (optional)
  python gpx_to_geojson.py --add-location track.geojson "Yosemite, CA"

Prerequisites:
  pip install gpxpy
        """)
        sys.exit(1)
    
    # Handle --add-location flag
    if sys.argv[1] == '--add-location' and len(sys.argv) >= 4:
        add_location_to_geojson(sys.argv[2], sys.argv[3])
        return
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Check if input is a file or directory
    if os.path.isdir(input_path):
        convert_directory(input_path, output_path)
    elif os.path.isfile(input_path):
        convert_gpx_to_geojson(input_path, output_path)
    else:
        print(f"Error: '{input_path}' is not a valid file or directory")
        sys.exit(1)


if __name__ == '__main__':
    main()
