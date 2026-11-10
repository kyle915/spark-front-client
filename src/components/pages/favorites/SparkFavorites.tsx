/**
 * Spark v2 — Favorites page.
 *
 * The admin's shortlist of BAs to push first on every job. Useful
 * for ops who keep a roster of trusted "captains" they want first
 * dibs on shifts.
 *
 * Backed by the tenant-scoped favorites backend: the "Your favorites"
 * roster loads from `favoriteAmbassadors(tenantId)`, and the star on
 * each browse card drives off `Ambassador.isFavorited`. Toggling fires
 * the add/remove mutations and refetches so both lists stay in sync.
 */

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import environment from "@/api/relay/environment";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { FavoriteAmbassadorsQuery } from "@/api/queries/FavoriteAmbassadorsQuery";
import type { FavoriteAmbassadorsQuery as FavoriteAmbassadorsQueryType } from "@api/queries/__generated__/FavoriteAmbassadorsQuery.graphql";
import { AddFavoriteAmbassadorMutation } from "@/api/mutations/AddFavoriteAmbassadorMutation";
import type { AddFavoriteAmbassadorMutation as AddFavoriteAmbassadorMutationType } from "@api/mutations/__generated__/AddFavoriteAmbassadorMutation.graphql";
import { RemoveFavoriteAmbassadorMutation } from "@/api/mutations/RemoveFavoriteAmbassadorMutation";
import type { RemoveFavoriteAmbassadorMutation as RemoveFavoriteAmbassadorMutationType } from "@api/mutations/__generated__/RemoveFavoriteAmbassadorMutation.graphql";
import {
  AMBASSADOR_ROSTER_PAGE_SIZE,
  ambassadorEndCursor,
  ambassadorHasMore,
} from "@/requests/inviteBaRoster";

type Row = NonNullable<
  NonNullable<
    NonNullable<
      AmbassadorsListQueryType["response"]["ambassadors"]
    >["edges"][number]
  >["node"]
>;

type FavRow =
  FavoriteAmbassadorsQueryType["response"]["favoriteAmbassadors"][number];

const displayName = (n: Row) =>
  [n.user?.firstName, n.user?.lastName].filter(Boolean).join(" ") ||
  n.user?.email ||
  "(unnamed)";

const favName = (f: FavRow) =>
  [f.firstName, f.lastName].filter(Boolean).join(" ") ||
  f.email ||
  "(unnamed)";

const initialsFrom = (name: string, fallbackEmail?: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  const got = (a + b).toUpperCase();
  if (got) return got;
  return (fallbackEmail?.[0] ?? "?").toUpperCase();
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [search, setSearch] = useState("");
  // Bumped after every toggle so both the favorites roster and the
  // browse pool re-fetch (store-and-network) and the star state stays
  // honest with the backend.
  const [refreshKey, setRefreshKey] = useState(0);
  // Ambassador global ids with a toggle in flight — disables the star
  // so a double-tap can't fire a second mutation before the refetch.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const favData = useLazyLoadQuery<FavoriteAmbassadorsQueryType>(
    FavoriteAmbassadorsQuery,
    { tenantId: tenantId ?? null },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const baFilters = useMemo(
    () =>
      tenantId ? { tenantId, isActive: true } : { isActive: true },
    [tenantId],
  );

  // Cursor pages (People / Invite BA pattern) — no silent first:500.
  const poolData = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    {
      filters: baFilters,
      first: AMBASSADOR_ROSTER_PAGE_SIZE,
    },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const [commitAdd] = useMutation<AddFavoriteAmbassadorMutationType>(
    AddFavoriteAmbassadorMutation,
  );
  const [commitRemove] = useMutation<RemoveFavoriteAmbassadorMutationType>(
    RemoveFavoriteAmbassadorMutation,
  );

  const page1Rows = useMemo<Row[]>(() => {
    return (poolData?.ambassadors?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is Row => Boolean(n));
  }, [poolData]);

  const [extraRows, setExtraRows] = useState<Row[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const rosterKey = [
    tenantId ?? "",
    String(refreshKey),
    ambassadorEndCursor(poolData?.ambassadors?.pageInfo),
    String(Boolean(poolData?.ambassadors?.pageInfo?.hasNextPage)),
  ].join("|");

  useEffect(() => {
    setExtraRows([]);
    setEndCursor(ambassadorEndCursor(poolData?.ambassadors?.pageInfo));
    setHasMore(ambassadorHasMore(poolData?.ambassadors?.pageInfo));
    loadingMoreRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rosterKey
  }, [rosterKey]);

  const loadMore = useCallback(async () => {
    if (!endCursor || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = await fetchQuery<AmbassadorsListQueryType>(
        environment,
        AmbassadorsListQuery,
        {
          filters: baFilters,
          first: AMBASSADOR_ROSTER_PAGE_SIZE,
          after: endCursor,
        },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const mapped = (next?.ambassadors?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is Row => Boolean(n));
      setExtraRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
      });
      setEndCursor(ambassadorEndCursor(next?.ambassadors?.pageInfo));
      setHasMore(ambassadorHasMore(next?.ambassadors?.pageInfo));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [endCursor, hasMore, baFilters]);

  const all = useMemo<Row[]>(() => {
    const seen = new Set(page1Rows.map((r) => r.id));
    return [
      ...page1Rows,
      ...extraRows.filter((r) => !seen.has(r.id)),
    ];
  }, [page1Rows, extraRows]);

  const totalPool = poolData?.ambassadors?.totalCount ?? all.length;

  const favs = useMemo<FavRow[]>(
    () => [...(favData?.favoriteAmbassadors ?? [])],
    [favData],
  );

  // Browse list = the active pool minus anyone already favorited (the
  // star field is the source of truth), then name/email/market search.
  const others = useMemo(() => {
    const q = search.toLowerCase().trim();
    const candidates = all.filter((n) => !n.isFavorited);
    if (!q) return candidates;
    return candidates.filter(
      (n) =>
        displayName(n).toLowerCase().includes(q) ||
        (n.user?.email ?? "").toLowerCase().includes(q) ||
        (n.address ?? "").toLowerCase().includes(q),
    );
  }, [all, search]);

  // Average rating across the favorited BAs we can see in the active
  // pool (the favorites rows don't carry rating). Falls back to "—".
  const avgRating = useMemo(() => {
    const ratings = all
      .filter((n) => n.isFavorited)
      .map((n) => Number(n.rating))
      .filter((r) => Number.isFinite(r) && r > 0);
    if (ratings.length === 0) return null;
    return ratings.reduce((s, v) => s + v, 0) / ratings.length;
  }, [all]);

  const setPendingFor = (id: string, on: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const addFav = (id: string, name: string) => {
    if (pending.has(id)) return;
    setPendingFor(id, true);
    commitAdd({
      variables: { input: { ambassadorId: id, tenantId: tenantId ?? null } },
      onCompleted: (resp) => {
        setPendingFor(id, false);
        const r = resp.addFavoriteAmbassador;
        if (r?.success) {
          showAlert(`Starred ${name}.`, "success");
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || `Couldn't star ${name}.`, "error");
        }
      },
      onError: (err) => {
        setPendingFor(id, false);
        showAlert(`${name}: ${err.message}`, "error");
      },
    });
  };

  const removeFav = (id: string, name: string) => {
    if (pending.has(id)) return;
    setPendingFor(id, true);
    commitRemove({
      variables: { input: { ambassadorId: id, tenantId: tenantId ?? null } },
      onCompleted: (resp) => {
        setPendingFor(id, false);
        const r = resp.removeFavoriteAmbassador;
        if (r?.success) {
          showAlert(`Removed ${name} from favorites.`, "info");
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || `Couldn't remove ${name}.`, "error");
        }
      },
      onError: (err) => {
        setPendingFor(id, false);
        showAlert(`${name}: ${err.message}`, "error");
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
          }}
        >
          FAVORITES · {favs.length} BAs
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          First in line.
        </h1>
        <p
          className="mt-2"
          style={{ color: "var(--spark-text-meta)" }}
        >
          BAs you've starred — Spark surfaces them first on every
          applicant pool. Saved to your workspace, so the roster
          follows your whole team.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="FAVORITED" value={favs.length} highlight />
        <Kpi label="ACTIVE POOL" value={all.length} />
        <Kpi
          label="AVG RATING"
          value={avgRating != null ? avgRating.toFixed(2) : "—"}
          highlight
        />
        <Kpi label="UNFILED" value={others.length} />
      </div>

      {/* Favorites grid */}
      <div>
        <h2
          className="display text-xl font-bold mb-3"
          style={{ letterSpacing: "-0.02em" }}
        >
          Your favorites
        </h2>
        {favs.length === 0 ? (
          <SparkEmptyState
            title="No favorites yet"
            body="Star a BA below to add them."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favs.map((f) => (
              <FavCard
                key={f.uuid}
                row={f}
                busy={pending.has(String(f.ambassadorId))}
                onToggle={() =>
                  removeFav(String(f.ambassadorId), favName(f))
                }
                onClick={() => navigate(`/talent`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search + browse */}
      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h2
            className="display text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Browse all BAs
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or market…"
            className="rounded-xl text-sm w-full max-w-sm"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              padding: "0.6rem 0.95rem",
            }}
          />
        </div>
        {others.length === 0 ? (
          all.length === 0 ? (
            <SparkEmptyState title="No active BAs in this workspace yet." />
          ) : (
            <SparkEmptyState title="No matches." />
          )
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((n) => (
              <BaCard
                key={n.id}
                row={n}
                busy={pending.has(String(n.id))}
                onToggle={() => addFav(String(n.id), displayName(n))}
                onClick={() => navigate(`/talent`)}
              />
            ))}
          </div>
        )}
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "rgba(242,243,238,0.08)",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {loadingMore
                ? "Loading…"
                : `Load more · ${all.length} of ${totalPool}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="spark-card p-4">
    <p
      className="mono text-[10px]"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-text-meta)",
      }}
    >
      {label}
    </p>
    <p
      className="tab-num text-3xl font-bold mt-1"
      style={{ color: highlight ? "var(--spark-lime)" : undefined }}
    >
      {value}
    </p>
  </div>
);

const StarButton: React.FC<{
  isFav: boolean;
  busy: boolean;
  onToggle: () => void;
}> = ({ isFav, busy, onToggle }) => (
  <button
    onClick={onToggle}
    disabled={busy}
    aria-label={isFav ? "Unstar" : "Star"}
    className="mono text-lg transition"
    style={{
      background: "transparent",
      border: "none",
      color: isFav ? "var(--spark-lime)" : "rgba(255,255,255,0.30)",
      cursor: busy ? "default" : "pointer",
      opacity: busy ? 0.5 : 1,
    }}
    title={isFav ? "Remove from favorites" : "Add to favorites"}
  >
    ★
  </button>
);

const FavCard: React.FC<{
  row: FavRow;
  busy: boolean;
  onToggle: () => void;
  onClick: () => void;
}> = ({ row, busy, onToggle, onClick }) => {
  const name = favName(row);
  return (
    <div className="spark-card p-5">
      <div className="flex items-start gap-3">
        <div
          className="display font-bold"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(242,243,238,0.10)",
            color: "var(--spark-lime)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          {initialsFrom(name, row.email)}
        </div>
        <button
          onClick={onClick}
          className="flex-1 min-w-0 text-left"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <p className="text-sm font-semibold truncate">{name}</p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {row.email || "—"}
          </p>
        </button>
        <StarButton isFav busy={busy} onToggle={onToggle} />
      </div>
      {row.note ? (
        <p
          className="text-xs mt-3"
          style={{
            color: "var(--spark-text-meta)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "0.6rem",
          }}
        >
          {row.note}
        </p>
      ) : null}
    </div>
  );
};

const BaCard: React.FC<{
  row: Row;
  busy: boolean;
  onToggle: () => void;
  onClick: () => void;
}> = ({ row, busy, onToggle, onClick }) => {
  const rating = Number(row.rating);
  const ratingText = Number.isFinite(rating) && rating > 0
    ? rating.toFixed(1)
    : "—";
  return (
    <div className="spark-card p-5">
      <div className="flex items-start gap-3">
        <div
          className="display font-bold"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(242,243,238,0.10)",
            color: "var(--spark-lime)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
          }}
        >
          {initialsFrom(displayName(row), row.user?.email ?? undefined)}
        </div>
        <button
          onClick={onClick}
          className="flex-1 min-w-0 text-left"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <p className="text-sm font-semibold truncate">
            {displayName(row)}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {row.address ?? row.user?.email ?? "—"}
          </p>
        </button>
        <StarButton isFav={row.isFavorited} busy={busy} onToggle={onToggle} />
      </div>
      <div
        className="flex items-center justify-between mt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-lime)",
          }}
        >
          ★ {ratingText}
        </span>
        <span
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-text-meta)",
          }}
        >
          {row.isActive ? "ACTIVE" : "INACTIVE"}
        </span>
      </div>
    </div>
  );
};

export default function SparkFavorites() {
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Favorites is a Spark Admin surface.
          </p>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading favorites…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
