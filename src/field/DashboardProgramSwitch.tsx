import type { DashboardProgram } from "./useDashboardProgram";

export default function DashboardProgramSwitch({
  program,
  onChange,
}: {
  program: DashboardProgram;
  onChange: (next: DashboardProgram) => void;
}) {
  return (
    <div className="pill-group" role="tablist" aria-label="Program">
      <button
        type="button"
        role="tab"
        aria-selected={program === "retail"}
        className={`pill-btn ${program === "retail" ? "on" : ""}`}
        onClick={() => onChange("retail")}
      >
        Retail sampling
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={program === "field"}
        className={`pill-btn ${program === "field" ? "on" : ""}`}
        onClick={() => onChange("field")}
      >
        Field marketing
      </button>
    </div>
  );
}
