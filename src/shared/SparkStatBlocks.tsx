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
  delta,
  deltaAttention,
}: SparkStatItem) {
  return (
    <div className="spark-bento-tile">
      <p className="spark-stat-label">{label}</p>
      <p className={`spark-stat-value spark-stat-lg${toneClass(tone)}`}>
        {typeof count === "number" ? <CountReel value={count} /> : value}
      </p>
      {delta ? (
        <p
          className={`spark-kpi-delta${deltaAttention ? " is-attention" : ""}`}
        >
          {delta}
        </p>
      ) : null}
      {hint ? <p className="spark-stat-hint">{hint}</p> : null}
    </div>
  );
}

export function SparkKpiLockup({
  label,
  value,
  count,
  hint,
  tone = "default",
  delta,
  deltaAttention,
  size = "md",
}: SparkStatItem & { size?: "sm" | "md" | "lg" }) {
  const valueCls =
    size === "lg"
      ? "spark-kpi-value spark-kpi-value-lg"
      : size === "sm"
        ? "spark-kpi-value spark-kpi-value-sm"
        : "spark-kpi-value";
  return (
    <div className="spark-kpi-lockup">
      <p className="spark-kpi-label">{label}</p>
      <p className={`${valueCls}${toneClass(tone)}`}>
        {typeof count === "number" ? <CountReel value={count} /> : value}
      </p>
      {delta ? (
        <p
          className={`spark-kpi-delta${deltaAttention ? " is-attention" : ""}`}
        >
          {delta}
        </p>
      ) : null}
      {hint ? <p className="spark-stat-hint">{hint}</p> : null}
    </div>
  );
}
