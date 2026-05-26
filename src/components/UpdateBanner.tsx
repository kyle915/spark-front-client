import { useState } from "react";

import useVersionCheck from "@/hooks/useVersionCheck";

/**
 * Floating "new version available" prompt. Appears when a newer build is
 * detected on the server (see useVersionCheck) — typically on a tab the
 * user left open across a deploy. Clicking Refresh reloads to pick up the
 * latest bundle so nobody stares at a stale UI thinking a feature broke.
 *
 * Dismissible; mounted once in Layout so it covers every authenticated
 * page on both the admin and client shells.
 */
export const UpdateBanner: React.FC = () => {
  const { updateReady, refresh } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px 10px 18px",
        borderRadius: 12,
        background: "rgba(18,20,16,0.96)",
        border: "1px solid var(--spark-lime, #c5f546)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
        color: "rgba(255,255,255,0.92)",
        fontSize: 14,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>
        A new version of Spark is available.
        <span style={{ opacity: 0.6 }}> Refresh to get the latest.</span>
      </span>
      <button
        type="button"
        onClick={refresh}
        style={{
          fontWeight: 700,
          fontSize: 13,
          padding: "6px 14px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: "var(--spark-lime, #c5f546)",
          color: "#0a0d09",
          whiteSpace: "nowrap",
        }}
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
};

export default UpdateBanner;
