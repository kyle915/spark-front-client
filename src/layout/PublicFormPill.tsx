import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAlertStore } from "@/store/alertStore";
import { sparkFormUrl, type PublicFormLink } from "@/utils/publicHosts";

type PublicFormKind = PublicFormLink["kind"];

/**
 * Label for the topbar / client-dashboard CTA.
 * Spark-form tenants → event request; check-in-only (e.g. Feel Free) → walk-up.
 */
export function publicFormCtaLabel(kind?: PublicFormKind | null): string {
  switch (kind) {
    case "checkin":
      return "Open check-in";
    case "spark-form":
    case null:
    case undefined:
      return "Submit Event Request";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Prominent public-link CTA: bold label, lime accent, slug + copy + open.
 * URL is always the client host — spark-form or standing check-in —
 * never admin.
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
  const copyTitle = isCheckin ? "Copy check-in link" : "Copy event request link";
  const openTitle = isCheckin ? "Open check-in" : "Open event request form";

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(href);
      showAlert("Link copied to clipboard", "success");
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
      className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-sm font-semibold ${className}`}
      style={{
        background: "rgba(197, 245, 70, 0.12)",
        border: "1px solid rgba(197, 245, 70, 0.5)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
      }}
    >
      <span style={{ color: "var(--spark-lime)" }}>{label}</span>
      <span
        className="mono font-medium truncate max-w-[160px] text-xs"
        style={{ color: "rgba(255,255,255,0.72)" }}
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
        <ClipboardIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={open}
        className="transition hover:opacity-80"
        style={{ color: "var(--spark-lime)" }}
        title={openTitle}
        aria-label={openTitle}
      >
        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default PublicFormPill;
