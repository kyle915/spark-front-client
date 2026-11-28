import type { ReactNode } from "react";
import { SparkMark } from "@/recap/SparkMark";

/**
 * Editorial shareable field-report leave-behind.
 * Supports co-branded header lockup (`Brand × Spark`) when `brandName` or
 * `brandLogoUrl` is provided.
 */
export function RecapDocument({
  children,
  status,
  className,
  page,
  actions,
  brandName,
  brandLogoUrl,
}: {
  children: ReactNode;
  status?: string | null;
  className?: string;
  /** Full-viewport public/client page (no admin card radius). */
  page?: boolean;
  actions?: ReactNode;
  brandName?: string | null;
  brandLogoUrl?: string | null;
}) {
  const badge = (status ?? "").trim();
  const approved = badge.toUpperCase() === "APPROVED";
  const cleanBrand =
    brandName && brandName.trim() && brandName.trim().toLowerCase() !== "spark"
      ? brandName.trim()
      : null;

  return (
    <div
      className={`recap-doc ${page ? "recap-doc-page" : ""} ${className ?? ""}`}
      data-recap-doc=""
    >
      <header
        className="recap-doc-header"
        style={
          page
            ? { paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }
            : undefined
        }
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {brandLogoUrl ? (
            <>
              <img
                src={brandLogoUrl}
                alt={cleanBrand ?? "Brand"}
                className="h-7 max-h-7 max-w-[8.5rem] w-auto object-contain shrink-0"
              />
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 24,
                  flexShrink: 0,
                  background: "var(--recap-border, #e2e4d8)",
                }}
              />
              <SparkMark height={38} className="shrink-0" />
            </>
          ) : cleanBrand ? (
            <>
              <span
                className="display font-bold text-base sm:text-lg truncate"
                style={{
                  letterSpacing: "-0.025em",
                  color: "var(--recap-brand, var(--recap-text, #14160f))",
                }}
              >
                {cleanBrand}
              </span>
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 22,
                  flexShrink: 0,
                  background: "var(--recap-border, #e2e4d8)",
                }}
              />
              <SparkMark height={34} className="shrink-0" />
            </>
          ) : (
            <SparkMark height={34} className="shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {badge ? (
            <span
              className={`recap-doc-badge ${approved ? "is-approved" : "is-draft"}`}
            >
              <span className="recap-doc-badge-dot" aria-hidden />
              {approved ? "Approved" : badge.charAt(0).toUpperCase() + badge.slice(1).toLowerCase()}
            </span>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
