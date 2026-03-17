import { getAvailableYears, getSeason } from "@/lib/data";
import YearSelector from "@/components/YearSelector";
import TournamentList from "@/components/TournamentList";
import { Suspense } from "react";

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; t?: string }>;
}) {
  const { year: yearParam, t: tournSlug } = await searchParams;
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

  const hasTournaments = season.tournaments && season.tournaments.length > 0;
  const activeTournament =
    tournSlug && hasTournaments
      ? season.tournaments.find((t) => t.slug === tournSlug) ?? season.tournaments[season.tournaments.length - 1]
      : hasTournaments
      ? season.tournaments[season.tournaments.length - 1]
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#c9a84c" }}>
            Tournament Results
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b8f6d" }}>
            {year} · {season.tournaments?.length ?? 0} contests imported
          </p>
        </div>
        <Suspense>
          <YearSelector years={years} current={year} />
        </Suspense>
      </div>

      {!hasTournaments ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "#2a4a30", background: "#162b1a", color: "#6b8f6d" }}
        >
          <p className="text-lg mb-2">No contest data for {year}.</p>
          <p className="text-sm">
            Run{" "}
            <code
              className="px-2 py-0.5 rounded text-xs"
              style={{ background: "#0f2313", color: "#c9a84c" }}
            >
              npm run import:contest -- {year} &quot;Tournament Name&quot; ~/Downloads/contest.csv
            </code>{" "}
            to add results.
          </p>
        </div>
      ) : (
        <TournamentList
          tournaments={season.tournaments}
          activeTournament={activeTournament}
          year={year}
        />
      )}
    </div>
  );
}
