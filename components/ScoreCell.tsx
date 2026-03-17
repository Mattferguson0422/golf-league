export default function ScoreCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span style={{ color: "#4b5563" }}>—</span>;
  }
  const cls = value > 0 ? "score-pos" : value < 0 ? "score-neg" : "score-zero";
  const label = value > 0 ? `+${value}` : `${value}`;
  return <span className={cls}>{label}</span>;
}
