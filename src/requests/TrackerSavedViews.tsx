import { Suspense, useEffect, useRef, useState } from "react";
import { Bookmark, X } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [commit] = useMutation<SetMyPreferencesMutationType>(
    SetMyPreferencesMutation,
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`pill-btn inline-flex items-center gap-1.5 cursor-pointer ${open ? "on" : ""}`}
        title="Saved filter views"
      >
        <Bookmark size={12} strokeWidth={1.85} />
        <span>Views{views.length ? ` (${views.length})` : ""}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[280px] rounded-xl p-2.5"
          style={{
            background: "var(--spark-surface)",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
            boxShadow: "var(--spark-elev-2)",
          }}
        >
          <div className="px-1.5 pb-1.5 flex items-center justify-between">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Saved views
            </span>
            {views.length > 0 ? (
              <span
                className="text-[11px] tab-num"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {views.length}
              </span>
            ) : null}
          </div>

          {views.length === 0 ? (
            <p
              className="text-xs px-1.5 py-2 leading-relaxed"
              style={{ color: "var(--spark-text-meta)" }}
            >
              No saved views yet — set your filters, then name and save them below.
            </p>
          ) : (
            <div className="space-y-0.5 max-h-56 overflow-y-auto">
              {views.map((w) => (
                <div
                  key={w.name}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg spark-row-hover"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="text-xs font-medium text-left flex-1 truncate cursor-pointer"
                    style={{
                      color: "var(--spark-text)",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                    }}
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
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition hover:opacity-80 cursor-pointer"
                    style={{
                      color: "var(--spark-text-meta)",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                    }}
                    title="Delete view"
                    aria-label={`Delete view ${w.name}`}
                    onClick={() =>
                      persist(views.filter((x) => x.name !== w.name))
                    }
                  >
                    <X size={12} strokeWidth={1.9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="flex items-center gap-1.5 mt-2 pt-2.5"
            style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
          >
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveCurrent();
                }
              }}
              placeholder="Save current view as…"
              aria-label="New saved view name"
              className="flex-1 min-w-0 rounded-lg text-xs outline-none"
              style={{
                padding: "6px 9px",
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            <button
              type="button"
              onClick={saveCurrent}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0 transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                border: "none",
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
