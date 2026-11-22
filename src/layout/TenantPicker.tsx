import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { commitMutation, fetchQuery } from "relay-runtime";
import { ChevronDownIcon, StarIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";
import environment from "@/api/relay/environment";
import { PilotQueriesWorkspaceContextsQuery } from "@/api/queries/PilotQueries";
import { PilotMutationsSwitchContextMutation } from "@/api/mutations/PilotMutations";
import type { PilotQueriesWorkspaceContextsQuery as ContextsQueryType } from "@/api/queries/__generated__/PilotQueriesWorkspaceContextsQuery.graphql";
import type { PilotMutationsSwitchContextMutation as SwitchMutationType } from "@/api/mutations/__generated__/PilotMutationsSwitchContextMutation.graphql";
import { fetchSwitchableTenants } from "@/hooks/useAdoptRecordTenant";
import useSparkRole from "@/hooks/useSparkRole";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import {
  buildUnifiedWorkspaceOptions,
  formatSingleWorkspaceBadgeLabel,
  formatWorkspaceOptionSubtitle,
  resolveActiveWorkspaceContextKey,
  workspaceOptionMatchesQuery,
  type UnifiedWorkspaceOption,
  type WorkspaceContextItem,
} from "@/pilot/pilotHelpers";
import { useAuthStore } from "@/store/authStore";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import { useMobileNav } from "./MobileNavContext";
import { TenantLogo } from "./TenantLogo.tsx";
import {
  groupTenantsByLetter,
  loadTenantFavorites,
  loadTenantRecents,
  TENANT_PICKER_MAX_FAVORITES,
  toggleTenantFavorite,
} from "./tenantPickerPrefs";
import {
  captureWorkspaceSnapshot,
  restoreWorkspaceSnapshot,
  switchWorkspace,
} from "./workspaceSwitch";

/**
 * Unified workspace switcher in the Spark sidebar (desktop + mobile drawer).
 *
 * Consolidates Ignite staff managed brands and multi-brand agency memberships
 * into one authoritative control:
 * - Single-workspace clients see a clean, static non-interactive pill.
 * - Multi-workspace agency users & Ignite staff get search, Favorites, Recents,
 *   A–Z grouping, `[ARCHIVED]` filtering, instant zero-reload `switchWorkspace`,
 *   and optimistic snapshot rollback if `switchWorkspaceContext` fails.
 */

const sectionLabel =
  "mono sticky top-0 z-[1] px-2 py-1.5 text-[9px] tracking-[0.16em] text-base-content/50 bg-[color-mix(in_srgb,var(--spark-surface,#141416)_94%,transparent)] backdrop-blur-sm";

export interface WorkspaceSwitcherViewProps {
  options: readonly UnifiedWorkspaceOption[];
  tenantUuid?: string | null;
  membershipUuid?: string | null;
  switching?: boolean;
  fallbackName?: string | null;
  fallbackLogo?: string | null;
  fallbackRequestUrlName?: string | null;
  fallbackTenantSlug?: string | null;
  defaultOpen?: boolean;
  defaultQuery?: string;
  onSelectOption: (option: UnifiedWorkspaceOption) => void;
  onOpenChange?: (open: boolean) => void;
}

export const WorkspaceSwitcherView: React.FC<WorkspaceSwitcherViewProps> = ({
  options,
  tenantUuid = null,
  membershipUuid = null,
  switching = false,
  fallbackName = null,
  fallbackLogo = null,
  fallbackRequestUrlName = null,
  fallbackTenantSlug = null,
  defaultOpen = false,
  defaultQuery = "",
  onSelectOption,
  onOpenChange,
}) => {
  const [open, setOpenState] = useState(defaultOpen);
  const [query, setQuery] = useState(defaultQuery);
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadTenantFavorites(),
  );
  const [recents, setRecents] = useState<string[]>(() => loadTenantRecents());
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (value !== prev) {
          onOpenChange?.(value);
        }
        return value;
      });
    },
    [onOpenChange],
  );

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
  }, [open, setOpen]);

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

  const activeKey = useMemo(
    () =>
      resolveActiveWorkspaceContextKey(options, {
        tenantUuid,
        membershipUuid,
      }),
    [options, tenantUuid, membershipUuid],
  );

  const duplicateTenantUuids = useMemo(() => {
    const counts = new Map<string, number>();
    for (const opt of options) {
      counts.set(opt.tenantUuid, (counts.get(opt.tenantUuid) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [uuid, count] of counts.entries()) {
      if (count > 1) dups.add(uuid);
    }
    return dups;
  }, [options]);

  const filtered = useMemo(
    () => options.filter((opt) => workspaceOptionMatchesQuery(opt, query)),
    [options, query],
  );

  const favoriteRows = useMemo(() => {
    const rows: UnifiedWorkspaceOption[] = [];
    const added = new Set<string>();
    for (const uuid of favorites) {
      for (const opt of filtered) {
        if (opt.tenantUuid === uuid && !added.has(opt.key)) {
          added.add(opt.key);
          rows.push(opt);
        }
      }
    }
    return rows;
  }, [favorites, filtered]);

  const recentRows = useMemo(() => {
    const favKeys = new Set(favoriteRows.map((r) => r.key));
    const rows: UnifiedWorkspaceOption[] = [];
    const added = new Set<string>();
    for (const uuid of recents) {
      for (const opt of filtered) {
        if (
          opt.tenantUuid === uuid &&
          opt.key !== activeKey &&
          !favKeys.has(opt.key) &&
          !added.has(opt.key)
        ) {
          added.add(opt.key);
          rows.push(opt);
        }
      }
    }
    return rows;
  }, [recents, filtered, activeKey, favoriteRows]);

  const remainingRows = useMemo(() => {
    const shown = new Set(favoriteRows.map((t) => t.key));
    if (!query.trim()) {
      for (const t of recentRows) shown.add(t.key);
    }
    return filtered.filter((t) => !shown.has(t.key));
  }, [filtered, favoriteRows, recentRows, query]);

  const useLetterGrouping = options.length > 6;
  const letterGroups = useMemo(
    () => (useLetterGrouping ? groupTenantsByLetter(remainingRows) : []),
    [useLetterGrouping, remainingRows],
  );

  if (options.length === 0) {
    const label = (fallbackName ?? "").trim();
    if (!label) return null;
    return (
      <div
        data-testid="workspace-single-pill"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300"
        title={label}
      >
        <TenantLogo
          name={label}
          requestUrlName={fallbackRequestUrlName}
          tenantSlug={fallbackTenantSlug}
          image={fallbackLogo}
          active
        />
        <span className="text-sm truncate flex-1 text-left">{label}</span>
      </div>
    );
  }

  if (options.length === 1) {
    const single = options[0];
    const badgeLabel =
      formatSingleWorkspaceBadgeLabel({
        tenantName: single.name,
        providerName: single.providerName,
        displayLabel: single.displayLabel,
      }) || single.name;
    return (
      <div
        data-testid="workspace-single-pill"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300"
        title={single.displayLabel}
      >
        <TenantLogo
          name={single.name}
          requestUrlName={single.requestUrlName}
          tenantSlug={single.tenantSlug}
          image={single.logo}
          active
        />
        <span className="text-sm truncate flex-1 text-left">{badgeLabel}</span>
      </div>
    );
  }

  const current = options.find((o) => o.key === activeKey) ?? options[0];
  const currentHasDup = duplicateTenantUuids.has(current.tenantUuid);
  const triggerSubtitle =
    current.providerName || currentHasDup
      ? formatWorkspaceOptionSubtitle(current, {
          hasDuplicateTenant: currentHasDup,
        })
      : null;

  const handlePick = (opt: UnifiedWorkspaceOption) => {
    setOpen(false);
    onSelectOption(opt);
    setRecents(loadTenantRecents());
  };

  const onToggleFavorite = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites(toggleTenantFavorite(uuid));
  };

  const renderRow = (opt: UnifiedWorkspaceOption) => {
    const active = opt.key === activeKey;
    const pinned = favorites.includes(opt.tenantUuid);
    const subtitle = formatWorkspaceOptionSubtitle(opt, {
      hasDuplicateTenant: duplicateTenantUuids.has(opt.tenantUuid),
    });

    return (
      <div
        key={opt.key}
        className={[
          "w-full flex items-center gap-1 rounded-md text-sm transition",
          active
            ? "bg-primary/15 text-primary font-semibold"
            : "hover:bg-base-300/40 text-base-content/85",
        ].join(" ")}
      >
        <button
          type="button"
          role="option"
          aria-selected={active}
          data-workspace-key={opt.key}
          onClick={() => handlePick(opt)}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-left"
        >
          <TenantLogo
            name={opt.name}
            requestUrlName={opt.requestUrlName}
            tenantSlug={opt.tenantSlug}
            image={opt.logo}
            active={active}
          />
          <span className="truncate flex-1 min-w-0">
            <span className="block truncate">{opt.name}</span>
            {subtitle ? (
              <span className="block truncate mono text-[9px] tracking-[0.08em] text-base-content/50 font-normal">
                {subtitle}
              </span>
            ) : null}
          </span>
          {active && (
            <span className="mono text-[9px] tracking-[0.16em] text-primary shrink-0">
              ACTIVE
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label={pinned ? "Unpin workspace" : "Pin workspace"}
          title={
            pinned
              ? "Unpin"
              : favorites.length >= TENANT_PICKER_MAX_FAVORITES
                ? `Pin up to ${TENANT_PICKER_MAX_FAVORITES}`
                : "Pin to Favorites"
          }
          onClick={(e) => onToggleFavorite(e, opt.tenantUuid)}
          className="shrink-0 p-2 rounded-md hover:bg-base-300/50 text-base-content/45 hover:text-primary"
        >
          {pinned ? (
            <StarIcon className="w-3.5 h-3.5 text-primary" />
          ) : (
            <StarOutlineIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        data-testid="workspace-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch workspace"
        aria-busy={switching || undefined}
        onClick={() => setOpen((v) => !v)}
        className="spark-focus-ring w-full flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300 hover:border-primary/40 transition"
        title={current.displayLabel}
      >
        <TenantLogo
          name={current.name}
          requestUrlName={current.requestUrlName}
          tenantSlug={current.tenantSlug}
          image={current.logo}
          active
        />
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm truncate">{current.name}</span>
          {triggerSubtitle ? (
            <span className="block mono text-[9px] tracking-[0.08em] text-base-content/55 truncate">
              {triggerSubtitle}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 text-base-content/60 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available workspaces"
          className="spark-popover absolute left-0 right-0 top-full mt-1 z-50 max-h-[min(65vh,34rem)] overflow-y-auto p-1"
        >
          <div className="sticky top-0 z-[2] p-1 mb-1 bg-[color-mix(in_srgb,var(--spark-surface,#141416)_96%,transparent)] backdrop-blur-sm">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter workspaces…"
              aria-label="Filter workspaces"
              className="w-full px-3 py-2 rounded-md text-sm bg-base-300/50 border border-base-300 focus:border-primary/50 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length === 1) {
                  e.preventDefault();
                  handlePick(filtered[0]);
                }
              }}
            />
          </div>

          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-base-content/60">
              No workspaces match “{query.trim()}”
            </div>
          )}

          {favoriteRows.length > 0 && (
            <div className="mb-1">
              <div className={sectionLabel}>FAVORITES</div>
              {favoriteRows.map((opt) => renderRow(opt))}
            </div>
          )}

          {recentRows.length > 0 && (
            <div className="mb-1">
              <div className={sectionLabel}>RECENT</div>
              {recentRows.map((opt) => renderRow(opt))}
            </div>
          )}

          {useLetterGrouping
            ? letterGroups.map(({ letter, tenants: rows }) => (
                <div key={letter} className="mb-0.5">
                  <div className={sectionLabel}>{letter}</div>
                  {rows.map((opt) => renderRow(opt))}
                </div>
              ))
            : remainingRows.length > 0 && (
                <div className="mb-0.5">
                  {(favoriteRows.length > 0 || recentRows.length > 0) && (
                    <div className={sectionLabel}>WORKSPACES</div>
                  )}
                  {remainingRows.map((opt) => renderRow(opt))}
                </div>
              )}
        </div>
      )}
    </div>
  );
};

export const TenantPicker: React.FC = () => {
  const {
    isAuthenticated,
    user,
    tenantUuid,
    tenantSlug,
    tenantMeta,
    membershipUuid,
  } = useAuthStore();
  const { isClient } = useSparkRole();
  const { setOpen: setMobileNavOpen } = useMobileNav();
  const location = useLocation();
  const navigate = useNavigate();

  const [contexts, setContexts] = useState<readonly WorkspaceContextItem[]>([]);
  const [tenants, setTenants] = useState<readonly SwitchableTenant[]>([]);
  const [switching, setSwitching] = useState(false);
  const inFlightRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshWorkspaceData = useCallback(
    (userUuid: string | null | undefined) => {
      fetchQuery<ContextsQueryType>(
        environment,
        PilotQueriesWorkspaceContextsQuery,
        {},
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((res) => {
          if (!mountedRef.current || !res?.myWorkspaceContexts) return;
          setContexts(res.myWorkspaceContexts);
        })
        .catch(() => {
          /* non-blocking: TenantQuery rows remain usable */
        });

      fetchSwitchableTenants(environment, userUuid)
        .then((rows) => {
          if (!mountedRef.current) return;
          setTenants(rows);
        })
        .catch(() => {
          /* external agency memberships intentionally have no TenantQuery rows */
        });
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setContexts([]);
      setTenants([]);
      return;
    }
    refreshWorkspaceData(user?.uuid);
  }, [isAuthenticated, user?.uuid, refreshWorkspaceData]);

  const visibleOptions = useMemo(
    () =>
      buildUnifiedWorkspaceOptions({
        contexts,
        tenants,
        active: { tenantUuid, membershipUuid },
      }),
    [contexts, tenants, tenantUuid, membershipUuid],
  );

  const activeKey = useMemo(
    () =>
      resolveActiveWorkspaceContextKey(visibleOptions, {
        tenantUuid,
        membershipUuid,
      }),
    [visibleOptions, tenantUuid, membershipUuid],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && isAuthenticated) {
        refreshWorkspaceData(user?.uuid);
      }
    },
    [isAuthenticated, user?.uuid, refreshWorkspaceData],
  );

  const handleSelectOption = (chosen: UnifiedWorkspaceOption) => {
    setMobileNavOpen(false);
    if (chosen.key === activeKey) return;

    const previousSnapshot = captureWorkspaceSnapshot(location);

    const switchedPath = switchWorkspace(
      {
        id: chosen.tenantId,
        uuid: chosen.tenantUuid,
        name: chosen.name,
        logo: chosen.logo,
        requestUrlName: chosen.requestUrlName,
        tenantSlug: chosen.tenantSlug,
        checkinCode: chosen.checkinCode,
      },
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        isClient,
        membershipUuid: chosen.membershipUuid,
        workspaceRole: chosen.workspaceRole,
        navigate,
      },
    );

    if (!chosen.tenantId) {
      void fetchSwitchableTenants(environment, user?.uuid)
        .then((rows) => {
          if (mountedRef.current) setTenants(rows);
          const hydrated = rows.find((r) => r.uuid === chosen.tenantUuid);
          if (
            hydrated &&
            useAuthStore.getState().tenantUuid === chosen.tenantUuid
          ) {
            useAuthStore
              .getState()
              .setTenant(
                hydrated.uuid,
                hydrated.id,
                hydrated.logo ?? null,
                hydrated.requestUrlName ?? null,
                hydrated.tenantSlug ?? chosen.tenantSlug ?? null,
                hydrated.checkinCode ?? null,
              );
          }
        })
        .catch(() => {
          /* external agency context has no TenantQuery row */
        });
    }

    if (!chosen.fromWorkspaceContext && chosen.membershipUuid === null) {
      return;
    }

    inFlightRef.current += 1;
    setSwitching(true);

    const finishSwitch = () => {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (mountedRef.current && inFlightRef.current === 0) {
        setSwitching(false);
      }
    };

    const rollbackIfStillOnTarget = () => {
      const current = useAuthStore.getState();
      if (
        current.tenantUuid === chosen.tenantUuid &&
        (current.membershipUuid ?? null) === (chosen.membershipUuid ?? null)
      ) {
        restoreWorkspaceSnapshot(previousSnapshot, {
          currentFullPath: switchedPath,
          navigate,
        });
      }
    };

    commitMutation<SwitchMutationType>(environment, {
      mutation: PilotMutationsSwitchContextMutation,
      variables: {
        membershipUuid: chosen.membershipUuid,
        tenantUuid: chosen.tenantUuid,
      },
      onCompleted: (resp) => {
        finishSwitch();
        if (!resp?.switchWorkspaceContext?.ok) {
          rollbackIfStillOnTarget();
        }
      },
      onError: () => {
        finishSwitch();
        rollbackIfStillOnTarget();
      },
    });
  };

  const fallbackName =
    tenantDisplayName(tenantMeta?.requestUrlName, tenantSlug) || null;

  return (
    <WorkspaceSwitcherView
      options={visibleOptions}
      tenantUuid={tenantUuid}
      membershipUuid={membershipUuid}
      switching={switching}
      fallbackName={fallbackName}
      fallbackLogo={tenantMeta?.logo ?? null}
      fallbackRequestUrlName={tenantMeta?.requestUrlName ?? null}
      fallbackTenantSlug={tenantSlug}
      onSelectOption={handleSelectOption}
      onOpenChange={handleOpenChange}
    />
  );
};

export default TenantPicker;
