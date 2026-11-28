import React from "react";

/**
 * Stroke Check Badge — animated SVG checkmark circle that draws its stroke
 * when `done` flips true (used in RecapCompleteness & StepTrack).
 */
export const StrokeCheckBadge: React.FC<{
  done: boolean;
  index?: number;
  current?: boolean;
  accent?: string;
  size?: number;
}> = ({
  done,
  index,
  current = false,
  accent = "var(--spark-lime)",
  size = 22,
}) => (
  <span
    aria-hidden
    style={{
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: 999,
      display: "grid",
      placeItems: "center",
      fontSize: Math.max(10, Math.round(size * 0.52)),
      fontWeight: 700,
      background: done ? accent : current ? "var(--spark-text, #1c1917)" : "transparent",
      color: done ? "var(--spark-on-accent, #ffffff)" : current ? "var(--spark-bg, #ffffff)" : "var(--spark-text-meta, #57534e)",
      border: done || current ? "none" : "1.5px solid var(--spark-border, #a8a29e)",
      boxShadow: current && !done ? "0 0 0 3px rgba(var(--spark-accent-rgb, 148, 224, 64), 0.24)" : "none",
      transition: "background-color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
      transform: done ? "scale(1)" : current ? "scale(1.04)" : "scale(1)",
    }}
  >
    {done ? (
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 16 16">
        <path
          className="spark-stroke-check-path"
          data-done="true"
          d="M3.2 8.2 6.4 11.4 12.8 4.6"
        />
      </svg>
    ) : index != null ? (
      index + 1
    ) : null}
  </span>
);

export interface StepTrackItem {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "todo";
}

/**
 * Step Track — crisp horizontal step bar with animated fill connectors and
 * stroke-drawn checkmarks for BA check-in and brand onboarding checklists.
 */
export const StepTrack: React.FC<{
  steps: readonly StepTrackItem[];
  accent?: string;
  ariaLabel?: string;
}> = ({ steps, accent = "#14160f", ariaLabel = "Progress steps" }) => {
  return (
    <ol
      aria-label={ariaLabel}
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {steps.map((s, i) => {
        const done = s.state === "done";
        const current = s.state === "current";
        const isLast = i === steps.length - 1;
        return (
          <li
            key={s.key}
            aria-current={current ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            <StrokeCheckBadge
              done={done}
              current={current}
              index={i}
              accent={accent}
              size={22}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: current ? 700 : 500,
                color: current ? "var(--spark-text, #1c1917)" : "var(--spark-text-meta, #44403c)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.label}
              <span style={{ position: "absolute", left: -9999 }}>
                {done ? " (done)" : current ? " (current step)" : ""}
              </span>
            </span>
            {!isLast ? (
              <span
                aria-hidden
                style={{
                  flex: 1,
                  minWidth: 8,
                  height: 2,
                  borderRadius: 999,
                  background: "var(--spark-border, rgba(0,0,0,0.1))",
                  overflow: "hidden",
                }}
              >
                <span
                  className="spark-step-connector-fill block w-full h-full"
                  style={{
                    background: accent,
                    transform: done ? "scaleX(1)" : "scaleX(0)",
                  }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};
