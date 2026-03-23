/**
 * Import a single DraftKings contest CSV into the current season's tournament data.
 *
 * The CSV file should be saved to contests/<year>/<slug>.csv first, then run:
 *   npm run import:contest -- <year> "<Tournament Name>" contests/<year>/<slug>.csv
 *
 * Example:
 *   npm run import:contest -- 2026 "Genesis Open" contests/2026/genesis-open.csv
 *
 * Scoring formula: score = (N-1)/2 - rank
 *   19 players: 1st=+8, 9th=0, 19th=-10
 *   18 players: 1st=+7.5, 8th=+0.5, 9th=-0.5, 18th=-9.5
 */

import fs from "fs";
import path from "path";
import { parse } from "papaparse";

const [, , yearArg, tournamentName, contestFile] = process.argv;

if (!yearArg || !tournamentName || !contestFile) {
  console.error(
    'Usage: npx ts-node scripts/import-contest.ts <year> "<tournament-name>" <contest.csv>'
  );
  process.exit(1);
}

const year = parseInt(yearArg, 10);

// ── load player roster ───────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  dkUsername: string | null;
}

const players: Player[] = JSON.parse(
  fs.readFileSync(path.resolve("data/players.json"), "utf8")
);

const usernameMap = new Map<string, Player>();
for (const p of players) {
  if (p.dkUsername) usernameMap.set(p.dkUsername.toLowerCase(), p);
}

// ── parse contest CSV ─────────────────────────────────────────────────────────

const raw = fs.readFileSync(
  path.resolve(contestFile.replace(/^~/, process.env.HOME!)),
  "utf8"
);
const { data } = parse<Record<string, string>>(raw, {
  header: true,
  skipEmptyLines: true,
});

// Only rows with a Rank (the right-side player stats rows have no rank)
const entries = data
  .filter((r) => r["Rank"] && r["EntryName"] && r["Points"])
  .map((r) => ({
    rank: parseInt(r["Rank"], 10),
    entryName: r["EntryName"].trim(),
    dkPoints: parseFloat(r["Points"]),
    lineup: r["Lineup"]?.trim() ?? "",
  }))
  .sort((a, b) => a.rank - b.rank);

const N = entries.length;

// ── build results ─────────────────────────────────────────────────────────────

const results = entries.map((entry) => {
  const player = usernameMap.get(entry.entryName.toLowerCase());
  const leaguePoints = (N - 1) / 2 - entry.rank;

  return {
    rank: entry.rank,
    dkUsername: entry.entryName,
    playerId: player?.id ?? null,
    playerName: player?.name ?? `[unknown: ${entry.entryName}]`,
    dkPoints: entry.dkPoints,
    leaguePoints: Math.round(leaguePoints * 10) / 10, // round to 1 decimal
    lineup: entry.lineup,
  };
});

// ── load/update season file ───────────────────────────────────────────────────

const seasonPath = path.resolve(`data/seasons/${year}.json`);
let season: any = { year, tournaments: [], standings: [], money: [] };

if (fs.existsSync(seasonPath)) {
  season = JSON.parse(fs.readFileSync(seasonPath, "utf8"));
}

// Build a slug from the tournament name
const slug = tournamentName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

// Remove existing entry for this tournament if re-importing
season.tournaments = (season.tournaments || []).filter(
  (t: any) => t.slug !== slug
);

// Add tournament entry
season.tournaments.push({
  slug,
  name: tournamentName,
  year,
  entrants: N,
  results,
});

// Keep tournaments sorted by insertion order (they arrive in season order)
fs.mkdirSync(path.dirname(seasonPath), { recursive: true });
fs.writeFileSync(seasonPath, JSON.stringify(season, null, 2));

console.log(`✓ Imported "${tournamentName}" (${year}) → ${seasonPath}`);
console.log(`  ${N} entrants`);

const unknown = results.filter((r) => !r.playerId);
if (unknown.length) {
  console.warn(`  ⚠ Unknown DK usernames (add to data/players.json):`);
  unknown.forEach((r) => console.warn(`    ${r.dkUsername}`));
}

results.forEach((r) => {
  const pts = r.leaguePoints > 0 ? `+${r.leaguePoints}` : `${r.leaguePoints}`;
  console.log(`  ${r.rank.toString().padStart(2)}. ${r.playerName.padEnd(22)} ${pts.padStart(5)} pts  (DK: ${r.dkPoints})`);
});
