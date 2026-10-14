import type { CSSProperties, RefObject } from "react";
import {
  PLAN_GIG_MISSING_ERROR,
  PLAN_GIG_NONE,
  planGigQuestion,
  planGigTimes,
  type PlanGig,
} from "./planGigs";

const option = (selected: boolean, accent: string): CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: 12,
  border: selected ? `2px solid ${accent}` : "1px solid #e7e5e4",
  background: selected ? "rgba(255,255,255,0.95)" : "#fff",
  cursor: "pointer",
});

/** "Is this one of today's scheduled events?" — required once listed. */
export default function PlanGigPicker({
  gigs,
  value,
  onChange,
  accent,
  missing,
  eventDate,
  today,
  pickerRef,
}: {
  gigs: PlanGig[];
  value: string;
  onChange: (value: string) => void;
  accent: string;
  missing: boolean;
  eventDate: string;
  today: string;
  pickerRef: RefObject<HTMLDivElement | null>;
}) {
  if (!gigs.length) return null;
  return (
    <div
      ref={pickerRef}
      tabIndex={-1}
      role="radiogroup"
      aria-labelledby="spark-checkin-plan-gig-title"
      style={{
        margin: "22px -12px 0",
        padding: 10,
        borderRadius: 16,
        border: `2px solid ${missing ? "#EF5A2A" : "transparent"}`,
        background: missing ? "rgba(239,90,42,0.06)" : "transparent",
        outline: "none",
      }}
    >
      <h2
        id="spark-checkin-plan-gig-title"
        style={{ fontSize: 16, fontWeight: 700, margin: 0 }}
      >
        {planGigQuestion(eventDate, today)}
      </h2>
      <p style={{ fontSize: 13, margin: "2px 0 14px", color: "#57534e" }}>
        Pick it so your hours and recap count toward that event.
      </p>
      {missing ? (
        <p role="alert" style={{ color: "#EF5A2A", fontSize: 13, fontWeight: 700, margin: "-6px 0 12px" }}>
          {PLAN_GIG_MISSING_ERROR}
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {gigs.map((gig) => {
          const selected = value === gig.id;
          const detail = [planGigTimes(gig), gig.area, gig.typeLabel].filter(Boolean).join(" · ");
          return (
            <button
              key={gig.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(gig.id)}
              style={option(selected, accent)}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>{gig.name}</div>
              {detail ? (
                <div style={{ fontSize: 13, color: "#57534e", marginTop: 2 }}>{detail}</div>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === PLAN_GIG_NONE}
          onClick={() => onChange(PLAN_GIG_NONE)}
          style={option(value === PLAN_GIG_NONE, accent)}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
            No, a different event
          </div>
        </button>
      </div>
    </div>
  );
}
