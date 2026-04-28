/**
 * Import a money CSV into the season JSON, then auto-calculate payouts
 * for any tournament whose results are in the season's tournaments array
 * but whose money column is blank in the CSV.
 *
 * Payout structure is read from config.json.
 * The bottom count row in the CSV is automatically ignored.
 *
 * Usage:
 *   npm run import:money -- <year> <money.csv>
 *
 * Example:
 *   npm run import:money -- 2026 ~/Downloads/2026Money.csv
 */

import fs from "fs";
import path from "path";
import { parse } from "papaparse";

const [, , yearArg, moneyFile] = process.argv;
if (!yearArg || !moneyFile) {
  console.error("Usage: npx ts-node ... import-money.ts <year> <money.csv>");
  process.exit(1);
}

const year = parseInt(yearArg, 10);

// ── config ────────────────────────────────────────────────────────────────────

interface PayoutTier { entry: number; prizes: number[] }

// Payout tiers keyed by entry fee amount
// prizes[] = gross prize for 1st, 2nd, 3rd, 4th
// Net shown on ledger = prize - entry (for cashers) or -entry (for non-cashers)
const PAYOUT_TIERS: Record<number, number[]> = {
  2:  [18, 8, 6, 4],
  10: [100, 55, 35, 20],
};

// Per-tournament overrides for when payouts deviate from the tier
// (e.g. variable pool sizes). Keyed by contest slug.
const PAYOUT_OVERRIDES: Record<string, number[]> = {
  masters: [110, 55, 35, 20], // 22 entrants × $10 = $220 pool
  rbc:     [16, 9, 5],        // 15 entrants × $2 = $30 pool
  zurich:  [12, 6],           // 9 entrants × $2 = $18 pool, 1st/2nd only
};

function calcPayouts(entryFee: number, numPlayers: number, grossPrizes: number[]): Map<number, number> {
  // Returns map of rank (1-based) → net amount
  const out = new Map<number, number>();
  for (let rank = 1; rank <= numPlayers; rank++) {
    const gross = grossPrizes[rank - 1] ?? 0;
    out.set(rank, gross > 0 ? gross - entryFee : -entryFee);
  }
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseMoney(val: string): number {
  if (!val || val.trim() === "" || val.trim() === "-") return 0;
  const cleaned = val.replace(/[$, ()]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return val.includes("(") ? -Math.abs(num) : num;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── load season JSON ──────────────────────────────────────────────────────────

const seasonPath = path.resolve(`data/seasons/${year}.json`);
if (!fs.existsSync(seasonPath)) {
  console.error(`Season file not found: ${seasonPath}`);
  process.exit(1);
}
const season: any = JSON.parse(fs.readFileSync(seasonPath, "utf8"));
const tournaments: any[] = season.tournaments ?? [];

// Build a map of tournament slug → contest results
const contestMap = new Map<string, any[]>();
for (const t of tournaments) contestMap.set(t.slug, t.results);

// ── parse money CSV ───────────────────────────────────────────────────────────

const raw = fs.readFileSync(
  path.resolve(moneyFile.replace(/^~/, process.env.HOME!)), "utf8"
);
const { data: rows } = parse<string[]>(raw, { skipEmptyLines: true });

const headers = rows[0];
const tHeaders = headers.slice(5, headers.length - 1); // tournament column names (skip Yearly Entry)

// Filter out: Totals row, and the bottom count row (first cell is blank or numeric)
const dataRows = rows.slice(1).filter((row) => {
  const name = row[0]?.trim();
  if (!name) return false;
  if (name.toLowerCase().includes("total")) return false;
  if (!isNaN(Number(name))) return false;
  return true;
});

// ── determine which tournament columns need auto-calculated payouts ───────────

// A column "needs calc" if every non-blank data row has $0 in that column
// (meaning it was left blank or zero in the CSV)
function columnIsBlank(colIdx: number): boolean {
  return dataRows.every((row) => {
    const v = row[colIdx]?.trim();
    return !v || v === "" || parseMoney(v) === 0;
  });
}

// ── build money records ───────────────────────────────────────────────────────

interface MoneyRecord {
  name: string;
  entered: number;
  owed: number;
  paid: number;
  yearlyEntry: number;
  tournaments: Record<string, number | null>;
  overall: number;
}

const moneyRecords: MoneyRecord[] = dataRows.map((row) => {
  const name = row[0].trim();
  const entered = parseInt(row[1]) || 0;
  const paid = parseMoney(row[3]);
  const yearlyEntry = parseMoney(row[4]);

  const tData: Record<string, number | null> = {};
  for (let j = 0; j < tHeaders.length; j++) {
    const tName = tHeaders[j]?.trim();
    if (!tName) continue;
    const val = row[j + 5]?.trim();
    tData[tName] = val && val !== "" ? parseMoney(val) : null;
  }

  const overall = parseMoney(row[headers.length - 1]);
  // We'll recalculate owed below after adding auto-calc columns
  return { name, entered, owed: 0, paid, yearlyEntry, tournaments: tData, overall };
});

// Build name → record map
const recordMap = new Map<string, MoneyRecord>();
for (const r of moneyRecords) recordMap.set(r.name.toLowerCase().trim(), r);

// ── auto-calculate payouts for blank contest columns ─────────────────────────

for (let j = 0; j < tHeaders.length; j++) {
  const tName = tHeaders[j]?.trim();
  if (!tName) continue;
  const colIdx = j + 5;

  if (!columnIsBlank(colIdx)) continue; // already has data

  // Find matching contest — try exact slug first, then fuzzy (column name contained in slug)
  const slug = slugify(tName);
  let matchedSlug = slug;
  let results = contestMap.get(slug);
  if (!results) {
    // e.g. "Players" matches "the-players-championship"
    for (const [s, r] of contestMap) {
      if (s.includes(slug) || slug.includes(s)) { results = r; matchedSlug = s; break; }
    }
  }
  if (!results) continue;

  const entryFee = matchedSlug === "the-players-championship"
    || matchedSlug === "masters" || matchedSlug === "pga-championship"
    || matchedSlug === "us-open" || matchedSlug === "british-open" ? 10 : 2;

  const grossPrizes = PAYOUT_OVERRIDES[matchedSlug] ?? PAYOUT_TIERS[entryFee] ?? [];
  if (!grossPrizes.length) {
    console.log(`  skip  "${tName}" — no payout table defined for $${entryFee} entry`);
    continue;
  }

  const payoutMap = calcPayouts(entryFee, results.length, grossPrizes);

  console.log(`  calc  "${tName}" ($${entryFee} entry, ${results.length} players)`);
  for (const r of results) {
    const record = recordMap.get(r.playerName.toLowerCase().trim());
    if (!record) {
      console.warn(`    ⚠ No money record for ${r.playerName}`);
      continue;
    }
    const net = payoutMap.get(r.rank) ?? -entryFee;
    record.tournaments[tName] = net;
    record.entered = (record.entered || 0) + 1;
    const ptsLabel = net > 0 ? `+$${net}` : `-$${Math.abs(net)}`;
    console.log(`    ${String(r.rank).padStart(2)}. ${r.playerName.padEnd(22)} ${ptsLabel}`);
  }
}

// ── recalculate "owed" for each player ────────────────────────────────────────
// owed = yearlyEntry + sum(all tournament columns)

for (const r of moneyRecords) {
  const sum = Object.values(r.tournaments).reduce((acc: number, v) => acc + (v ?? 0), 0);
  r.owed = r.yearlyEntry + (sum as number);
}

// ── write back to season JSON (preserve tournaments array) ───────────────────

season.money = moneyRecords;
fs.writeFileSync(seasonPath, JSON.stringify(season, null, 2));

console.log(`\n✓ Updated money for ${year} — ${moneyRecords.length} players`);

// Print summary sorted by owed
const summary = [...moneyRecords]
  .filter((r) => r.owed !== 0 || r.entered > 0)
  .sort((a, b) => a.owed - b.owed);

console.log("\n  Player                   Owed");
console.log("  " + "─".repeat(38));
for (const r of summary) {
  const label = r.owed < 0
    ? `owes $${Math.abs(r.owed).toFixed(2)}`
    : r.owed > 0
    ? `owed $${r.owed.toFixed(2)}`
    : "even";
  console.log(`  ${r.name.padEnd(24)} ${label}`);
}
