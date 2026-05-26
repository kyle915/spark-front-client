import { useState } from "react";
import { useMutation } from "react-relay/hooks";

import { RateAmbassadorMutation } from "@/api/mutations/RateAmbassadorMutation";
import type { RateAmbassadorMutation as RateAmbassadorMutationType } from "@/api/mutations/__generated__/RateAmbassadorMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

const STAR = "★";
const GOLD = "#f5b301";
const MUTED = "rgba(140,140,150,0.45)";

/**
 * Read-only star meter. Shows a 0-5 average (rounded to the nearest half
 * isn't worth it here — we render filled stars up to Math.round(value)).
 * Used to display a BA's overall rating next to the editable control.
 */
export const StarMeter: React.FC<{
  value: number;
  count?: number | null;
  size?: number;
  className?: string;
}> = ({ value, count, size = 16, className }) => {
  const filled = Math.round(value || 0);
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
      title={`${(value || 0).toFixed(1)} / 5${count != null ? ` · ${count} rating${count === 1 ? "" : "s"}` : ""}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{ fontSize: size, lineHeight: 1, color: n <= filled ? GOLD : MUTED }}
        >
          {STAR}
        </span>
      ))}
      {count != null && (
        <span style={{ marginLeft: 6, fontSize: size - 4, opacity: 0.65 }}>
          {value > 0 ? value.toFixed(1) : "—"}
          {count > 0 ? ` (${count})` : ""}
        </span>
      )}
    </span>
  );
};

type Props = {
  /** Relay global ID of the ambassador being rated. */
  ambassadorId: string;
  /** Gig the rating is about. Null/omitted = general profile rating. */
  eventId?: string | null;
  /** For the success toast + aria labels. */
  ambassadorName?: string | null;
  /** Pre-fill the stars (e.g. this rater's prior score). Defaults to unrated. */
  initialScore?: number | null;
  /**
   * Dense mode for roster rows: stars only, clicking a star saves
   * immediately (no comment box, no separate Save button).
   */
  compact?: boolean;
  /** Fired after a successful save with the recomputed caller-visible aggregate. */
  onRated?: (average: number, count: number) => void;
  className?: string;
};

/**
 * Star-rating control usable by both Ignite admins and clients. Posts to
 * `rateAmbassador`; the server derives whether the rating is client-authored
 * and recomputes the BA's average. Re-rating the same (ambassador, gig)
 * overwrites the prior score rather than stacking.
 */
export const RateBaControl: React.FC<Props> = ({
  ambassadorId,
  eventId = null,
  ambassadorName,
  initialScore = null,
  compact = false,
  onRated,
  className,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, inFlight] = useMutation<RateAmbassadorMutationType>(
    RateAmbassadorMutation,
  );
  const [score, setScore] = useState<number>(
    initialScore && initialScore > 0 ? Math.round(initialScore) : 0,
  );
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  const submit = (value: number) => {
    if (inFlight || value < 1) return;
    commit({
      variables: {
        input: {
          ambassadorId,
          eventId,
          score: value,
          comment: comment.trim() || null,
        },
      },
      onCompleted: (res) => {
        const r = res.rateAmbassador;
        if (r?.success) {
          showAlert(
            `Saved ${value}★${ambassadorName ? ` for ${ambassadorName}` : ""}.`,
            "success",
          );
          onRated?.(r.ambassadorAverage ?? value, r.ambassadorRatingCount ?? 0);
          if (showComment) setShowComment(false);
        } else {
          showAlert(r?.message || "Could not save rating.", "error");
        }
      },
      onError: (err) => showAlert(`Rating failed: ${err.message}`, "error"),
    });
  };

  const handleStar = (value: number) => {
    setScore(value);
    // Compact rows save on click; full control waits for an explicit Save
    // so the rater can add a note first.
    if (compact) submit(value);
  };

  const display = hover || score;

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={inFlight}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleStar(n)}
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            style={{
              background: "none",
              border: "none",
              cursor: inFlight ? "default" : "pointer",
              padding: 0,
              fontSize: compact ? 16 : 24,
              lineHeight: 1,
              color: n <= display ? GOLD : MUTED,
              transition: "color 80ms ease",
            }}
          >
            {STAR}
          </button>
        ))}
        {!compact && (
          <button
            type="button"
            onClick={() => setShowComment((s) => !s)}
            style={{
              marginLeft: 10,
              fontSize: 12,
              background: "none",
              border: "none",
              color: "inherit",
              opacity: 0.7,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showComment ? "Hide note" : "Add note"}
          </button>
        )}
      </div>

      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {showComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional note (e.g. great energy, arrived early)…"
              rows={2}
              style={{
                width: "100%",
                fontSize: 13,
                padding: 8,
                borderRadius: 8,
                border: "1px solid rgba(140,140,150,0.35)",
                background: "transparent",
                color: "inherit",
                resize: "vertical",
              }}
            />
          )}
          <button
            type="button"
            disabled={inFlight || score < 1}
            onClick={() => submit(score)}
            style={{
              alignSelf: "flex-start",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: inFlight || score < 1 ? "default" : "pointer",
              background: score < 1 ? "rgba(140,140,150,0.25)" : GOLD,
              color: score < 1 ? "rgba(140,140,150,0.8)" : "#1a1400",
              opacity: inFlight ? 0.7 : 1,
            }}
          >
            {inFlight ? "Saving…" : "Save rating"}
          </button>
        </div>
      )}
    </div>
  );
};

export default RateBaControl;
