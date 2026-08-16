import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAlertStore } from "@/store/alertStore";
import { sparkFormUrl } from "@/utils/publicHosts";

/**
 * Compact public-form chip: muted label, lime mono slug, copy + open.
 * Field URL is always the client host (`sparkFormUrl`), never admin.
 */
export function PublicFormPill({
  slug,
  className = "",
}: {
  slug?: string | null;
  className?: string;
}) {
  const trimmed = slug?.trim() ?? "";
  const { showAlert } = useAlertStore();
  if (!trimmed) return null;

  const url = sparkFormUrl(trimmed);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Link copied to clipboard", "success");
    } catch {
      showAlert("Error copying link", "error");
    }
  };

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
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
        title={url}
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
