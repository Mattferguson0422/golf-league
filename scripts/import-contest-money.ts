/**
 * Apply a single contest's payouts directly to the season's money ledger.
 *
 * Unlike import-money.ts (which rebuilds the whole ledger from a master money
 * CSV), this fills in ONE tournament column in place, using the contest results
 * already imported into the season JSON by import-contest.ts. No external CSV.
 *
 * Net math matches import-money: a casher nets (grossPrize - entryFee); any
 * other entrant nets -entryFee; players who didn't enter stay null.
 *
 * Idempotent: re-running with the same args reproduces the same ledger (entered
 * is only bumped the first time a player gets a value in this column; owed is
 * always recomputed as yearlyEntry + sum(columns)).
 *
 * Usage:
 *   npm run import:contest-money -- <year> <contest-slug> "<Money Column>" <gross1> [gross2 ...]
 *
 * Example (12 entrants, $24 pool, top-3 paid 13/7/4):
 *   npm run import:contest-money -- 2026 rbc-canadian-open "RBC Canadian Open" 13 7 4
 */

import fs from "fs";
import path from "path";

const [, , yearArg, slug, columnName, ...prizeArgs] = process.argv;

if (!yearArg || !slug || !columnName || prizeArgs.length === 0) {
  console.error(
    'Usage: npm run import:contest-money -- <year> <contest-slug> "<Money Column>" <gross1> [gross2 ...]'
  );
  process.exit(1);
}

const year = parseInt(yearArg, 10);
const grossPrizes = prizeArgs.map((p) => parseFloat(p));
if (grossPrizes.some((n) => isNaN(n))) {
  console.error("Gross prizes must be numbers.");
  process.exit(1);
}

// ── load config (entry-fee tier) ───────────────────────────────────────────────

interface Config {
  scoring: { standardEntryFee: number; majorEntryFee: number; majors: string[] };
}
const config: Config = JSON.parse(
  fs.readFileSync(path.resolve("data/config.json"), "utf8")
);
const isMajor = config.scoring.majors.some((m) => slug === m || slug.includes(m));
const entryFee = isMajor ? config.scoring.majorEntryFee : config.scoring.standardEntryFee;

// ── load season JSON ────────────────────────────────────────────────────────────

const seasonPath = path.resolve(`data/seasons/${year}.json`);
if (!fs.existsSync(seasonPath)) {
  console.error(`Season file not found: ${seasonPath}`);
  process.exit(1);
}
const season: any = JSON.parse(fs.readFileSync(seasonPath, "utf8"));

const tournament = (season.tournaments ?? []).find((t: any) => t.slug === slug);
if (!tournament) {
  console.error(
    `No tournament with slug "${slug}" in ${year}. Run import:contest first.`
  );
  process.exit(1);
}
const results: any[] = tournament.results ?? [];
const money: any[] = season.money ?? [];
if (!money.length) {
  console.error("Season has no money ledger to update.");
  process.exit(1);
}

// ── net payout per finishing rank ───────────────────────────────────────────────

function netForRank(rank: number): number {
  const gross = rank <= grossPrizes.length ? grossPrizes[rank - 1] : 0;
  return gross > 0 ? gross - entryFee : -entryFee;
}

// name (lowercased) → net, for everyone who entered this contest
const netByName = new Map<string, number>();
for (const r of results) {
  if (!r.playerName || r.playerName.startsWith("[unknown")) {
    console.warn(`  ⚠ Skipping unmapped entry: ${r.dkUsername}`);
    continue;
  }
  netByName.set(r.playerName.toLowerCase().trim(), netForRank(r.rank));
}

// ── determine where the new column goes (chronological order) ──────────────────
// If the column already exists, fill it in place. Otherwise insert it right after
// the last column that any player has a non-null value for (i.e. last played week).

const order: string[] = Object.keys(money[0].tournaments ?? {});
const alreadyExists = order.includes(columnName);
let insertAfterIdx = -1;
if (!alreadyExists) {
  order.forEach((col, i) => {
    if (money.some((p) => p.tournaments[col] !== null && p.tournaments[col] !== undefined)) {
      insertAfterIdx = i;
    }
  });
}

function withColumn(tournaments: Record<string, number | null>, value: number | null) {
  if (alreadyExists) {
    return { ...tournaments, [columnName]: value };
  }
  const rebuilt: Record<string, number | null> = {};
  Object.keys(tournaments).forEach((col, i) => {
    rebuilt[col] = tournaments[col];
    if (i === insertAfterIdx) rebuilt[columnName] = value;
  });
  if (insertAfterIdx === -1) rebuilt[columnName] = value; // empty ledger / no prior weeks
  return rebuilt;
}

// ── apply to each money record ──────────────────────────────────────────────────

let cashers = 0;
for (const p of money) {
  const net = netByName.get(p.name.toLowerCase().trim());
  const entered = net !== undefined;
  const hadValue = p.tournaments[columnName] !== null && p.tournaments[columnName] !== undefined;

  p.tournaments = withColumn(p.tournaments, entered ? net! : null);

  if (entered && !hadValue) p.entered = (p.entered || 0) + 1; // idempotent bump
  if (entered && net! > 0) cashers++;

  // owed is always yearlyEntry + sum(all non-null tournament columns)
  const sum = Object.values(p.tournaments).reduce(
    (acc: number, v) => acc + ((v as number | null) ?? 0),
    0
  );
  p.owed = (p.yearlyEntry || 0) + (sum as number);
}

fs.writeFileSync(seasonPath, JSON.stringify(season, null, 2));

// ── summary ─────────────────────────────────────────────────────────────────────

const pool = results.length * entryFee;
const payoutSum = grossPrizes.reduce((a, b) => a + b, 0);
console.log(`\n✓ Applied "${columnName}" payouts to ${year} money ledger`);
console.log(
  `  ${results.length} entrants · $${entryFee} entry · $${pool} pool · paid top ${grossPrizes.length} (${grossPrizes.map((g) => `$${g}`).join(" / ")})`
);
if (payoutSum !== pool) {
  console.warn(`  ⚠ Gross payouts ($${payoutSum}) ≠ pool ($${pool}). Double-check the split.`);
}
console.log("");
[...results]
  .sort((a, b) => a.rank - b.rank)
  .forEach((r) => {
    const net = netForRank(r.rank);
    const label = net > 0 ? `+$${net}` : `-$${Math.abs(net)}`;
    const cash = net > 0 ? "  💰" : "";
    console.log(`  ${String(r.rank).padStart(2)}. ${r.playerName.padEnd(20)} ${label}${cash}`);
  });
