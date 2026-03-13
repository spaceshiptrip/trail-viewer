#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { promisify } = require("util");
const { execFile } = require("child_process");
const { validateGpxFile } = require("./validate-gpx.cjs");

const execFileAsync = promisify(execFile);

const color = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
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

function slugifyFilename(inputName) {
  const ext = path.extname(inputName).toLowerCase();
  const base = path.basename(inputName, ext);

  const slug = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();

  return `${slug || "track"}${ext}`;
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function addTrack(sourcePath, options = {}) {
  if (!sourcePath) {
    throw new Error("Usage: npm run add-track -- /path/to/file.gpx");
  }

  const repoRoot = options.repoRoot || process.cwd();
  const tracksDir =
    options.tracksDir || path.join(repoRoot, "public", "tracks");
  const gpxDir = options.gpxDir || path.join(tracksDir, "gpx");
  const converterScript =
    options.converterScript ||
    path.join(repoRoot, "scripts", "gpx-to-geojson.cjs");
  const manifestScript =
    options.manifestScript ||
    path.join(repoRoot, "scripts", "generate-manifest.cjs");
  const exec = options.exec || execFileAsync;
  const verbose = options.verbose !== false;

  const absoluteSourcePath = path.resolve(sourcePath);

  if (!(await fileExists(absoluteSourcePath))) {
    throw new Error(`Source file does not exist: ${absoluteSourcePath}`);
  }

  if (path.extname(absoluteSourcePath).toLowerCase() !== ".gpx") {
    throw new Error(`Expected a .gpx file, got: ${absoluteSourcePath}`);
  }

  const validation = validateGpxFile(absoluteSourcePath);

  if (!validation.ok) {
    throw new Error(
      `GPX validation failed:\n${validation.errors.map((e) => `- ${e}`).join("\n")}`,
    );
  }

  await ensureDir(gpxDir);
  await ensureDir(tracksDir);

  const sluggedGpxName = slugifyFilename(path.basename(absoluteSourcePath));
  const destinationGpxPath = path.join(gpxDir, sluggedGpxName);
  const geojsonName = sluggedGpxName.replace(/\.gpx$/i, ".geojson");
  const destinationGeojsonPath = path.join(tracksDir, geojsonName);
  const manifestPath = path.join(tracksDir, "manifest.json");

  const gpxAlreadyExists = await fileExists(destinationGpxPath);
  if (gpxAlreadyExists && verbose) {
    console.warn(
      yellow(
        `Warning: overwriting existing GPX: ${path.relative(repoRoot, destinationGpxPath)}`,
      ),
    );
  }

  if (validation.warnings.length && verbose) {
    for (const warning of validation.warnings) {
      console.warn(yellow(`Warning: ${warning}`));
    }
  }

  await fsp.copyFile(absoluteSourcePath, destinationGpxPath);

  if (verbose) {
    console.log(green(`Added GPX: ${path.relative(repoRoot, destinationGpxPath)}`));
  }

  await exec("node", [converterScript, destinationGpxPath, tracksDir], {
    cwd: repoRoot,
  });

  if (!(await fileExists(destinationGeojsonPath))) {
    throw new Error(
      `GeoJSON was not generated where expected: ${destinationGeojsonPath}`,
    );
  }

  if (verbose) {
    console.log(
      green(
        `Generated GeoJSON: ${path.relative(repoRoot, destinationGeojsonPath)}`,
      ),
    );
  }

  await exec("node", [manifestScript], {
    cwd: repoRoot,
  });

  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest was not generated where expected: ${manifestPath}`);
  }

  if (verbose) {
    console.log(green(`Updated manifest.json`));
  }

  return {
    sourcePath: absoluteSourcePath,
    gpxPath: destinationGpxPath,
    geojsonPath: destinationGeojsonPath,
    manifestPath,
  };
}

async function main() {
  const sourcePath = process.argv[2];

  try {
    await addTrack(sourcePath);
  } catch (error) {
    console.error(red(error.message));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  addTrack,
  slugifyFilename,
};
