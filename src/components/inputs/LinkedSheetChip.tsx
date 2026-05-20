import { Suspense } from "react";
import useLinkedSheetUrl from "@/hooks/useLinkedSheetUrl";

/**
 * Per-tenant linked Google Sheet shortcut.
 *
 * Reads `tenant.linkedSheetUrl` from the backend via `useLinkedSheetUrl`
 * (with a one-time localStorage → backend migration during rollout).
 * Renders a sky-blue chip that opens the linked Sheet in a new tab.
 *
 * Renders null when no URL is configured, so the chip is invisible
 * for tenants that haven't set one up.
 */
type Props = {
  /** "default" matches regular action buttons (px-3 py-2);
   *  "small" matches sidebar/header tag-style controls. */
  size?: "default" | "small";
  /** Override the chip label. */
  label?: string;
  /** Hover tooltip. */
  title?: string;
};

const Inner: React.FC<Props> = ({
  size = "default",
  label = "📊 Sheet ↗",
  title = "Open the brand's linked Google Sheet",
}) => {
  const { url } = useLinkedSheetUrl();
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

export const LinkedSheetChip: React.FC<Props> = (props) => (
  // useLinkedSheetUrl issues a Relay query; wrapping in Suspense keeps
  // the chip from blocking the surrounding page on cold load. Suspense
  // fallback is null because the chip is decoration — better to flash
  // in late than push a placeholder around.
  <Suspense fallback={null}>
    <Inner {...props} />
  </Suspense>
);

export default LinkedSheetChip;
