import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RecapReviewChecksQuery } from "@/api/queries/RecapReviewChecksQuery";
import type { RecapReviewChecksQuery as RecapReviewChecksQueryType } from "@api/queries/__generated__/RecapReviewChecksQuery.graphql";
import { RecapFlagExplanationQuery } from "@/api/queries/RecapFlagExplanationQuery";
import type { RecapFlagExplanationQuery as RecapFlagExplanationQueryType } from "@api/queries/__generated__/RecapFlagExplanationQuery.graphql";
import { recapConversionChip, type RecapKpiRow } from "@/shared/sparkStat";
import {
  flagExplanationLine,
  isBaSubmitCheck,
  reviewCheckCounts,
  reviewCheckTint,
  visibleReviewChecks,
  withoutStaffOnlyChecks,
  type ReviewCheckStatus,
} from "./reviewCheckDisplay";
import { useSparkRole } from "@/hooks/useSparkRole";

/**
 * Rule-based review checks beside Approve (roadmap #3). Compact chips on
 * dark ops chrome: flags (orange) first, then passes (lime); `na` checks
 * are hidden, so GPS simply doesn't appear when no coordinates exist.
 * Advisory only — approving stays a human click.
 */

/**
 * One plain line above the checks: why the recap was flagged and what to
 * look at first. Loaded on its own, so a slow or failed load never holds up
 * the checks; when there is no line it renders nothing and the list of
 * checks reads exactly as before.
 */
const WhyFlagged: React.FC<{ recapId: string; isCustom: boolean }> = ({
  recapId,
  isCustom,
}) => {
  const data = useLazyLoadQuery<RecapFlagExplanationQueryType>(
    RecapFlagExplanationQuery,
    { recapId, isCustom },
    { fetchPolicy: "store-or-network" },
  );
  const line = flagExplanationLine(data?.recapFlagExplanation);
  if (!line) return null;
  return (
    <p
      className="text-[13px] mt-2"
      style={{ color: "var(--spark-text)", maxWidth: "62ch" }}
    >
      {line}
    </p>
  );
};

const Inner: React.FC<{
  recapId: string;
  isCustom: boolean;
  conversion: RecapKpiRow;
}> = ({ recapId, isCustom, conversion }) => {
  const data = useLazyLoadQuery<RecapReviewChecksQueryType>(
    RecapReviewChecksQuery,
    { recapId, isCustom },
    { fetchPolicy: "store-or-network" },
  );
  // "Asked at submit" is Ignite staff only: never in Client mode, even
  // for staff previewing it (the server already omits it for brand users).
  const { isAdmin, canToggleRole } = useSparkRole();
  const isStaff = isAdmin && canToggleRole;
  const checks = useMemo(
    () => withoutStaffOnlyChecks(data?.recapReviewChecks, isStaff),
    [data, isStaff],
  );
  const allVisible = useMemo(() => visibleReviewChecks(checks), [checks]);
  // What the check-in asked the ambassador at submit gets its own block:
  // each line already says whether they confirmed it.
  const visible = useMemo(
    () => allVisible.filter((c) => !isBaSubmitCheck(c.code)),
    [allVisible],
  );
  const askedAtSubmit = useMemo(
    () => allVisible.filter((c) => isBaSubmitCheck(c.code)),
    [allVisible],
  );
  const counts = useMemo(() => reviewCheckCounts(checks), [checks]);
  const conv = recapConversionChip(conversion);
  const convTint = reviewCheckTint(conv.status);
  const flagged = counts.flagged + (conv.status === "flag" ? 1 : 0);
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: "var(--spark-bg)", border: "1px solid var(--spark-border)" }}
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
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {flagged > 0
            ? `${flagged} to look at · advisory only`
            : "Nothing flagged · advisory only"}
        </span>
      </div>
      <QuietBoundary>
        <Suspense fallback={null}>
          <WhyFlagged recapId={recapId} isCustom={isCustom} />
        </Suspense>
      </QuietBoundary>
      <div className="flex flex-wrap gap-2 mt-2">
        <span
          className="text-[12px] px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
          style={{
            color: convTint.color,
            background: convTint.background,
            border: `1px solid ${convTint.border}`,
          }}
        >
          <span aria-hidden="true">{convTint.mark}</span>
          {conv.label}
        </span>
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
      {askedAtSubmit.length > 0 ? (
        <div
          className="mt-3 rounded-xl px-3 py-2"
          style={{ border: "1px solid var(--spark-border)" }}
          aria-label="Asked at submit"
        >
          <p
            className="text-[12px] font-semibold"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Asked at submit
          </p>
          <ul className="mt-1 space-y-1.5">
            {askedAtSubmit.map((c) => (
              <li key={c.code}>
                <p className="text-[13px]" style={{ color: "var(--spark-text)" }}>
                  {c.label}
                </p>
                {c.detail ? (
                  <p
                    className="text-[12px]"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    {c.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {visible.some((c) => c.detail) ? (
        <div className="mt-2 space-y-0.5">
          {visible
            .filter((c) => c.detail)
            .map((c) => (
              <p
                key={`${c.code}-detail`}
                className="text-[11px]"
                style={{ color: "var(--spark-text-meta)" }}
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

const RecapReviewChecks: React.FC<{
  recapId: string;
  isCustom: boolean;
  conversion: RecapKpiRow;
}> = ({ recapId, isCustom, conversion }) => {
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
      <Inner recapId={recapId} isCustom={isCustom} conversion={conversion} />
    </QuietBoundary>
  );
};

export default RecapReviewChecks;
