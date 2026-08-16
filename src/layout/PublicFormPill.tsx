import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAlertStore } from "@/store/alertStore";
import { sparkFormUrl } from "@/utils/publicHosts";

/**
 * Compact public-form chip: muted label, lime mono slug, copy + open.
 * URL is always the client host — spark-form or standing check-in —
 * never admin.
 */
export function PublicFormPill({
  slug,
  url,
  className = "",
}: {
  slug?: string | null;
  url?: string | null;
  className?: string;
}) {
  const trimmed = slug?.trim() ?? "";
  const { showAlert } = useAlertStore();
  if (!trimmed) return null;

  const href = url?.trim() || sparkFormUrl(trimmed);

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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.55)" }}>Public form</span>
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
        className="transition"
        style={{ color: "var(--spark-lime)" }}
        title="Copy public form link"
        aria-label="Copy public form link"
      >
        <ClipboardIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={open}
        className="transition"
        style={{ color: "var(--spark-lime)" }}
        title="Open public form"
        aria-label="Open public form"
      >
        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default PublicFormPill;
