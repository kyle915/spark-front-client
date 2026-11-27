import { useEffect, useState, Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useLinkedSheetUrl from "@/hooks/useLinkedSheetUrl";
import LinkedSheetIntegrationPanel from "@/components/integrations/LinkedSheetIntegrationPanel";
import { MyPreferencesQuery } from "@/api/queries/MyPreferencesQuery";
import type { MyPreferencesQuery as MyPreferencesQueryType } from "@api/queries/__generated__/MyPreferencesQuery.graphql";
import { SetMyPreferencesMutation } from "@/api/mutations/SetMyPreferencesMutation";
import type { SetMyPreferencesMutation as SetMyPreferencesMutationType } from "@api/mutations/__generated__/SetMyPreferencesMutation.graphql";

/**
 * Spark v2 — Settings (Workspace).
 * Wireframe: spark-demo/index.html lines 2488-2510.
 */

const ACTIVATION_TYPES = [
  { id: "retail", label: "Retail Sampling", icon: "▦" },
  { id: "onprem", label: "On-Premise", icon: "○" },
  { id: "event", label: "Event", icon: "◇" },
];

const TZ_OPTIONS = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
];

// Shape of the opaque `prefs` JSON blob returned by myPreferences.
// The backend types it as a plain JSON scalar (TS `any`), so we cast
// at the boundary and apply our own defaults defensively for any key
// the user hasn't saved yet.
interface ActivationPrefs {
  retail: boolean;
  onprem: boolean;
  event: boolean;
}
interface UserPrefs {
  timezone?: string;
  currency?: string;
  activations?: Partial<ActivationPrefs>;
}

const DEFAULT_TZ = "America/Chicago";
const DEFAULT_CURRENCY = "USD ($)";
const DEFAULT_ACTIVATIONS: ActivationPrefs = {
  retail: true,
  onprem: true,
  event: true,
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
        background: "rgba(var(--spark-ink-rgb),0.025)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <div className="flex items-center gap-3 py-3 px-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Linked Google Sheet</p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--spark-text-meta)" }}
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
              color: "var(--spark-on-accent)",
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

  // Backend is the source of truth for per-user prefs. Load once, then
  // hold the three fields in local state for snappy controlled inputs;
  // each change is partial-saved back via setMyPreferences.
  const data = useLazyLoadQuery<MyPreferencesQueryType>(
    MyPreferencesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const prefs = (data.myPreferences.prefs ?? {}) as UserPrefs;

  const [tzSel, setTzSel] = useState(() => prefs.timezone ?? DEFAULT_TZ);
  const [curSel, setCurSel] = useState(
    () => prefs.currency ?? DEFAULT_CURRENCY,
  );
  const [enabled, setEnabled] = useState<ActivationPrefs>(() => ({
    ...DEFAULT_ACTIVATIONS,
    ...(prefs.activations ?? {}),
  }));

  const [commit] = useMutation<SetMyPreferencesMutationType>(
    SetMyPreferencesMutation,
  );

  // Partial-save a single pref key. The backend shallow-merges, so we
  // only send the field that changed. Optimistic local state already
  // reflects the new value; we just surface a toast on failure (and a
  // quiet confirmation on success).
  const savePref = (patch: UserPrefs) => {
    commit({
      variables: { input: { prefs: patch } },
      onCompleted: (resp) => {
        const r = resp.setMyPreferences;
        if (r?.success) {
          showAlert("Settings saved.", "success");
        } else {
          showAlert(r?.message || "Couldn't save settings.", "error");
        }
      },
      onError: (e) => {
        showAlert(e.message || "Couldn't save settings.", "error");
      },
    });
  };

  const onTzChange = (value: string) => {
    setTzSel(value);
    savePref({ timezone: value });
  };
  const onCurrencyChange = (value: string) => {
    setCurSel(value);
    savePref({ currency: value });
  };
  const onToggleActivation = (id: keyof ActivationPrefs) => {
    setEnabled((e) => {
      const next = { ...e, [id]: !e[id] };
      savePref({ activations: next });
      return next;
    });
  };

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
              color: "var(--spark-text-meta)",
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
                onChange={(e) => onTzChange(e.target.value)}
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
                onChange={(e) => onCurrencyChange(e.target.value)}
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
              {ACTIVATION_TYPES.map((t) => {
                const id = t.id as keyof ActivationPrefs;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{
                      background: "rgba(var(--spark-ink-rgb),0.025)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    <span
                      className="mono w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: "rgba(var(--spark-accent-rgb),0.10)",
                        border: "1px solid rgba(var(--spark-accent-rgb),0.25)",
                        color: "var(--spark-lime)",
                      }}
                    >
                      {t.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium">{t.label}</span>
                    <button
                      onClick={() => onToggleActivation(id)}
                      className={`pill-btn ${enabled[id] ? "on" : ""}`}
                      style={
                        enabled[id]
                          ? undefined
                          : { border: "1px solid var(--spark-border)" }
                      }
                    >
                      {enabled[id] ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Integrations card */}
        <div className="spark-card p-6 space-y-3">
          <h3 className="font-bold mb-1">Integrations</h3>
          <div
            className="flex items-center gap-3 py-3 px-3 rounded-xl"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.025)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">Google Calendar</p>
              <p
                className="text-xs"
                style={{ color: "var(--spark-text-meta)" }}
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

          <div
            className="flex items-center gap-3 py-3 px-3 rounded-xl"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.025)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">AI Connector (MCP) &amp; Outbound Webhooks</p>
              <p
                className="text-xs"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Connect Claude / ChatGPT and send signed webhooks (recap.approved, request.created, shelf.oos_detected) to HubSpot, Klaviyo, Airtable, or Zapier.
              </p>
            </div>
            <Link
              to="/ai-connector"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Configure →
            </Link>
          </div>

          <div
            className="flex items-center gap-3 py-3 px-3 rounded-xl"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.025)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <div className="flex-1">
              <p className="text-sm font-medium">Sample Brand Sandbox</p>
              <p
                className="text-xs"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Read-only sample beverage brand for demos, onboarding walkthroughs, and testing Buyer QBR decks safely.
              </p>
            </div>
            <Link
              to="/sandbox"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Open Sandbox →
            </Link>
          </div>

          {/* Google Sheet append observability — last sync, errors, REQ link */}
          <Suspense
            fallback={
              <div className="spark-card p-5 text-sm text-base-content/60">
                Loading integration status…
              </div>
            }
          >
            <LinkedSheetIntegrationPanel />
          </Suspense>

          {/* Linked Google Sheet for this tenant. URL is set/edited
              from the Master Tracker header; this row is read-only
              + provides a deep-link. */}
          <LinkedSheetRow />
        </div>
      </div>
    </Layout>
  );
}
