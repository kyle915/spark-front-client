import type { SparkStatItem, SparkStatTone } from "./sparkStat";
import { CountReel } from "@/motion/CountReel";

const toneClass = (tone?: SparkStatTone) =>
  tone === "lime" ? " is-lime" : tone === "orange" ? " is-orange" : "";

export function SparkStat({
  value,
  label,
  tone = "default",
  size = "md",
  count,
}: {
  value: string;
  label: string;
  tone?: SparkStatTone;
  size?: "sm" | "md";
  count?: number;
}) {
  return (
    <div className={`spark-stat spark-stat-${size}`}>
      <p className={`spark-stat-value${toneClass(tone)}`}>
        {typeof count === "number" ? <CountReel value={count} /> : value}
      </p>
      <p className="spark-stat-label">{label}</p>
    </div>
  );
}

export function SparkBentoTile({
  value,
  label,
  hint,
  tone = "default",
  count,
}: SparkStatItem) {
  return (
    <div className="spark-bento-tile">
      <p className="spark-stat-label">{label}</p>
      <p className={`spark-stat-value spark-stat-lg${toneClass(tone)}`}>
        {typeof count === "number" ? <CountReel value={count} /> : value}
      </p>
      {hint ? <p className="spark-stat-hint">{hint}</p> : null}
    </div>
  );
}
