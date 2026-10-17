import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RecapReviewChecksQuery } from "@/api/queries/RecapReviewChecksQuery";
import type { RecapReviewChecksQuery as RecapReviewChecksQueryType } from "@api/queries/__generated__/RecapReviewChecksQuery.graphql";
import {
  reviewCheckCounts,
  reviewCheckTint,
  visibleReviewChecks,
  type ReviewCheckStatus,
} from "./reviewCheckDisplay";

/**
 * Rule-based review checks beside Approve (roadmap #3). Compact chips on
 * dark ops chrome: flags (orange) first, then passes (lime); `na` checks
 * are hidden, so GPS simply doesn't appear when no coordinates exist.
 * Advisory only — approving stays a human click.
 */

const Inner: React.FC<{ recapId: string; isCustom: boolean }> = ({
  recapId,
  isCustom,
}) => {
  const data = useLazyLoadQuery<RecapReviewChecksQueryType>(
    RecapReviewChecksQuery,
    { recapId, isCustom },
    { fetchPolicy: "store-or-network" },
  );
  const visible = useMemo(
    () => visibleReviewChecks(data?.recapReviewChecks),
    [data],
  );
  const counts = useMemo(
    () => reviewCheckCounts(data?.recapReviewChecks),
    [data],
  );
  if (visible.length === 0) return null;
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: "#0A0B0D", border: "1px solid var(--spark-border)" }}
      aria-label="Review checks"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{ letterSpacing: "0.14em", color: "var(--spark-lime)" }}
        >
          REVIEW CHECKS
        </span>
        <span
          className="text-[12px]"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {counts.flagged > 0
            ? `${counts.flagged} to look at · advisory only`
            : "Nothing flagged · advisory only"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {visible.map((check) => {
          const status: ReviewCheckStatus = check.flagged ? "flag" : "pass";
          const tint = reviewCheckTint(status);
          return (
            <span
              key={check.code}
              className="text-[12px] px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
              style={{
                color: tint.color,
                background: tint.background,
                border: `1px solid ${tint.border}`,
              }}
              title={check.detail || check.label}
            >
              <span aria-hidden="true">{tint.mark}</span>
              {check.label}
            </span>
          );
        })}
      </div>
      {visible.some((c) => c.detail) ? (
        <div className="mt-2 space-y-0.5">
          {visible
            .filter((c) => c.detail)
            .map((c) => (
              <p
                key={`${c.code}-detail`}
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {c.detail}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
};

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

const RecapReviewChecks: React.FC<{ recapId: string; isCustom: boolean }> = ({
  recapId,
  isCustom,
}) => {
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
      <Inner recapId={recapId} isCustom={isCustom} />
    </QuietBoundary>
  );
};

export default RecapReviewChecks;
