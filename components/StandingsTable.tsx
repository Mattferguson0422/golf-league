"use client";

import { Season } from "@/lib/data";
import ScoreCell from "./ScoreCell";

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank;
}

// Build unified standings from either the full standings array (historical)
// or calculated from contest results (live season)
function buildRows(season: Season) {
  const bonus = season.seasonBonus ?? 0;
  const exclusions = new Set(season.seasonBonusExclusions ?? []);

  if (season.standings && season.standings.length > 0) {
    // Historical: use pre-calculated totals (already include any season bonus)
    return season.standings
      .filter((p) => p.total !== 0 || Object.values(p.results).some((v) => v !== null))
      .sort((a, b) => b.total - a.total)
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        total: p.total,
        events: Object.values(p.results).filter((v) => v !== null).length,
        tournamentScores: p.results,
        tournaments: Object.keys(p.results),
        seasonBonus: 0, // already baked in
      }));
  }

  // Live season: aggregate from contest results + season bonus
  const playerMap = new Map<
    string,
    { id: string; name: string; total: number; events: number; scores: Record<string, number> }
  >();

  for (const t of season.tournaments ?? []) {
    for (const r of t.results) {
      const key = r.playerId ?? r.dkUsername;
      if (!playerMap.has(key)) {
        playerMap.set(key, { id: r.playerId ?? "", name: r.playerName, total: 0, events: 0, scores: {} });
      }
      const entry = playerMap.get(key)!;
      entry.total += r.leaguePoints;
      entry.events += 1;
      entry.scores[t.name] = r.leaguePoints;
    }
  }

  return Array.from(playerMap.values())
    .map((p) => {
      const playerBonus = bonus > 0 && !exclusions.has(p.id) ? bonus : 0;
      return {
        ...p,
        total: p.total + playerBonus,
        seasonBonus: playerBonus,
        tournamentScores: p.scores as Record<string, number | null>,
        tournaments: (season.tournaments ?? []).map((t) => t.name),
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((p, i) => ({ ...p, rank: i + 1, events: p.events }));
}

export default function StandingsTable({ season }: { season: Season }) {
  const rows = buildRows(season);
  const showBonusCol = (season.seasonBonus ?? 0) > 0 && !season.standings?.length;
  const tournaments = season.standings?.length
    ? Object.keys(season.standings[0]?.results ?? {})
    : (season.tournaments ?? []).map((t) => t.name);

  if (!rows.length) {
    return (
      <div className="text-center py-16" style={{ color: "#6b8f6d" }}>
        No standings data yet for this season.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: "#2a4a30", background: "#162b1a" }}
    >
      <div className="table-scroll">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#0f2313", borderBottom: "2px solid #2a4a30" }}>
              <th className="sticky left-0 z-10 text-left px-3 py-3 font-semibold w-8"
                style={{ background: "#0f2313", color: "#c9a84c" }}>#</th>
              <th className="sticky left-8 z-10 text-left px-3 py-3 font-semibold min-w-[140px]"
                style={{ background: "#0f2313", color: "#c9a84c" }}>Player</th>
              <th className="text-right px-3 py-3 font-semibold" style={{ color: "#c9a84c" }}>Total</th>
              <th className="text-right px-3 py-3 font-semibold" style={{ color: "#6b8f6d" }}>Evts</th>
              {showBonusCol && (
                <th className="text-right px-3 py-3 font-semibold" style={{ color: "#6b8f6d" }} title="Season entry bonus">Season</th>
              )}
              {tournaments.map((t) => (
                <th
                  key={t}
                  className="text-right px-2 py-3 font-medium whitespace-nowrap"
                  style={{ color: "#6b8f6d", minWidth: "72px" }}
                  title={t}
                >
                  {t.length > 10 ? t.split(" ").map((w) => w[0]).join("") : t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.name}
                style={{
                  background: idx % 2 === 0 ? "#162b1a" : "#1a3320",
                  borderBottom: "1px solid #1f3d24",
                }}
                className="hover:brightness-110 transition-all"
              >
                <td className="sticky left-0 z-10 px-3 py-2 text-center font-bold"
                  style={{ background: idx % 2 === 0 ? "#162b1a" : "#1a3320", color: "#6b8f6d" }}>
                  {medal(row.rank)}
                </td>
                <td className="sticky left-8 z-10 px-3 py-2 font-medium"
                  style={{ background: idx % 2 === 0 ? "#162b1a" : "#1a3320", color: "#e8f5ea" }}>
                  {row.name}
                </td>
                <td className="text-right px-3 py-2 font-bold">
                  <ScoreCell value={row.total} />
                </td>
                <td className="text-right px-3 py-2" style={{ color: "#6b8f6d" }}>
                  {row.events}
                </td>
                {showBonusCol && (
                  <td className="text-right px-3 py-2" style={{ color: "#c9a84c" }}>
                    {row.seasonBonus > 0 ? `+${row.seasonBonus}` : "—"}
                  </td>
                )}
                {tournaments.map((t) => (
                  <td key={t} className="text-right px-2 py-2">
                    <ScoreCell value={row.tournamentScores[t] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
