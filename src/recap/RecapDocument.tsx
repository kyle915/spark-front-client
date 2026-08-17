import type { ReactNode } from "react";
import { SparkMark } from "@/recap/SparkMark";

/**
 * White shareable field-report chrome. Admin sidebar / Jump / Today stay
 * dark — only the recap document itself goes light.
 */
export function RecapDocument({
  children,
  status,
  className,
  page,
  actions,
}: {
  children: ReactNode;
  status?: string | null;
  className?: string;
  /** Full-viewport public/client page (no admin card radius). */
  page?: boolean;
  actions?: ReactNode;
}) {
  const badge = (status ?? "").trim();
  const approved = badge.toUpperCase() === "APPROVED";
  return (
    <div
      className={`recap-doc ${page ? "recap-doc-page" : ""} ${className ?? ""}`}
      data-recap-doc=""
    >
      <header className="recap-doc-header">
        <SparkMark height={28} />
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {badge ? (
            <span
              className={`recap-doc-badge ${approved ? "is-approved" : "is-draft"}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
