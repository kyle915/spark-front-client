import { Link } from "react-router";

/** Retail sampling and field marketing are separate programs. */
export default function ProgramSwitch({
  active,
}: {
  active: "retail" | "field";
}) {
  return (
    <div className="pill-group" role="tablist" aria-label="Program">
      <Link
        to="/requests/list"
        className={`pill-btn ${active === "retail" ? "on" : ""}`}
        role="tab"
        aria-selected={active === "retail"}
      >
        Retail sampling
      </Link>
      <Link
        to="/field-marketing"
        className={`pill-btn ${active === "field" ? "on" : ""}`}
        role="tab"
        aria-selected={active === "field"}
      >
        Field marketing
      </Link>
    </div>
  );
}
