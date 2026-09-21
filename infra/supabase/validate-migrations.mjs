import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationDir = path.join(dirname, "migrations");

// The runner records full filenames, so the two historical 024 and 025 pairs
// are deterministic and already-applied versions. Keep that history intact,
// but reject any new duplicate prefix rather than normalising old production
// ledger entries.
const LEGACY_DUPLICATE_PREFIXES = new Set(["024", "025"]);

const files = (await readdir(migrationDir))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort((a, b) => a.localeCompare(b));

const byPrefix = new Map();
for (const file of files) {
  const prefix = file.split("_", 1)[0];
  byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file]);
}

let valid = true;
for (const [prefix, entries] of byPrefix) {
  if (entries.length === 1) continue;
  const isKnownPair = LEGACY_DUPLICATE_PREFIXES.has(prefix) && entries.length === 2;
  if (isKnownPair) {
    console.log(`INFO  historical duplicate prefix ${prefix}: ${entries.join(", ")}`);
    continue;
  }
  valid = false;
  console.error(`FAIL  duplicate migration prefix ${prefix}: ${entries.join(", ")}`);
}

if (!valid) process.exit(1);
console.log(`OK    ${files.length} migration filenames have deterministic order`);
