const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const { addTrack, slugifyFilename } = require('../scripts/add-track.cjs');

async function makeTempRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'trail-viewer-add-track-'));
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'tracks', 'gpx'), { recursive: true });
  return root;
}

test('slugifyFilename converts spaces and punctuation to a stable slug', () => {
  assert.equal(
    slugifyFilename('Cactus To Clouds To Tram To Parking.gpx'),
    'cactus-to-clouds-to-tram-to-parking.gpx'
  );

  assert.equal(
    slugifyFilename('Icehouse & Cucamonga Peak!.gpx'),
    'icehouse-and-cucamonga-peak.gpx'
  );
});

test('addTrack copies GPX, calls converter + manifest, and returns paths', async () => {
  const repoRoot = await makeTempRepo();
  const inputFile = path.join(repoRoot, 'sample input.gpx');
  await fs.writeFile(inputFile, '<gpx><trk><name>Sample</name></trk></gpx>', 'utf8');

  const calls = [];

  async function fakeExec(cmd, args, opts) {
    calls.push({ cmd, args, cwd: opts.cwd });

    const converterScript = path.join(repoRoot, 'scripts', 'gpx-to-geojson.cjs');
    const manifestScript = path.join(repoRoot, 'scripts', 'generate-manifest.cjs');

    if (args[0] === converterScript) {
      const gpxPath = args[1];
      const tracksDir = args[2];
      const geojsonName = path.basename(gpxPath).replace(/\.gpx$/i, '.geojson');
      const geojsonPath = path.join(tracksDir, geojsonName);

      await fs.writeFile(
        geojsonPath,
        JSON.stringify({
          type: 'FeatureCollection',
          features: [],
        }),
        'utf8'
      );
    }

    if (args[0] === manifestScript) {
      await fs.writeFile(
        path.join(repoRoot, 'public', 'tracks', 'manifest.json'),
        JSON.stringify([{ name: 'sample-input' }], null, 2),
        'utf8'
      );
    }

    return { stdout: '', stderr: '' };
  }

  const result = await addTrack(inputFile, {
    repoRoot,
    exec: fakeExec,
    verbose: false,
  });

  assert.equal(
    path.basename(result.gpxPath),
    'sample-input.gpx'
  );
  assert.equal(
    path.basename(result.geojsonPath),
    'sample-input.geojson'
  );

  const copiedGpx = await fs.readFile(result.gpxPath, 'utf8');
  assert.match(copiedGpx, /<gpx>/);

  const geojson = JSON.parse(await fs.readFile(result.geojsonPath, 'utf8'));
  assert.equal(geojson.type, 'FeatureCollection');

  const manifest = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'public', 'tracks', 'manifest.json'), 'utf8')
  );
  assert.equal(Array.isArray(manifest), true);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].cmd, 'node');
  assert.equal(calls[1].cmd, 'node');
  assert.match(calls[0].args[0], /gpx-to-geojson\.cjs$/);
  assert.match(calls[1].args[0], /generate-manifest\.cjs$/);
});

test('addTrack rejects missing source file', async () => {
  const repoRoot = await makeTempRepo();

  await assert.rejects(
    addTrack(path.join(repoRoot, 'does-not-exist.gpx'), {
      repoRoot,
      verbose: false,
    }),
    /Source file does not exist/
  );
});
