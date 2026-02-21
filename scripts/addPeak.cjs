#!/usr/bin/env node
/**
 * Interactive Peak Adder
 *
 * Usage:
 *   node scripts/add-peak.cjs
 *
 * Writes to: ROOT/public/peaks/peaks.json
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

const PEAKS_PATH = path.resolve(process.cwd(), "public/peaks/peaks.json");

const FT_PER_M = 3.280839895;

function parseNumberOrNull(s) {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeName(name) {
  return String(name || "").trim();
}

function feetFrom(value, unit) {
  if (unit === "ft") return value;
  return value * FT_PER_M;
}

function loadPeaks(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Expected JSON array in ${filePath}`);
  return parsed;
}

function savePeaks(filePath, peaks) {
  fs.writeFileSync(filePath, JSON.stringify(peaks, null, 2) + "\n", "utf8");
}

async function askNonEmpty(rl, promptText) {
  while (true) {
    const v = normalizeName(await rl.question(promptText));
    if (v) return v;
    output.write("Please enter a non-empty value.\n");
  }
}

async function askOptional(rl, promptText) {
  return normalizeName(await rl.question(promptText));
}

async function askNumber(rl, promptText, { min = null, max = null } = {}) {
  while (true) {
    const s = await rl.question(promptText);
    const n = parseNumberOrNull(s);
    if (n === null) {
      output.write("Please enter a valid number.\n");
      continue;
    }
    if (min !== null && n < min) {
      output.write(`Value must be ≥ ${min}.\n`);
      continue;
    }
    if (max !== null && n > max) {
      output.write(`Value must be ≤ ${max}.\n`);
      continue;
    }
    return n;
  }
}

async function askUnit(rl) {
  while (true) {
    const u = normalizeName(await rl.question("Elevation unit? (ft/m) [ft]: ")).toLowerCase();
    if (!u || u === "ft" || u === "feet" || u === "f") return "ft";
    if (u === "m" || u === "meter" || u === "meters") return "m";
    output.write("Please enter 'ft' or 'm'.\n");
  }
}

async function askYesNo(rl, promptText, defaultYes = false) {
  const suffix = defaultYes ? " [Y/n]: " : " [y/N]: ";
  while (true) {
    const a = normalizeName(await rl.question(promptText + suffix)).toLowerCase();
    if (!a) return defaultYes;
    if (a === "y" || a === "yes") return true;
    if (a === "n" || a === "no") return false;
    output.write("Please enter y or n.\n");
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    output.write(`\n📍 Peak Adder\nWriting to: ${PEAKS_PATH}\n\n`);

    const peaks = loadPeaks(PEAKS_PATH);

    const name = await askNonEmpty(rl, "Peak name: ");

    // Optional description (blank is fine)
    const description = await askOptional(rl, "Description (optional): ");

    // Duplicate name check (case-insensitive)
    const dupIdx = peaks.findIndex(
      (p) => String(p?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );

    if (dupIdx !== -1) {
      output.write(`\n⚠️  A peak named "${peaks[dupIdx].name}" already exists.\n`);
      const overwrite = await askYesNo(rl, "Overwrite the existing entry?", false);
      if (!overwrite) {
        output.write("Aborted (no changes made).\n");
        process.exitCode = 0;
        return;
      }
    }

    const lat = await askNumber(rl, "Latitude (e.g. 34.2894): ", { min: -90, max: 90 });
    const lon = await askNumber(rl, "Longitude (e.g. -117.6462): ", { min: -180, max: 180 });

    const elevUnit = await askUnit(rl);
    const elevValue = await askNumber(
      rl,
      `Elevation (${elevUnit === "ft" ? "feet" : "meters"}): `,
      { min: -1500, max: 40000 },
    );

    const elevationFeet = feetFrom(elevValue, elevUnit);
    const elevation = Math.round(elevationFeet);

    const entry = {
      name,
      lat,
      lon,
      elevation, // always feet
      description, // new field (may be "")
    };

    if (dupIdx !== -1) {
      peaks[dupIdx] = entry;
    } else {
      peaks.push(entry);
    }

    // Keep sorted by name
    peaks.sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
    );

    savePeaks(PEAKS_PATH, peaks);

    output.write(
      `\n✅ Saved:\n  ${name}\n  lat=${lat}\n  lon=${lon}\n  elevation=${elevation} ft\n` +
        (description ? `  description=${description}\n` : ""),
    );
  } catch (err) {
    output.write(`\n✗ Error: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
