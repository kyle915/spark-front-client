/**
 * /favorites — per-tenant favorite-BA roster (backend-backed).
 *
 * BAs in this list see favorites-gated jobs (Job.favoritesOnly=True)
 * before any other BA. Admin can "Open to all" from the job detail
 * page when they need a wider pool.
 *
 * Replaces the v1 localStorage-only implementation. Persistence is
 * now `TenantFavoriteAmbassador` rows, mutated via
 * addFavoriteAmbassador / removeFavoriteAmbassador.
 */
import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import PageErrorBoundary from "@/layout/PageErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { FavoriteAmbassadorsQuery } from "@/api/queries/FavoriteAmbassadorsQuery";
import type { FavoriteAmbassadorsQuery as FavoriteAmbassadorsQueryType } from "@api/queries/__generated__/FavoriteAmbassadorsQuery.graphql";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import {
  AddFavoriteAmbassadorMutation,
  RemoveFavoriteAmbassadorMutation,
} from "@/api/mutations/FavoriteAmbassadorMutations";
import type { FavoriteAmbassadorMutations_AddMutation } from "@api/mutations/__generated__/FavoriteAmbassadorMutations_AddMutation.graphql";
import type { FavoriteAmbassadorMutations_RemoveMutation } from "@api/mutations/__generated__/FavoriteAmbassadorMutations_RemoveMutation.graphql";

export default function SparkFavorites() {
  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            FAVORITES
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Your A-team gets first look.
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            BAs on this list see favorites-gated jobs before anyone else.
            Open a job to all from the job detail page when you need a wider
            pool.
          </p>
        </div>

        <PageErrorBoundary label="favorites">
          <Suspense
            fallback={
              <div
                className="spark-card p-8 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading favorites…
              </div>
            }
          >
            <Inner />
          </Suspense>
        </PageErrorBoundary>
      </div>
    </Layout>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
};

const Inner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<FavoriteAmbassadorsQueryType>(
    FavoriteAmbassadorsQuery,
    { tenantId: tenantId ?? null },
    { fetchPolicy: "network-only" },
  );
  const favs = data?.favoriteAmbassadors ?? [];

  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [commitRemove, removing] =
    useMutation<FavoriteAmbassadorMutations_RemoveMutation>(
      RemoveFavoriteAmbassadorMutation,
    );

  const remove = (ambassadorId: string, name: string) => {
    if (!confirm(`Remove ${name} from favorites?`)) return;
    commitRemove({
      variables: { input: { tenantId: tenantId ?? null, ambassadorId } },
      onCompleted: (resp) => {
        if (resp.removeFavoriteAmbassador?.success) {
          showAlert(`${name} removed.`, "success");
          window.location.reload();
        } else {
          showAlert(
            resp.removeFavoriteAmbassador?.message ?? "Remove failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return favs;
    return favs.filter((f) => {
      const n =
        `${f.firstName} ${f.lastName} ${f.email} ${f.note}`.toLowerCase();
      return n.includes(q);
    });
  }, [favs, search]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search favorites by name, email, note…"
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <button
          onClick={() => setPickerOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 18px rgba(197,245,70,0.35)",
          }}
        >
          + Add BA to favorites
        </button>
      </div>

      {favs.length === 0 ? (
        <div
          className="spark-card p-8 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No favorites yet. Add a BA above to gate jobs to your A-team.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const name =
              [f.firstName, f.lastName].filter(Boolean).join(" ") ||
              f.email ||
              "(unnamed)";
            return (
              <div key={f.uuid} className="spark-card p-4 hov">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold truncate">{name}</h3>
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {f.email}
                    </p>
                    {f.note && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: "rgba(255,255,255,0.65)" }}
                      >
                        ★ {f.note}
                      </p>
                    )}
                  </div>
                  <button
                    disabled={removing}
                    onClick={() => remove(f.ambassadorId, name)}
                    className="px-3 py-1.5 rounded-md text-xs"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(239,90,42,0.45)",
                      color: "var(--spark-orange)",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <BaPicker
          existingIds={new Set(favs.map((f) => f.ambassadorId))}
          onClose={() => setPickerOpen(false)}
          onAdded={() => window.location.reload()}
        />
      )}
    </>
  );
};

/* ──────────────── BA picker modal ──────────────── */

const BaPicker: React.FC<{
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}> = ({ existingIds, onClose, onAdded }) => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spark-card"
        style={{ width: 520, maxWidth: "100%", padding: 20 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="display text-xl font-bold">Add a BA</h2>
          <button
            onClick={onClose}
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ✕
          </button>
        </div>
        <Suspense
          fallback={
            <div
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading BAs…
            </div>
          }
        >
          <BaPickerInner existingIds={existingIds} onAdded={onAdded} />
        </Suspense>
      </div>
    </div>
  );
};

const BaPickerInner: React.FC<{
  existingIds: Set<string>;
  onAdded: () => void;
}> = ({ existingIds, onAdded }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [note, setNote] = useState("");

  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    {
      first: 50,
      filters: tenantId ? { tenantId, isActive: true } : { isActive: true },
    },
    { fetchPolicy: "store-or-network" },
  );

  const [commitAdd, adding] =
    useMutation<FavoriteAmbassadorMutations_AddMutation>(
      AddFavoriteAmbassadorMutation,
    );

  const add = (ambassadorId: string, name: string) => {
    commitAdd({
      variables: {
        input: {
          tenantId: tenantId ?? null,
          ambassadorId,
          note: note || null,
        },
      },
      onCompleted: (resp) => {
        if (resp.addFavoriteAmbassador?.success) {
          showAlert(`${name} added to favorites.`, "success");
          onAdded();
        } else {
          showAlert(
            resp.addFavoriteAmbassador?.message ?? "Add failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const rows =
    data?.ambassadors?.edges
      ?.map((e) => e?.node)
      ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

  return (
    <div className="space-y-3">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. 'LD-trained, NYC')"
        style={inputStyle}
      />
      <div
        style={{
          maxHeight: 360,
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
        }}
      >
        {rows.length === 0 ? (
          <p
            className="p-4 text-sm"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            No BAs available.
          </p>
        ) : (
          rows.map((r) => {
            const name =
              [r.user?.firstName, r.user?.lastName]
                .filter(Boolean)
                .join(" ") ||
              r.user?.email ||
              "(unnamed)";
            const already = existingIds.has(String(r.id));
            return (
              <div
                key={String(r.uuid)}
                className="flex items-center justify-between gap-2 px-3 py-2"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {r.user?.email}
                  </p>
                </div>
                {already ? (
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-gold)",
                    }}
                  >
                    ★ ON LIST
                  </span>
                ) : (
                  <button
                    disabled={adding}
                    onClick={() => add(String(r.id), name)}
                    className="px-3 py-1 rounded-md text-xs font-semibold"
                    style={{
                      background: "var(--spark-lime)",
                      color: "#0a0d09",
                      opacity: adding ? 0.5 : 1,
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
