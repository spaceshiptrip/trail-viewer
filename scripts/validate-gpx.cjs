#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

const color = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  bold: '\x1b[1m',
};

function red(msg) {
  return `${color.red}${msg}${color.reset}`;
}

function yellow(msg) {
  return `${color.yellow}${msg}${color.reset}`;
}

function green(msg) {
  return `${color.green}${msg}${color.reset}`;
}

function bold(msg) {
  return `${color.bold}${msg}${color.reset}`;
}

function text(node) {
  return node && typeof node.textContent === 'string' ? node.textContent.trim() : '';
}

function childrenByTag(node, tagName) {
  const out = [];
  const nodes = node.getElementsByTagName(tagName);
  for (let i = 0; i < nodes.length; i++) out.push(nodes[i]);
  return out;
}

function validateGpxFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`GPX file not found: ${absolutePath}`);
  }

  const xml = fs.readFileSync(absolutePath, 'utf8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    return {
      ok: false,
      errors: ['Invalid XML / GPX parse error'],
      warnings: [],
      stats: null,
    };
  }

  const gpxNodes = doc.getElementsByTagName('gpx');
  if (gpxNodes.length === 0) {
    return {
      ok: false,
      errors: ['Missing <gpx> root element'],
      warnings: [],
      stats: null,
    };
  }

  const trackPoints = childrenByTag(doc, 'trkpt');
  const routePoints = childrenByTag(doc, 'rtept');
  const waypoints = childrenByTag(doc, 'wpt');

  const points = trackPoints.length > 0 ? trackPoints : routePoints;

  if (points.length === 0) {
    return {
      ok: false,
      errors: ['No <trkpt> or <rtept> points found'],
      warnings: [],
      stats: {
        trackPoints: 0,
        routePoints: routePoints.length,
        waypoints: waypoints.length,
        pointsUsed: 0,
        pointsWithElevation: 0,
        elevationRange: null,
      },
    };
  }

  let missingLatLon = 0;
  let pointsWithElevation = 0;
  let invalidElevationValues = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  for (const pt of points) {
    const lat = pt.getAttribute('lat');
    const lon = pt.getAttribute('lon');

    if (!lat || !lon) {
      missingLatLon++;
    }

    const eleNode = pt.getElementsByTagName('ele')[0];
    const eleText = text(eleNode);

    if (eleText) {
      const value = Number(eleText);
      if (Number.isFinite(value)) {
        pointsWithElevation++;
        if (value < minEle) minEle = value;
        if (value > maxEle) maxEle = value;
      } else {
        invalidElevationValues++;
      }
    }
  }

  const warnings = [];
  const errors = [];

  if (missingLatLon > 0) {
    warnings.push(`${missingLatLon} point(s) are missing lat/lon`);
  }

  if (pointsWithElevation === 0) {
    warnings.push(
      'No elevation data found: points do not contain <ele> values, so elevationGain will be 0'
    );
  } else if (invalidElevationValues > 0) {
    warnings.push(`${invalidElevationValues} point(s) have invalid <ele> values`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      trackPoints: trackPoints.length,
      routePoints: routePoints.length,
      waypoints: waypoints.length,
      pointsUsed: points.length,
      pointsWithElevation,
      elevationRange:
        pointsWithElevation > 0
          ? {
              min: minEle,
              max: maxEle,
            }
          : null,
    },
  };
}

function printReport(result, filePath) {
  console.log(`${bold('Validating:')} ${filePath}`);

  if (result.errors.length) {
    for (const err of result.errors) {
      console.error(red(`ERROR: ${err}`));
    }
  }

  for (const warning of result.warnings) {
    console.warn(yellow(`WARNING: ${warning}`));
  }

  if (result.stats) {
    console.log(`Track points: ${result.stats.trackPoints}`);
    console.log(`Route points: ${result.stats.routePoints}`);
    console.log(`Waypoints: ${result.stats.waypoints}`);
    console.log(`Points used: ${result.stats.pointsUsed}`);
    console.log(`Points with elevation: ${result.stats.pointsWithElevation}`);

    if (result.stats.elevationRange) {
      console.log(
        `Elevation range: ${result.stats.elevationRange.min} to ${result.stats.elevationRange.max}`
      );
    }
  }

  if (result.ok) {
    console.log(green('✔ GPX validation passed'));
  } else {
    console.error(red('✖ GPX validation failed'));
  }
}

if (require.main === module) {
  const input = process.argv[2];

  if (!input) {
    console.error(red('Usage: node scripts/validate-gpx.cjs <file.gpx>'));
    process.exit(1);
  }

  try {
    const result = validateGpxFile(input);
    printReport(result, input);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(red(error.message));
    process.exit(1);
  }
}

module.exports = {
  validateGpxFile,
};
