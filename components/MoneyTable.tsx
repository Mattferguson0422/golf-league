"use client";

import { Season } from "@/lib/data";

function fmt(val: number | null): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val).toFixed(2);
  return val < 0 ? `-$${abs}` : val > 0 ? `+$${abs}` : "$0.00";
}

function MoneyCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span style={{ color: "#4b5563" }}>—</span>;
  }
  if (value < 0) return <span className="score-neg">{fmt(value)}</span>;
  if (value > 0) return <span className="score-pos">{fmt(value)}</span>;
  return <span className="score-zero">$0.00</span>;
}

export default function MoneyTable({ season }: { season: Season }) {
  const money = season.money ?? [];

  if (!money.length) {
    return (
      <div
        className="rounded-xl border p-10 text-center"
        style={{ borderColor: "#2a4a30", background: "#162b1a", color: "#6b8f6d" }}
      >
        <p className="text-lg mb-2">No money data for this season yet.</p>
        <p className="text-sm">
          Run{" "}
          <code
            className="px-2 py-0.5 rounded text-xs"
            style={{ background: "#0f2313", color: "#c9a84c" }}
          >
            npm run import:season
          </code>{" "}
          to load it.
        </p>
      </div>
    );
  }

  const sorted = [...money]
    .filter((p) => p.name && !p.name.toLowerCase().includes("total") && p.entered > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tournaments = Object.keys(money[0]?.tournaments ?? {}).filter(Boolean);

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: "#2a4a30", background: "#162b1a" }}
    >
      <div className="table-scroll">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: "#0f2313", borderBottom: "2px solid #2a4a30" }}>
              <th
                className="sticky left-0 z-10 text-left px-4 py-3 font-semibold min-w-[140px]"
                style={{ background: "#0f2313", color: "#c9a84c" }}
              >
                Player
              </th>
              <th className="text-right px-3 py-3 font-semibold" style={{ color: "#c9a84c" }}>
                Balance
              </th>
              <th className="text-right px-3 py-3 font-semibold" style={{ color: "#6b8f6d" }}>
                Paid
              </th>
              <th className="text-right px-3 py-3 font-semibold" style={{ color: "#6b8f6d" }}>
                Entered
              </th>
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
            {sorted.map((player, idx) => (
              <tr
                key={player.name}
                style={{
                  background: idx % 2 === 0 ? "#162b1a" : "#1a3320",
                  borderBottom: "1px solid #1f3d24",
                }}
              >
                <td
                  className="sticky left-0 z-10 px-4 py-2 font-medium"
                  style={{
                    background: idx % 2 === 0 ? "#162b1a" : "#1a3320",
                    color: "#e8f5ea",
                  }}
                >
                  {player.name}
                </td>
                {/* Balance — owed is net: negative means player owes commissioner */}
                <td className="px-3 py-2 text-right font-bold">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background:
                        player.owed < 0
                          ? "rgba(248,113,113,0.15)"
                          : player.owed > 0
                          ? "rgba(74,222,128,0.15)"
                          : "transparent",
                      color:
                        player.owed < 0
                          ? "#f87171"
                          : player.owed > 0
                          ? "#4ade80"
                          : "#6b7280",
                    }}
                  >
                    {player.owed < 0
                      ? `Owes $${Math.abs(player.owed).toFixed(2)}`
                      : player.owed > 0
                      ? `Owed $${player.owed.toFixed(2)}`
                      : "Even"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <MoneyCell value={player.paid} />
                </td>
                <td className="px-3 py-2 text-right" style={{ color: "#6b8f6d" }}>
                  {player.entered}
                </td>
                {tournaments.map((t) => (
                  <td key={t} className="px-2 py-2 text-right">
                    <MoneyCell value={player.tournaments[t] ?? null} />
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
