import { getAvailableYears, getSeason } from "@/lib/data";
import StandingsTable from "@/components/StandingsTable";
import YearSelector from "@/components/YearSelector";
import { Suspense } from "react";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const years = getAvailableYears();
  const year = yearParam ? parseInt(yearParam, 10) : years[0];
  const season = getSeason(year);

  if (!season) {
    return (
      <div className="text-center py-20" style={{ color: "#9dc49e" }}>
        No data found for {year}.
      </div>
    );
  }

  const hasFullStandings = season.standings && season.standings.length > 0;
  const playerCount = hasFullStandings
    ? season.standings.length
    : new Set(season.tournaments?.flatMap((t) => t.results.map((r) => r.playerId)).filter(Boolean)).size;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#c9a84c" }}>
            {year} Standings
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b8f6d" }}>
            {playerCount} players · {season.tournaments?.length ?? 0} tournament{season.tournaments?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Suspense>
          <YearSelector years={years} current={year} />
        </Suspense>
      </div>

      <StandingsTable season={season} />
    </div>
  );
}
