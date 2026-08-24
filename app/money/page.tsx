import { getAvailableYears, getSeason, getConfig } from "@/lib/data";
import MoneyTable from "@/components/MoneyTable";
import YearSelector from "@/components/YearSelector";
import { Suspense } from "react";

/** Digits-only phone (or an email) is what Zelle calls the recipient "token". */
function zelleQrUrl(name: string, token: string) {
  const payload = {
    name: name.toUpperCase(),
    token: token.includes("@") ? token : token.replace(/\D/g, ""),
    action: "payment",
  };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(data)}`;
}

/** 8129873737 -> (812) 987-3737; anything else passes through untouched. */
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const years = getAvailableYears();
  const year = yearParam ? parseInt(yearParam, 10) : years[0];
  const season = getSeason(year);
  const config = getConfig();

  if (!season) {
    return (
      <div className="text-center py-20" style={{ color: "#9dc49e" }}>
        No data found for {year}.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#c9a84c" }}>
            Money Tracker
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b8f6d" }}>
            {year} · Pay commissioner: {config.commissioner.name}
          </p>
        </div>
        <Suspense>
          <YearSelector years={years} current={year} />
        </Suspense>
      </div>

      {/* Payment methods banner */}
      <div
        className="rounded-xl border p-4 mb-6 flex flex-wrap gap-3 items-center"
        style={{ borderColor: "#2a4a30", background: "#162b1a" }}
      >
        <span className="text-sm font-medium" style={{ color: "#9dc49e" }}>
          Pay {config.commissioner.name}:
        </span>
        {config.commissioner.venmo ? (
          <a
            href={`https://venmo.com/${config.commissioner.venmo.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#008CFF", color: "#fff" }}
          >
            Venmo · @{config.commissioner.venmo.replace(/^@/, "")}
          </a>
        ) : (
          <span
            className="px-3 py-1 rounded-full text-sm font-semibold opacity-40 cursor-not-allowed"
            style={{ background: "#008CFF", color: "#fff" }}
            title="Venmo not configured yet"
          >
            Venmo
          </span>
        )}
        {config.commissioner.paypal ? (
          <a
            href={config.commissioner.paypal}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#003087", color: "#fff" }}
          >
            PayPal · {config.commissioner.paypal.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span
            className="px-3 py-1 rounded-full text-sm font-semibold opacity-40 cursor-not-allowed"
            style={{ background: "#003087", color: "#fff" }}
            title="PayPal not configured yet"
          >
            PayPal
          </span>
        )}
        {config.commissioner.zelle ? (
          <a
            href={zelleQrUrl(
              config.commissioner.name,
              config.commissioner.zelle,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#6D1ED4", color: "#fff" }}
            title="Or send to this number from your bank's Zelle screen"
          >
            Zelle · {formatPhone(config.commissioner.zelle)}
          </a>
        ) : (
          <span
            className="px-3 py-1 rounded-full text-sm font-semibold opacity-40 cursor-not-allowed"
            style={{ background: "#6D1ED4", color: "#fff" }}
            title="Zelle not configured yet"
          >
            Zelle
          </span>
        )}
        <span
          className="px-3 py-1 rounded-full text-sm font-semibold"
          style={{ background: "#374151", color: "#d1fae5" }}
        >
          💵 Cash — {config.commissioner.cashNote}
        </span>
      </div>

      <MoneyTable season={season} />
    </div>
  );
}
