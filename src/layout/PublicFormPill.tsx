import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAlertStore } from "@/store/alertStore";
import { sparkFormUrl, type PublicFormLink } from "@/utils/publicHosts";

type PublicFormKind = PublicFormLink["kind"];

const PUBLIC_PILL_HINT =
  "Public / external requests — for people who aren’t logged into Spark (non-Spark accounts)";

/**
 * Scannable topbar label for the tenant’s external public link
 * (spark-form or standing check-in) — not the in-app Create Request.
 */
export function publicFormCtaLabel(kind?: PublicFormKind | null): string {
  switch (kind) {
    case "checkin":
      return "Public check-in link";
    case "spark-form":
    case null:
    case undefined:
      return "External request link";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Compact share control for the tenant’s public spark-form / check-in URL.
 * Copy or open for non-Spark accounts — not Create Request.
 */
export function PublicFormPill({
  slug,
  url,
  kind,
  className = "",
}: {
  slug?: string | null;
  url?: string | null;
  kind?: PublicFormKind | null;
  className?: string;
}) {
  const trimmed = slug?.trim() ?? "";
  const { showAlert } = useAlertStore();
  if (!trimmed) return null;

  const href = url?.trim() || sparkFormUrl(trimmed);
  const label = publicFormCtaLabel(kind);
  const isCheckin = kind === "checkin";
  const copyTitle = isCheckin
    ? "Copy public check-in link for non-Spark accounts (no login)"
    : "Copy external request link for non-Spark accounts (no login)";
  const openTitle = isCheckin
    ? "Open public check-in for non-Spark accounts (no login)"
    : "Open external request form for non-Spark accounts (no login)";

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(href);
      showAlert("Public link copied to clipboard", "success");
    } catch {
      showAlert("Error copying link", "error");
    }
  };

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${className}`}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--spark-border)",
      }}
      title={PUBLIC_PILL_HINT}
    >
      <span className="font-medium" style={{ color: "var(--spark-text-secondary)" }}>
        {label}
      </span>
      <span
        className="mono font-medium truncate max-w-[160px]"
        style={{ color: "var(--spark-lime)" }}
        title={href}
      >
        {trimmed}
      </span>
      <button
        type="button"
        onClick={copy}
        className="transition hover:opacity-80"
        style={{ color: "var(--spark-lime)" }}
        title={copyTitle}
        aria-label={copyTitle}
      >
        <ClipboardIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={open}
        className="transition hover:opacity-80"
        style={{ color: "var(--spark-lime)" }}
        title={openTitle}
        aria-label={openTitle}
      >
        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PublicFormPill;
