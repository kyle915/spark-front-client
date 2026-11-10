import type { CheckinStep } from "./checkinSteps";

/** Compact progress row for the check-in page. Purely informational. */
export const CheckinStepBar: React.FC<{ steps: CheckinStep[]; accent: string }> = ({
  steps,
  accent,
}) => (
  <ol
    aria-label="Check-in progress"
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
      return (
        <li
          key={s.key}
          aria-current={current ? "step" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
              background: done ? accent : current ? "#1c1917" : "transparent",
              color: done || current ? "#fff" : "#57534e",
              border: done || current ? "none" : "1.5px solid #a8a29e",
            }}
          >
            {done ? "✓" : i + 1}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: current ? 700 : 500,
              color: current ? "#1c1917" : "#44403c",
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
        </li>
      );
    })}
  </ol>
);

export default CheckinStepBar;
