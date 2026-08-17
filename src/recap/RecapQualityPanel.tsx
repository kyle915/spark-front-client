import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RecapQualityFlagsQuery } from "@/api/queries/RecapQualityFlagsQuery";
import type { RecapQualityFlagsQuery as RecapQualityFlagsQueryType } from "@api/queries/__generated__/RecapQualityFlagsQuery.graphql";

/**
 * "Quality check" — a compact review aid for the recap approver, mounted near
 * the top of both recap detail views (<SparkRecapView> for legacy recaps and
 * <RecapCustomView> for custom recaps).
 *
 * Loads `recapQualityFlags(recapId, isCustom)` and renders the server-computed
 * `score` (0–100, color-tinted: ≥85 complete, 60–84 amber, <60 the restrained
 * orange "needs work") plus each `flag` as a small severity-tinted badge with its
 * human `label` (high → red, medium → amber, low → muted). When nothing is
 * flagged (empty `flags`, score 100) it shows a quiet "✓ Looks complete" line
 * instead of a wall of badges.
 *
 * Light recap document: dark ink on a quiet fill so the score and copy
 * stay readable on white. Lime is not used as body type.
 *
 * The backend never-raises and defaults to score 100 / no flags, so this degrades
 * quietly: a transient query failure is swallowed by a tiny local boundary and
 * the panel simply doesn't render. The caller wraps it in <Suspense> for the
 * initial load.
 */

/* ───────────────────────── palettes ───────────────────────── */

type Tint = { text: string; bg: string; border: string };

// Recaps are a white document. Lime-on-white fails contrast — use dark
// ink with a quiet fill. Complete ≠ celebration; thin/fail stay warning.
const COMPLETE: Tint = {
  text: "#3f5c12",
  bg: "rgba(63, 92, 18, 0.08)",
  border: "rgba(63, 92, 18, 0.28)",
};
const AMBER: Tint = {
  text: "#8a5a00",
  bg: "rgba(180, 120, 0, 0.12)",
  border: "rgba(138, 90, 0, 0.38)",
};
const RED: Tint = {
  text: "#9b2c14",
  bg: "rgba(239, 90, 42, 0.10)",
  border: "rgba(155, 44, 20, 0.38)",
};
const MUTED: Tint = {
  text: "#5c6154",
  bg: "rgba(20, 22, 15, 0.04)",
  border: "#e2e4d8",
};

// Score → tint. ≥85 clean (lime), 60–84 needs a look (amber), <60 rough (red).
const tintForScore = (score: number): Tint => {
  if (score >= 85) return COMPLETE;
  if (score >= 60) return AMBER;
  return RED;
};

// Severity → tint. high (red) / medium (amber) / low + unknown (muted).
const SEVERITY_TINT: Record<string, Tint> = {
  high: RED,
  medium: AMBER,
  low: MUTED,
};
const tintForSeverity = (severity: string): Tint =>
  SEVERITY_TINT[severity.toLowerCase()] ?? MUTED;

/* ───────────────────────── flag badge ───────────────────────── */

// Small severity-tinted pill — same rounded mono-ish pill the recap/dashboard
// surfaces use elsewhere, tinted from the flag's severity.
const FlagBadge: React.FC<{ label: string; severity: string }> = ({
  label,
  severity,
}) => {
  const t = tintForSeverity(severity);
  return (
    <span
      className="text-[12px] px-2.5 py-1 rounded-full inline-flex items-center"
      style={{ color: t.text, background: t.bg, border: `1px solid ${t.border}` }}
      title={`Severity: ${severity}`}
    >
      {label}
    </span>
  );
};

/* ───────────────────────── inner (loads data) ───────────────────────── */

const RecapQualityPanelInner: React.FC<{
  recapId: string;
  isCustom: boolean;
}> = ({ recapId, isCustom }) => {
  const data = useLazyLoadQuery<RecapQualityFlagsQueryType>(
    RecapQualityFlagsQuery,
    { recapId, isCustom },
    { fetchPolicy: "store-or-network" },
  );

  const result = data?.recapQualityFlags;
  const flags = useMemo(() => result?.flags ?? [], [result]);

  // Defensive: the field is non-null on the backend, but if it ever comes back
  // empty we render nothing rather than an empty frame.
  if (!result) return null;

  // Clamp to a sane 0–100 even if the backend ever sends an outlier.
  const score = Math.max(0, Math.min(100, result.score));
  const scoreTint = tintForScore(score);

  return (
    <div className="spark-card p-6" style={{ borderRadius: 18 }}>
      <div className="flex items-center gap-3 flex-wrap">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--recap-heading, #3f5c12)" }}
        >
          Quality
        </p>
        <span
          className="tab-num text-[13px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center"
          style={{
            color: scoreTint.text,
            background: scoreTint.bg,
            border: `1px solid ${scoreTint.border}`,
          }}
        >
          {score}/100
        </span>
      </div>

      {flags.length === 0 ? (
        <p
          className="text-[13px] mt-3 inline-flex items-center gap-1.5"
          style={{ color: COMPLETE.text }}
        >
          <span aria-hidden="true">✓</span> Looks complete
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          {flags.map((f, i) => (
            <FlagBadge
              key={`${f.code}-${i}`}
              label={f.label}
              severity={f.severity}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── quiet boundary ───────────────────────── */

/**
 * Swallows any render/query error from the inner panel and renders nothing.
 * The quality check is a non-essential review aid — if it can't load it should
 * disappear silently, never break or clutter the recap detail. (The backend
 * never-raises, so this is belt-and-suspenders.)
 */
class QuietBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/* ───────────────────────── public component ───────────────────────── */

const RecapQualityPanel: React.FC<{
  recapId: string;
  isCustom: boolean;
}> = ({ recapId, isCustom }) => {
  // Don't fire the quality query until the recap body has had a chance
  // to paint. Liquid Death detail was waiting on this extra round-trip
  // (and its JS) before photos appeared.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(() => setReady(true), { timeout: 1800 });
    } else {
      timeoutId = setTimeout(() => setReady(true), 350);
    }
    return () => {
      if (idleId != null) window.cancelIdleCallback(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);
  if (!ready) return null;
  return (
    <QuietBoundary>
      <RecapQualityPanelInner recapId={recapId} isCustom={isCustom} />
    </QuietBoundary>
  );
};

export default RecapQualityPanel;
