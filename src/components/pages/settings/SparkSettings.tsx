import { useEffect, useState } from "react";
import { Link } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useLinkedSheetUrl from "@/hooks/useLinkedSheetUrl";

/**
 * Spark v2 — Settings (Workspace).
 * Wireframe: spark-demo/index.html lines 2488-2510.
 */

const ACTIVATION_TYPES = [
  { id: "retail", label: "Retail Sampling", icon: "▦" },
  { id: "onprem", label: "On-Premise", icon: "🍺" },
  { id: "event", label: "Event", icon: "◇" },
];

const TZ_OPTIONS = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
];

// localStorage keys for the per-user UI prefs that don't yet have a
// backend home. Scoped under @spark.settings.* so we can add a real
// tenant-level save later without colliding.
const TZ_KEY = "@spark.settings.timezone";
const CUR_KEY = "@spark.settings.currency";
const ACTIVATION_KEY = "@spark.settings.activations";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const readString = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

/**
 * Editable row for the per-tenant linked Google Sheet.
 *
 * Backed by tenant.linkedSheetUrl on the backend via useLinkedSheetUrl
 * (replaces the per-device localStorage we used to ship). Admins can
 * paste a new URL or clear the existing one without round-tripping
 * the Master Tracker config modal.
 */
const LinkedSheetRow: React.FC = () => {
  const { url, setUrl, saving } = useLinkedSheetUrl();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState(url);
  const [editing, setEditing] = useState(false);

  // Resync when the backend value lands (or the user opens the page
  // on a different device).
  useEffect(() => {
    setDraft(url);
  }, [url]);

  const save = async () => {
    const res = await setUrl(draft);
    if (res.ok) {
      showAlert(
        draft.trim() ? "Linked sheet saved." : "Linked sheet cleared.",
        "success",
      );
      setEditing(false);
    } else {
      showAlert(res.message || "Couldn't save sheet link.", "error");
    }
  };

  return (
    <div
      className="rounded-xl"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <div className="flex items-center gap-3 py-3 px-3">
        <span
          className="mono w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: "rgba(95,184,239,0.10)",
            border: "1px solid rgba(95,184,239,0.25)",
            color: "var(--spark-sky)",
          }}
        >
          📊
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Linked Google Sheet</p>
          <p
            className="text-xs truncate"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {url
              ? "Brand-specific tracker mirror — visible to every teammate on every device."
              : "Not set. Paste your team's Google Sheets URL below."}
          </p>
        </div>
        {url && !editing && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "rgba(95,184,239,0.12)",
              color: "var(--spark-sky)",
              border: "1px solid rgba(95,184,239,0.35)",
              textDecoration: "none",
            }}
          >
            Open ↗
          </a>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          {editing ? "Cancel" : url ? "Edit" : "Set up"}
        </button>
      </div>
      {editing && (
        <div className="px-3 pb-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="flex-1 rounded-lg text-sm"
            style={{
              padding: "0.6rem 0.85rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              outline: "none",
            }}
            autoFocus
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
};

export default function SparkSettings() {
  const { tenantMeta } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [tzSel, setTzSel] = useState(() =>
    readString(TZ_KEY, "America/Chicago"),
  );
  const [curSel, setCurSel] = useState(() =>
    readString(CUR_KEY, "USD ($)"),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    readJson<Record<string, boolean>>(ACTIVATION_KEY, {
      retail: true,
      onprem: true,
      event: true,
    }),
  );

  // Persist on change so a refresh doesn't reset choices. Quiet —
  // no toast for routine prefs; we'd over-notify.
  useEffect(() => {
    try {
      localStorage.setItem(TZ_KEY, tzSel);
    } catch {
      /* ignore quota */
    }
  }, [tzSel]);
  useEffect(() => {
    try {
      localStorage.setItem(CUR_KEY, curSel);
    } catch {
      /* ignore */
    }
  }, [curSel]);
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVATION_KEY, JSON.stringify(enabled));
    } catch {
      /* ignore */
    }
  }, [enabled]);
  void showAlert;

  const slug = tenantMeta?.requestUrlName ?? "—";
  const displayName = slug
    .split("-")
    .filter(Boolean)
    .filter((p) => !["ighn", "ig", "ign"].includes(p.toLowerCase()))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");

  const inputStyle: React.CSSProperties = {
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    borderRadius: 12,
    padding: "0.75rem 0.95rem",
    color: "var(--spark-text)",
    fontSize: "0.9rem",
    outline: "none",
    width: "100%",
    fontFamily: "Space Grotesk, sans-serif",
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            SETTINGS
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Workspace.
          </h1>
        </div>

        {/* Workspace card */}
        <div className="spark-card p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-mini block mb-1.5">Workspace name</label>
              <input style={inputStyle} defaultValue={displayName} />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Slug</label>
              <input style={inputStyle} defaultValue={slug} />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Time zone</label>
              <select
                style={inputStyle}
                value={tzSel}
                onChange={(e) => setTzSel(e.target.value)}
              >
                {TZ_OPTIONS.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mini block mb-1.5">Currency</label>
              <select
                style={inputStyle}
                value={curSel}
                onChange={(e) => setCurSel(e.target.value)}
              >
                <option>USD ($)</option>
                <option>CAD ($)</option>
                <option>EUR (€)</option>
              </select>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--spark-border)" }} />

          <div>
            <h3 className="font-bold mb-3">Activation types</h3>
            <div className="space-y-2">
              {ACTIVATION_TYPES.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <span
                    className="mono w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(197,245,70,0.10)",
                      border: "1px solid rgba(197,245,70,0.25)",
                      color: "var(--spark-lime)",
                    }}
                  >
                    {t.icon}
                  </span>
                  <span className="flex-1 text-sm font-medium">{t.label}</span>
                  <button
                    onClick={() =>
                      setEnabled((e) => ({ ...e, [t.id]: !e[t.id] }))
                    }
                    className={`pill-btn ${enabled[t.id] ? "on" : ""}`}
                    style={
                      enabled[t.id]
                        ? undefined
                        : { border: "1px solid var(--spark-border)" }
                    }
                  >
                    {enabled[t.id] ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations card */}
        <div className="spark-card p-6 space-y-3">
          <h3 className="font-bold mb-1">Integrations</h3>
          <div
            className="flex items-center gap-3 py-3 px-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <span
              className="mono w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(95,184,239,0.10)",
                border: "1px solid rgba(95,184,239,0.25)",
                color: "var(--spark-sky)",
              }}
            >
              📅
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">Google Calendar</p>
              <p
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Sync scheduled events into Google Calendar.
              </p>
            </div>
            <Link
              to="/settings/calendar"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Manage →
            </Link>
          </div>

          {/* Linked Google Sheet for this tenant. URL is set/edited
              from the Master Tracker header; this row is read-only
              + provides a deep-link. */}
          <LinkedSheetRow />
        </div>
      </div>
    </Layout>
  );
}
