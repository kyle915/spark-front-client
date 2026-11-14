import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { MyPreferencesQuery } from "@/api/queries/MyPreferencesQuery";
import type { MyPreferencesQuery as MyPreferencesQueryType } from "@api/queries/__generated__/MyPreferencesQuery.graphql";
import { SetMyPreferencesMutation } from "@/api/mutations/SetMyPreferencesMutation";
import type { SetMyPreferencesMutation as SetMyPreferencesMutationType } from "@api/mutations/__generated__/SetMyPreferencesMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Saved views for the Master Tracker — name the current filter combo
 * ("NV · this week · needs scheduling") and re-apply it in one click.
 *
 * Persistence rides the existing per-user preferences blob
 * (myPreferences / setMyPreferences, shallow-merge upsert) under the
 * `trackerViews` key, so views follow the user across devices and the
 * write can't clobber Settings keys like timezone/currency.
 */

export type TrackerViewSnapshot = {
  activeStatus?: string;
  groupBy?: string;
  search?: string;
  rmmFilter?: string;
  dateRange?: string;
  sortMode?: string;
  marketFilter?: string;
  schedulingFilter?: string;
};

type SavedView = { name: string; v: TrackerViewSnapshot };

type Props = {
  snapshot: TrackerViewSnapshot;
  onApply: (v: TrackerViewSnapshot) => void;
};

const Inner: React.FC<Props> = ({ snapshot, onApply }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<MyPreferencesQueryType>(
    MyPreferencesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );

  const stored = (data.myPreferences?.prefs ?? {}) as {
    trackerViews?: SavedView[];
  };
  // Local working copy so saves/deletes reflect instantly; the backend
  // write happens in the background (merge-upsert, never raises).
  const [views, setViews] = useState<SavedView[]>(
    Array.isArray(stored.trackerViews) ? stored.trackerViews : [],
  );
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  const [commit] = useMutation<SetMyPreferencesMutationType>(
    SetMyPreferencesMutation,
  );

  const persist = (next: SavedView[]) => {
    setViews(next);
    commit({
      variables: { input: { prefs: { trackerViews: next } } },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const saveCurrent = () => {
    const name = draftName.trim();
    if (!name) {
      showAlert("Give the view a name first.", "warning");
      return;
    }
    const next = [
      ...views.filter((w) => w.name.toLowerCase() !== name.toLowerCase()),
      { name, v: snapshot },
    ];
    persist(next);
    setDraftName("");
    showAlert(`View “${name}” saved.`, "success");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pill-btn ${open ? "on" : ""}`}
        title="Saved filter views"
      >
        ★ Views{views.length ? ` (${views.length})` : ""}
      </button>
      {open && (
        <div
          className="absolute z-40 mt-2 rounded-xl p-2"
          style={{
            minWidth: 260,
            background: "var(--spark-card, #11150f)",
            border: "1px solid var(--spark-border, #1f2418)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          }}
        >
          {views.length === 0 ? (
            <p
              className="text-xs px-2 py-1.5"
              style={{ color: "var(--spark-text-meta)" }}
            >
              No saved views yet — set your filters, then save them below.
            </p>
          ) : (
            views.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg spark-row-hover"
              >
                <button
                  type="button"
                  className="text-sm text-left flex-1 truncate"
                  style={{ color: "#fff" }}
                  onClick={() => {
                    onApply(w.v);
                    setOpen(false);
                    showAlert(`View “${w.name}” applied.`, "success");
                  }}
                >
                  {w.name}
                </button>
                <button
                  type="button"
                  className="text-xs px-1.5"
                  style={{ color: "var(--spark-text-meta)" }}
                  title="Delete view"
                  onClick={() =>
                    persist(views.filter((x) => x.name !== w.name))
                  }
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <div
            className="flex items-center gap-2 mt-2 pt-2"
            style={{ borderTop: "1px solid rgba(var(--spark-ink-rgb),0.08)" }}
          >
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrent();
              }}
              placeholder="Save current as…"
              className="flex-1 rounded-lg text-xs"
              style={{
                padding: "6px 8px",
                background: "rgba(var(--spark-ink-rgb),0.04)",
                border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
                color: "#fff",
              }}
            />
            <button
              type="button"
              onClick={saveCurrent}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{
                background: "var(--spark-lime, #f2f3ee)",
                color: "var(--spark-on-accent)",
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Suspense-isolated so a slow prefs fetch can never block the tracker.
const TrackerSavedViews: React.FC<Props> = (props) => (
  <Suspense fallback={null}>
    <Inner {...props} />
  </Suspense>
);

export default TrackerSavedViews;
