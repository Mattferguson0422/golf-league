"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tournament } from "@/lib/data";
import ScoreCell from "./ScoreCell";

function EntryFeeTag({ entryFee }: { entryFee: number }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: entryFee === 10 ? "#7c3a0a" : "#1a3320",
        color: entryFee === 10 ? "#fbbf24" : "#6b8f6d",
      }}
    >
      ${entryFee} entry
    </span>
  );
}

const MAJORS = ["players", "masters", "pga-championship", "us-open", "british-open"];

export default function TournamentList({
  tournaments,
  activeTournament,
  year,
}: {
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  year: number;
}) {
  const params = useSearchParams();

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Sidebar: list of tournaments */}
      <div
        className="lg:w-56 shrink-0 rounded-xl border overflow-hidden"
        style={{ borderColor: "#2a4a30", background: "#162b1a" }}
      >
        <div
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "#6b8f6d", borderBottom: "1px solid #2a4a30" }}
        >
          {year} Contests
        </div>
        {[...tournaments].reverse().map((t) => {
          const active = activeTournament?.slug === t.slug;
          const next = new URLSearchParams(params.toString());
          next.set("t", t.slug);
          return (
            <Link
              key={t.slug}
              href={`/tournaments?${next.toString()}`}
              className="flex items-center justify-between px-4 py-2 text-sm transition-colors"
              style={{
                background: active ? "#2d7a32" : "transparent",
                color: active ? "#e8f5ea" : "#9dc49e",
                borderBottom: "1px solid #1f3d24",
              }}
            >
              <span>{t.name}</span>
              <span style={{ color: active ? "#dcf0dd" : "#4b5563", fontSize: "0.7rem" }}>
                {t.entrants}p
              </span>
            </Link>
          );
        })}
      </div>

      {/* Main panel: results */}
      {activeTournament && (
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "#2a4a30", background: "#162b1a" }}
          >
            {/* Tournament header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #2a4a30", background: "#0f2313" }}
            >
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#c9a84c" }}>
                  {activeTournament.name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#6b8f6d" }}>
                  {activeTournament.entrants} entrants · {year}
                </p>
              </div>
              <EntryFeeTag entryFee={MAJORS.includes(activeTournament.slug) ? 10 : 2} />
            </div>

            {/* Results table */}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid #2a4a30" }}>
                  <th className="text-left px-4 py-2 font-semibold w-10" style={{ color: "#c9a84c" }}>#</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: "#c9a84c" }}>Player</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: "#c9a84c" }}>Pts</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: "#6b8f6d" }}>DK Score</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell" style={{ color: "#6b8f6d" }}>Lineup</th>
                </tr>
              </thead>
              <tbody>
                {activeTournament.results.map((r, idx) => (
                  <tr
                    key={r.dkUsername}
                    style={{
                      background: idx % 2 === 0 ? "#162b1a" : "#1a3320",
                      borderBottom: "1px solid #1f3d24",
                    }}
                  >
                    <td className="px-4 py-2 font-bold" style={{ color: "#6b8f6d" }}>
                      {r.rank}
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: r.playerId ? "#e8f5ea" : "#9ca3af" }}>
                      {r.playerName}
                      {!r.playerId && (
                        <span className="ml-1 text-xs" style={{ color: "#6b7280" }}>
                          (unmapped)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ScoreCell value={r.leaguePoints} />
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "#6b8f6d" }}>
                      {r.dkPoints}
                    </td>
                    <td className="px-3 py-2 text-left hidden md:table-cell" style={{ color: "#4b5563", fontSize: "0.7rem" }}>
                      {r.lineup}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
