import { useAuthStore } from "@/store/authStore";

/**
 * Per-tenant linked Google Sheet shortcut. Reads
 * @spark.linkedSheet.url/{tenantId} from localStorage (the same key
 * the Master Tracker config modal writes) and renders a sky-blue
 * '📊 Sheet ↗' chip that opens the brand's sheet in a new tab.
 *
 * Renders null when no URL is set so the chip is invisible on
 * tenants that haven't configured one.
 *
 * Variants — pick a size to match the surrounding controls.
 */
type Props = {
  /** "default" matches the regular action buttons (px-3 py-2);
   *  "small" matches sidebar/header tag-style controls. */
  size?: "default" | "small";
  /** Override the chip label. Defaults to "📊 Sheet ↗". */
  label?: string;
  /** Hover tooltip. */
  title?: string;
};

export const LinkedSheetChip: React.FC<Props> = ({
  size = "default",
  label = "📊 Sheet ↗",
  title = "Open the brand's linked Google Sheet",
}) => {
  const { tenantId } = useAuthStore();
  const url = (() => {
    if (!tenantId) return "";
    try {
      return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
    } catch {
      return "";
    }
  })();
  if (!url) return null;
  const cls =
    size === "small"
      ? "px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
      : "px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={{
        background: "rgba(95,184,239,0.10)",
        color: "var(--spark-sky)",
        border: "1px solid rgba(95,184,239,0.35)",
        textDecoration: "none",
      }}
      title={title}
    >
      {label}
    </a>
  );
};

export default LinkedSheetChip;
