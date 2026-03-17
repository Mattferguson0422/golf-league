"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function YearSelector({ years, current }: { years: number[]; current: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    next.set("year", e.target.value);
    router.push(`?${next.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="rounded px-3 py-1 text-sm font-medium border"
      style={{
        background: "#162b1a",
        color: "#e8f5ea",
        borderColor: "#2a4a30",
      }}
    >
      {years.map((y) => (
        <option key={y} value={y}>{y} Season</option>
      ))}
    </select>
  );
}
