import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { ChevronDownIcon, StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";
import { TenantLogo } from "./TenantLogo";
import {
  groupTenantsByLetter,
  loadTenantFavorites,
  loadTenantRecents,
  rememberTenantRecent,
  tenantMatchesQuery,
  TENANT_PICKER_MAX_FAVORITES,
  toggleTenantFavorite,
} from "./tenantPickerPrefs";

/**
 * Inline tenant switcher for the Spark v2 sidebar.
 * Search filters by name + slug; Favorites / Recents sit above an A–Z list.
 * Switching reloads so Relay queries refetch under the new tenant.
 */

type TenantNode = {
  id: string;
  uuid: string;
  name: string | null;
  requestUrlName?: string | null;
  tenantSlug?: string | null;
  checkinCode?: string | null;
  image?: string | null;
};

const sectionLabel =
  "mono sticky top-0 z-[1] px-2 py-1.5 text-[9px] tracking-[0.16em] text-base-content/45 bg-[color-mix(in_srgb,var(--spark-surface,#0f1310)_92%,transparent)] backdrop-blur-sm";

export const TenantPicker: React.FC = () => {
  const { user, tenantUuid } = useAuthStore();
  const { selectTenant } = useTenantSelection();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadTenantFavorites(),
  );
  const [recents, setRecents] = useState<string[]>(() => loadTenantRecents());
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    setFavorites(loadTenantFavorites());
    setRecents(loadTenantRecents());
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const data = useLazyLoadQuery<TenantQueryType>(
    TenantQuery,
    { userUuid: user?.uuid ?? "" },
    { fetchPolicy: "store-or-network" },
  );

  const tenants: TenantNode[] =
    data?.tenants?.edges
      ?.map((e) => e?.node)
      ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
      ?.map((n) => ({
        id: n.id,
        uuid: String(n.uuid),
        name: n.name ?? null,
        requestUrlName: n.requestUrlName ?? null,
        tenantSlug: n.tenantSlug ?? null,
        checkinCode: n.checkinCode ?? null,
        image: n.image ?? null,
      })) ?? [];

  const byUuid = useMemo(() => {
    const map = new Map<string, TenantNode>();
    for (const t of tenants) map.set(t.uuid, t);
    return map;
  }, [tenants]);

  const filtered = useMemo(
    () => tenants.filter((t) => tenantMatchesQuery(t, query)),
    [tenants, query],
  );

  const favoriteRows = useMemo(
    () =>
      favorites
        .map((uuid) => byUuid.get(uuid))
        .filter((t): t is TenantNode => Boolean(t))
        .filter((t) => tenantMatchesQuery(t, query)),
    [favorites, byUuid, query],
  );

  const recentRows = useMemo(
    () =>
      recents
        .map((uuid) => byUuid.get(uuid))
        .filter((t): t is TenantNode => Boolean(t))
        .filter((t) => t.uuid !== tenantUuid)
        .filter((t) => !favorites.includes(t.uuid))
        .filter((t) => tenantMatchesQuery(t, query)),
    [recents, byUuid, tenantUuid, favorites, query],
  );

  const letterGroups = useMemo(() => {
    const shown = new Set(favoriteRows.map((t) => t.uuid));
    if (!query.trim()) {
      for (const t of recentRows) shown.add(t.uuid);
    }
    return groupTenantsByLetter(
      filtered.filter((t) => !shown.has(t.uuid)),
    );
  }, [filtered, favoriteRows, recentRows, query]);

  const current = tenants.find((t) => t.uuid === tenantUuid) ?? tenants[0];

  const onPick = (t: TenantNode) => {
    rememberTenantRecent(t.uuid);
    setRecents(loadTenantRecents());
    selectTenant({
      tenantUuid: t.uuid,
      tenantId: t.id,
      logo: t.image,
      requestUrlName: t.requestUrlName,
      tenantSlug: t.tenantSlug,
      checkinCode: t.checkinCode,
    });
    setOpen(false);
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 50);
  };

  const onToggleFavorite = (
    e: React.MouseEvent,
    uuid: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites(toggleTenantFavorite(uuid));
  };

  const renderRow = (t: TenantNode, opts?: { showStar?: boolean }) => {
    const active = t.uuid === tenantUuid;
    const pinned = favorites.includes(t.uuid);
    const showStar = opts?.showStar !== false;
    return (
      <div
        key={t.uuid}
        className={[
          "w-full flex items-center gap-1 rounded-md text-sm transition",
          active
            ? "bg-primary/15 text-primary font-semibold"
            : "hover:bg-base-300/40 text-base-content/80",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onPick(t)}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-left"
        >
          <TenantLogo
            name={t.name}
            requestUrlName={t.requestUrlName}
            tenantSlug={t.tenantSlug}
            image={t.image}
            active={active}
          />
          <span className="truncate flex-1 min-w-0">
            <span className="block truncate">{t.name ?? "—"}</span>
            {t.tenantSlug || t.requestUrlName ? (
              <span className="block truncate mono text-[9px] tracking-[0.08em] text-base-content/40 font-normal">
                {t.tenantSlug || t.requestUrlName}
              </span>
            ) : null}
          </span>
          {active && (
            <span className="mono text-[9px] tracking-[0.16em] text-primary shrink-0">
              ACTIVE
            </span>
          )}
        </button>
        {showStar ? (
          <button
            type="button"
            aria-label={pinned ? "Unpin client" : "Pin client"}
            title={
              pinned
                ? "Unpin"
                : favorites.length >= TENANT_PICKER_MAX_FAVORITES
                  ? `Pin up to ${TENANT_PICKER_MAX_FAVORITES}`
                  : "Pin to Favorites"
            }
            onClick={(e) => onToggleFavorite(e, t.uuid)}
            className="shrink-0 p-2 rounded-md hover:bg-base-300/50 text-base-content/40 hover:text-primary"
          >
            {pinned ? (
              <StarIcon className="w-3.5 h-3.5 text-primary" />
            ) : (
              <StarOutlineIcon className="w-3.5 h-3.5" />
            )}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300 hover:border-primary/40 transition"
      >
        <TenantLogo
          name={current?.name}
          requestUrlName={current?.requestUrlName}
          tenantSlug={current?.tenantSlug}
          image={current?.image}
          active
        />
        <span className="text-sm truncate flex-1 text-left">
          {current?.name ?? "Select tenant"}
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 text-base-content/55 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="spark-popover absolute left-0 right-0 top-full mt-1 z-50 max-h-[min(70vh,34rem)] overflow-y-auto p-1">
          <div className="sticky top-0 z-[2] p-1 mb-1 bg-[color-mix(in_srgb,var(--spark-surface,#0f1310)_96%,transparent)] backdrop-blur-sm">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter clients…"
              aria-label="Filter clients"
              className="w-full px-3 py-2 rounded-md text-sm bg-base-300/50 border border-base-300 focus:border-primary/50 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length === 1) {
                  e.preventDefault();
                  onPick(filtered[0]);
                }
              }}
            />
          </div>

          {tenants.length === 0 && (
            <div className="px-3 py-2 text-xs text-base-content/55">
              No tenants
            </div>
          )}

          {tenants.length > 0 && filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-base-content/55">
              No clients match “{query.trim()}”
            </div>
          )}

          {favoriteRows.length > 0 && (
            <div className="mb-1">
              <div className={sectionLabel}>FAVORITES</div>
              {favoriteRows.map((t) => renderRow(t))}
            </div>
          )}

          {recentRows.length > 0 && (
            <div className="mb-1">
              <div className={sectionLabel}>RECENT</div>
              {recentRows.map((t) => renderRow(t))}
            </div>
          )}

          {letterGroups.map(({ letter, tenants: rows }) => (
            <div key={letter} className="mb-0.5">
              <div className={sectionLabel}>{letter}</div>
              {rows.map((t) => renderRow(t))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantPicker;
