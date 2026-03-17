/**
 * Import a season's standings + money CSVs into JSON.
 * Usage: npx ts-node scripts/import-season.ts <year> <standings.csv> <money.csv>
 *
 * Example:
 *   npx ts-node scripts/import-season.ts 2025 ~/Downloads/2025Standings.csv ~/Downloads/2025Money.csv
 */

import fs from "fs";
import path from "path";
import { parse } from "papaparse";

const [, , yearArg, standingsFile, moneyFile] = process.argv;

if (!yearArg || !standingsFile || !moneyFile) {
  console.error(
    "Usage: npx ts-node scripts/import-season.ts <year> <standings.csv> <money.csv>"
  );
  process.exit(1);
}

const year = parseInt(yearArg, 10);

// ── helpers ──────────────────────────────────────────────────────────────────

function readCsv(filePath: string): string[][] {
  const raw = fs.readFileSync(path.resolve(filePath.replace(/^~/, process.env.HOME!)), "utf8");
  const result = parse<string[]>(raw, { skipEmptyLines: true });
  return result.data;
}

function parseMoney(val: string): number {
  if (!val || val.trim() === "") return 0;
  const cleaned = val.replace(/[$, ()]/g, "").trim();
  const num = parseFloat(cleaned);
  // parentheses = negative in accounting notation
  return val.includes("(") ? -Math.abs(num) : num;
}

// ── standings ─────────────────────────────────────────────────────────────────

const sRows = readCsv(standingsFile);
const sHeaders = sRows[0]; // ["", "Total", "Farmers", "ATT Pro Am", ...]
const tournamentNames = sHeaders.slice(2); // skip blank + "Total"

interface PlayerStanding {
  name: string;
  total: number;
  results: Record<string, number | null>;
}

const standings: PlayerStanding[] = [];

for (let i = 1; i < sRows.length; i++) {
  const row = sRows[i];
  const name = row[0]?.trim();
  if (!name) continue;

  const total = parseFloat(row[1]) || 0;
  const results: Record<string, number | null> = {};
  for (let j = 2; j < sHeaders.length; j++) {
    const tName = sHeaders[j]?.trim();
    if (!tName) continue;
    const val = row[j]?.trim();
    results[tName] = val !== "" && val !== undefined ? parseFloat(val) : null;
  }
  standings.push({ name, total, results });
}

// ── money ─────────────────────────────────────────────────────────────────────

const mRows = readCsv(moneyFile);
const mHeaders = mRows[0]; // ["Player","Entered","Owed","Paid","Yearly Entry", ...]

interface PlayerMoney {
  name: string;
  entered: number;
  owed: number;
  paid: number;
  yearlyEntry: number;
  tournaments: Record<string, number | null>;
  overall: number;
}

const money: PlayerMoney[] = [];
const mTournamentNames = mHeaders.slice(4, mHeaders.length - 1); // skip first 4 + last "Overall"

for (let i = 1; i < mRows.length; i++) {
  const row = mRows[i];
  const name = row[0]?.trim();
  if (!name || name.toLowerCase().includes("total")) continue;

  const entered = parseInt(row[1]) || 0;
  const owed = parseMoney(row[2]);
  const paid = parseMoney(row[3]);
  const yearlyEntry = parseMoney(row[4]);

  const tournaments: Record<string, number | null> = {};
  for (let j = 4; j < mHeaders.length - 1; j++) {
    const tName = mHeaders[j]?.trim();
    if (!tName) continue;
    const val = row[j]?.trim();
    tournaments[tName] = val !== "" && val !== undefined ? parseMoney(val) : null;
  }

  const overall = parseMoney(row[mHeaders.length - 1]);
  money.push({ name, entered, owed, paid, yearlyEntry, tournaments, overall });
}

// ── write output ──────────────────────────────────────────────────────────────

const output = {
  year,
  tournaments: tournamentNames.filter(Boolean),
  standings,
  money,
};

const outPath = path.resolve(`data/seasons/${year}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✓ Wrote ${outPath}`);
console.log(`  ${standings.length} players, ${tournamentNames.length} tournaments`);
