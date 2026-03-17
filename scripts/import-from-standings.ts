/**
 * Reads a standings CSV (2026 format with Season column) and injects
 * per-tournament results into the season JSON for any tournament not
 * already present.  DK points / lineups are left blank since we only
 * have league points from the spreadsheet.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' \
 *     scripts/import-from-standings.ts <year> <standings.csv>
 */

import fs from "fs";
import path from "path";
import { parse } from "papaparse";

const [, , yearArg, standingsFile] = process.argv;
if (!yearArg || !standingsFile) {
  console.error("Usage: npx ts-node ... import-from-standings.ts <year> <standings.csv>");
  process.exit(1);
}

const year = parseInt(yearArg, 10);

// ── helpers ───────────────────────────────────────────────────────────────────

interface Player { id: string; name: string; dkUsername: string | null; }

const players: Player[] = JSON.parse(
  fs.readFileSync(path.resolve("data/players.json"), "utf8")
);
const nameMap = new Map<string, Player>();
for (const p of players) nameMap.set(p.name.toLowerCase().trim(), p);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── parse standings CSV ───────────────────────────────────────────────────────

const raw = fs.readFileSync(
  path.resolve(standingsFile.replace(/^~/, process.env.HOME!)), "utf8"
);
const { data: rows } = parse<string[]>(raw, { skipEmptyLines: true });

const headers = rows[0]; // ["", "Total", "Season", "Farmers", "Waste Mgmt", ...]
// Tournament columns start at index 3 (skip blank, Total, Season)
const tournamentCols = headers
  .slice(3)
  .map((name, i) => ({ name: name.trim(), colIdx: i + 3 }))
  .filter((t) => t.name);

// ── load season JSON ──────────────────────────────────────────────────────────

const seasonPath = path.resolve(`data/seasons/${year}.json`);
const season: any = fs.existsSync(seasonPath)
  ? JSON.parse(fs.readFileSync(seasonPath, "utf8"))
  : { year, tournaments: [], standings: [], money: [] };

const existingSlugs = new Set((season.tournaments || []).map((t: any) => t.slug));

// ── build tournament entries ──────────────────────────────────────────────────

let added = 0;

for (const { name, colIdx } of tournamentCols) {
  const slug = slugify(name);
  if (existingSlugs.has(slug)) {
    console.log(`  skip  "${name}" (already imported)`);
    continue;
  }

  // Collect all players who have a score for this tournament
  const entries: { playerName: string; leaguePoints: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const pName = row[0]?.trim();
    const val = row[colIdx]?.trim();
    if (!pName || val === "" || val === undefined) continue;
    const pts = parseFloat(val);
    if (isNaN(pts)) continue;
    entries.push({ playerName: pName, leaguePoints: pts });
  }

  if (!entries.length) {
    console.log(`  skip  "${name}" (no data)`);
    continue;
  }

  // Sort by leaguePoints descending to derive rank
  entries.sort((a, b) => b.leaguePoints - a.leaguePoints);

  const results = entries.map((e, i) => {
    const player = nameMap.get(e.playerName.toLowerCase().trim());
    return {
      rank: i + 1,
      dkUsername: player?.dkUsername ?? null,
      playerId: player?.id ?? null,
      playerName: e.playerName,
      dkPoints: null,
      leaguePoints: e.leaguePoints,
      lineup: "",
    };
  });

  season.tournaments.push({ slug, name, year, entrants: results.length, results });
  existingSlugs.add(slug);
  added++;
  console.log(`  added "${name}" — ${results.length} players`);
}

// ── sort tournaments by column order (season order) ───────────────────────────

const colOrder = tournamentCols.map((t) => slugify(t.name));
season.tournaments.sort((a: any, b: any) => {
  const ai = colOrder.indexOf(a.slug);
  const bi = colOrder.indexOf(b.slug);
  // known slugs first in column order; unknowns (genesis etc.) keep relative position
  if (ai === -1 && bi === -1) return 0;
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});

fs.writeFileSync(seasonPath, JSON.stringify(season, null, 2));
console.log(`\n✓ Done — added ${added} tournament(s) to ${seasonPath}`);
