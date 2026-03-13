const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const { validateGpxFile } = require('../scripts/validate-gpx.cjs');

async function makeTempFile(name, contents) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trail-viewer-validate-gpx-'));
  const file = path.join(dir, name);
  await fs.writeFile(file, contents, 'utf8');
  return file;
}

test('validateGpxFile warns when elevation is missing', async () => {
  const file = await makeTempFile(
    'no-ele.gpx',
    `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>No Elevation</name>
    <trkseg>
      <trkpt lat="34.1" lon="-117.1"></trkpt>
      <trkpt lat="34.2" lon="-117.2"></trkpt>
    </trkseg>
  </trk>
</gpx>`
  );

  const result = validateGpxFile(file);

  assert.equal(result.ok, true);
  assert.equal(result.stats.trackPoints, 2);
  assert.equal(result.stats.pointsWithElevation, 0);
  assert.match(result.warnings.join('\n'), /No elevation data found/);
});

test('validateGpxFile detects elevation when present', async () => {
  const file = await makeTempFile(
    'with-ele.gpx',
    `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>With Elevation</name>
    <trkseg>
      <trkpt lat="34.1" lon="-117.1"><ele>100.0</ele></trkpt>
      <trkpt lat="34.2" lon="-117.2"><ele>150.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`
  );

  const result = validateGpxFile(file);

  assert.equal(result.ok, true);
  assert.equal(result.stats.pointsWithElevation, 2);
  assert.deepEqual(result.stats.elevationRange, { min: 100, max: 150 });
});

test('validateGpxFile fails invalid GPX structure', async () => {
  const file = await makeTempFile(
    'bad.gpx',
    `<notgpx></notgpx>`
  );

  const result = validateGpxFile(file);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Missing <gpx> root element/);
});
