import { useState } from "react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import useSparkRole from "@/hooks/useSparkRole";
import ImportConnecteamPdfModal from "./ImportConnecteamPdfModal";

/**
 * Single drop-in button + modal trigger for Connecteam PDF import.
 *
 * Goal: surface "Import Connecteam PDF" globally across every admin
 * recap surface (List, Custom List, Missing, future surfaces) without
 * each page re-implementing the modal state + admin gate.
 *
 * Client users (Liquid Death, Girl Beer, Borjomi, etc.) never see the
 * button — Kyle's team is the only one who imports from Connecteam.
 * Hides itself entirely (returns null) for non-admins, so it's safe to
 * embed anywhere without an outer `{isAdmin && ...}` guard.
 *
 * Variants:
 *   - `variant="primary"` (default): lime CTA-style button — use on
 *     pages where Connecteam import is a top-line action
 *   - `variant="ghost"`: muted outlined button — use when there are
 *     other primary CTAs and import is a secondary action
 *
 * Usage: <ImportConnecteamButton onImported={refetch} />
 */

type Props = {
  variant?: "primary" | "ghost";
  /** Called after a successful import; use to refetch the parent list. */
  onImported?: (recapUuid: string) => void;
  /** Override the button label if "Import Connecteam PDF" doesn't fit. */
  label?: string;
};

export const ImportConnecteamButton: React.FC<Props> = ({
  variant = "primary",
  onImported,
  label = "Import Connecteam PDF",
}) => {
  const { isAdmin } = useSparkRole();
  const [open, setOpen] = useState(false);

  // Client-side render gate. Backend permissions still enforce the
  // import mutation, but hiding the affordance keeps client dashboards
  // clean of internal tooling.
  if (!isAdmin) return null;

  const primaryStyle: React.CSSProperties = {
    background: "var(--spark-lime)",
    color: "#0a0d09",
    boxShadow: "0 0 18px rgba(242,243,238,0.35)",
  };
  const ghostStyle: React.CSSProperties = {
    background: "transparent",
    color: "var(--spark-text)",
    border: "1px solid var(--spark-border)",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2"
        style={variant === "ghost" ? ghostStyle : primaryStyle}
      >
        <DocumentArrowUpIcon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      {open && (
        <ImportConnecteamPdfModal
          onClose={() => setOpen(false)}
          onImported={(uuid) => {
            setOpen(false);
            onImported?.(uuid);
          }}
        />
      )}
    </>
  );
};

export default ImportConnecteamButton;
