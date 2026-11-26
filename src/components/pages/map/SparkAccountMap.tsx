import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanelSkeleton } from "@/layout/PageSkeletons";
import { useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { AccountMapQuery } from "@/api/queries/AccountMapQuery";
import type { AccountMapQuery as AccountMapQueryType } from "@api/queries/__generated__/AccountMapQuery.graphql";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { prefersReducedMotion } from "@/shared/map/mapFit";
import { COVERAGE_MARK } from "@/shared/map/markerIcons";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkFilterBar from "@/shared/SparkFilterBar";
import {
  ACCOUNT_MAP_PAGE_SIZE,
  accountMapPageSize,
  accountMapTruncation,
} from "./accountMapPages";
import useSparkRole from "@/hooks/useSparkRole";
import {
  buildStores,
  filterStores,
  hasFilters,
  marketOptions,
  noPositionWords,
  retailerChainKey,
  retailerOptions,
  stateOptions,
  storeCounts,
  storesFitKey,
  storesWord,
  type CoverageFilter,
  type PinRow,
  type Store,
  type StoreFilters,
} from "./accountStores";
import AccountMapView, { CoverageLegend, CoverageMark } from "./AccountMapView";
import AccountUploader from "./AccountUploader";
import SampleNextList from "@/components/explain/SampleNextList";
import { useAccountList } from "./useAccountList";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import WaveScheduleSheet from "./WaveScheduleSheet";
import type { WaveTargetStore } from "./waveSchedule";

/**
 * Account Map: every store a brand works with, one pin per physical store.
 *
 * Pins come from the brand's requests (a request with no coordinates of its
 * own is placed from its event's position) and from the brand's uploaded
 * account list. The map and the list beside it show the same stores, and
 * each leads to the other. All of the deciding happens in accountStores.ts.
 *
 * Set VITE_GOOGLE_MAPS_API_KEY to draw the map; without it the list still
 * works and the map area says why it is empty.
 */

type MapPin = NonNullable<
  NonNullable<AccountMapQueryType["response"]["accountMapPins"]>[number]
>;

function shortDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The list draws this many rows; past that, searching is the way in. */
const LIST_ROWS = 200;

const coverageFilterFromParam = (raw: string | null): CoverageFilter => {
  switch ((raw ?? "").toLowerCase()) {
    case "sampled":
      return "sampled";
    case "repeat":
      return "repeat";
    case "never_visited":
    case "never-visited":
    case "never":
      return "never_visited";
    case "planned":
      return "planned";
    default:
      return "all";
  }
};

function StoreRow({
  store,
  selected,
  checkedForWave,
  onToggleWave,
  onShowOnMap,
  onSchedule,
  onOpenProfile,
  rowRef,
}: {
  store: Store;
  selected: boolean;
  checkedForWave: boolean;
  onToggleWave: (store: Store) => void;
  onShowOnMap: (key: string) => void;
  onSchedule: (store: Store) => void;
  onOpenProfile: (store: Store) => void;
  rowRef: (el: HTMLLIElement | null) => void;
}) {
  const onMap = store.position !== null;
  const body = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">
        <CoverageMark coverage={store.coverage} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{store.name}</p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {COVERAGE_MARK[store.coverage].label}
          {store.planned ? " · Visit planned" : null}
          {store.market ? (
            <span style={{ color: "var(--spark-text-meta)" }}> · {store.market}</span>
          ) : null}
        </p>
        {store.address ? (
          <p className="text-xs mt-1 truncate" style={{ color: "var(--spark-text-meta)" }}>
            {store.address}
          </p>
        ) : null}
        {store.source === "requests" ? (
          <p className="text-xs mt-1" style={{ color: "var(--spark-text-secondary)" }}>
            {shortDay(store.lastVisitDate)
              ? `Last demo ${shortDay(store.lastVisitDate)}`
              : "No demo filed yet"}
          </p>
        ) : null}
      </div>
    </div>
  );
  return (
    <li
      ref={rowRef}
      aria-current={selected ? "true" : undefined}
      style={{
        borderBottom: "1px solid var(--spark-border)",
        background:
          selected || checkedForWave
            ? "rgba(var(--spark-ink-rgb), 0.04)"
            : undefined,
        boxShadow: selected
          ? "inset 3px 0 0 var(--spark-text)"
          : checkedForWave
            ? "inset 3px 0 0 var(--spark-ok-ink)"
            : undefined,
      }}
    >
      <div className="flex items-start">
        <label
          className="pl-3.5 pt-3.5 pr-1 flex items-center cursor-pointer shrink-0"
          title={`Select ${store.name} for multi-store wave`}
        >
          <input
            type="checkbox"
            checked={checkedForWave}
            onChange={() => onToggleWave(store)}
            aria-label={`Select ${store.name}`}
            className="cursor-pointer"
          />
        </label>
        <div className="flex-1 min-w-0">
          {onMap ? (
            <button
              type="button"
              onClick={() => onShowOnMap(store.key)}
              title="Show on the map"
              className="spark-row-hover block w-full text-left pl-2 pr-4 pt-3 pb-1.5 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2"
              style={{ color: "var(--spark-text)", outlineColor: "var(--spark-text)" }}
            >
              {body}
            </button>
          ) : (
            <div className="pl-2 pr-4 pt-3 pb-1.5">{body}</div>
          )}
          <p
            className="flex flex-wrap gap-x-3 pr-4 pb-3 pl-[38px] text-xs"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {onMap ? null : <span>{noPositionWords(store.positionStatus)}</span>}
            <button
              type="button"
              onClick={() => onOpenProfile(store)}
              className="underline"
              style={{
                color: "var(--spark-text-secondary)",
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
              }}
            >
              Store profile
            </button>
            <button
              type="button"
              onClick={() => onSchedule(store)}
              className="underline"
              style={{
                color: "var(--spark-text-secondary)",
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
              }}
            >
              Schedule a visit
            </button>
          </p>
        </div>
      </div>
    </li>
  );
}

const selectStyle: React.CSSProperties = { maxWidth: 220 };

const Inner: React.FC<{ apiKey: string | undefined }> = ({ apiKey }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenantId } = useAuthStore();
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);

  const [coverage, setCoverage] = useState<CoverageFilter>(() =>
    coverageFilterFromParam(searchParams.get("coverage")),
  );
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [stateFilter, setStateFilter] = useState("all");
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [extraPins, setExtraPins] = useState<MapPin[]>([]);
  const [waveRefreshKey, setWaveRefreshKey] = useState(0);
  const [selectedWaveMap, setSelectedWaveMap] = useState<Map<string, WaveTargetStore>>(
    () => new Map(),
  );
  const [waveSheetOpen, setWaveSheetOpen] = useState(false);
  // Brand users (who cannot switch to Admin) get 200 rows a request; ask
  // for exactly that so each offset step lands where the last page ended.
  const { canToggleRole } = useSparkRole();
  const pageSize = accountMapPageSize(!canToggleRole);
  const [scanned, setScanned] = useState(pageSize);
  const [loadingRest, setLoadingRest] = useState(false);
  // This component only commits after the pin query resolves, so the
  // effect mounts Maps JS on the following paint — the store list first.
  const [mapsReady, setMapsReady] = useState(false);
  useEffect(() => {
    setMapsReady(true);
  }, []);

  // Jump deep-links (`?q=`, `?coverage=`) seed the filters.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null && q !== search) setSearch(q);
    const cov = coverageFilterFromParam(searchParams.get("coverage"));
    if (cov !== coverage) setCoverage(cov);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL seeds Jump deep-links once
  }, [searchParams]);

  const setCoverageFilter = (next: CoverageFilter) => {
    setCoverage(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("coverage");
    else params.set("coverage", next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    setExtraPins([]);
    setScanned(pageSize);
    setLoadingRest(false);
    setSelectedWaveMap(new Map());
    setWaveSheetOpen(false);
  }, [tenantId, pageSize]);

  const data = useLazyLoadQuery<AccountMapQueryType>(
    AccountMapQuery,
    { first: pageSize, offset: 0, tenantId: tenantId || null },
    {
      fetchPolicy: waveRefreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: waveRefreshKey,
    },
  );
  const list = useAccountList(tenantId || null);

  const pinTotal = data?.accountMapPinTotal ?? null;
  const truncation = accountMapTruncation({ total: pinTotal, scanned });

  /** Load pages after what is on screen, up to `upTo` rows scanned. */
  const loadRest = useCallback(async (upTo: number = Number.POSITIVE_INFINITY) => {
    if (loadingRest || pinTotal == null || scanned >= pinTotal) return;
    setLoadingRest(true);
    const CONCURRENCY = 4;
    try {
      let offset = scanned;
      const accumulated = [...extraPins];
      const cap = Math.min(pinTotal, upTo);
      while (offset < cap) {
        const batchOffsets: number[] = [];
        for (let i = 0; i < CONCURRENCY && offset < cap; i += 1) {
          batchOffsets.push(offset);
          offset += pageSize;
        }
        const pages = await Promise.all(
          batchOffsets.map((batchOffset) =>
            fetchQuery<AccountMapQueryType>(
              environment,
              AccountMapQuery,
              { first: pageSize, offset: batchOffset, tenantId: tenantId || null },
              { fetchPolicy: "network-only" },
            ).toPromise(),
          ),
        );
        for (const page of pages) {
          const rows = (page?.accountMapPins ?? []).filter((p): p is MapPin => Boolean(p));
          accumulated.push(...rows);
        }
        setExtraPins([...accumulated]);
        setScanned(Math.min(cap, offset));
      }
    } catch {
      // The network layer already said why (e.g. a rate limit); keep the
      // pins we have and leave "Load the rest" to try again.
    } finally {
      setLoadingRest(false);
    }
  }, [extraPins, loadingRest, pageSize, pinTotal, scanned, tenantId]);

  // A brand user's first page is 200 rows; bring in the rest of what one
  // admin page holds (2,000) without a click, so the map starts out the same.
  const autoFilled = useRef<string | null>(null);
  useEffect(() => {
    const key = `${tenantId ?? ""}|${pageSize}`;
    if (pageSize >= ACCOUNT_MAP_PAGE_SIZE || autoFilled.current === key) return;
    if (pinTotal == null || scanned >= pinTotal) return;
    autoFilled.current = key;
    void loadRest(ACCOUNT_MAP_PAGE_SIZE);
  }, [loadRest, pageSize, pinTotal, scanned, tenantId]);

  const stores = useMemo(() => {
    const first = (data?.accountMapPins ?? []).filter((p): p is MapPin => Boolean(p));
    const rows: PinRow[] = [...first, ...extraPins];
    return buildStores(rows, list.entries);
  }, [data, extraPins, list.entries]);

  // Typing stays instant; the list and the pins catch up a beat later.
  const deferredSearch = useDeferredValue(search);
  const filters: StoreFilters = useMemo(
    () => ({
      q: deferredSearch,
      coverage,
      state: stateFilter,
      retailer: retailerFilter,
      market: marketFilter,
    }),
    [deferredSearch, coverage, stateFilter, retailerFilter, marketFilter],
  );
  const filtered = useMemo(() => filterStores(stores, filters), [stores, filters]);
  const counts = useMemo(() => storeCounts(stores), [stores]);
  const shown = useMemo(() => storeCounts(filtered), [filtered]);
  const states = useMemo(() => stateOptions(stores), [stores]);
  const retailers = useMemo(() => retailerOptions(stores), [stores]);
  const markets = useMemo(() => marketOptions(stores, stateFilter), [stores, stateFilter]);
  const filtering = hasFilters({ ...filters, q: search });

  const scope = `${tenantId ?? "all"}|${coverage}|${stateFilter}|${marketFilter}|${retailerFilter}|${deferredSearch.trim().toLowerCase()}`;
  const fitKey = useMemo(() => storesFitKey(scope, filtered), [scope, filtered]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null);
  const rowEls = useRef(new Map<string, HTMLLIElement>());

  // List → map: pan to the pin and open its card.
  const showOnMap = useCallback((key: string) => {
    setSelectedKey(key);
    setFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
  }, []);
  // Map → list: highlight the row and bring it into view.
  const selectFromMap = useCallback((key: string) => {
    setSelectedKey(key);
    rowEls.current.get(key)?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);
  const closeCard = useCallback(() => setSelectedKey(null), []);

  // Prefill the request form with this store.
  const schedule = useCallback(
    (store: Store) => {
      const params = new URLSearchParams({
        venue: store.name,
        address: store.address || store.market,
      });
      if (store.state) params.set("state", store.state);
      navigate(`/requests/create?${params.toString()}`);
    },
    [navigate],
  );
  const openProfile = useCallback(
    (store: Store) => {
      openStoreSheet({
        storeKey: store.key,
        storeName: store.name,
        address: store.address,
        fallbackTitle: store.name,
      });
    },
    [openStoreSheet],
  );
  const toWaveStore = useCallback(
    (s: Store): WaveTargetStore => ({
      key: s.key,
      name: s.name,
      address: s.address,
      market: s.market,
      state: s.state,
      position: s.position,
    }),
    [],
  );
  const toggleWaveStore = useCallback((target: WaveTargetStore) => {
    setSelectedWaveMap((prev) => {
      const next = new Map(prev);
      if (next.has(target.key)) next.delete(target.key);
      else next.set(target.key, target);
      return next;
    });
  }, []);
  const toggleWaveFromStoreRow = useCallback(
    (store: Store) => {
      toggleWaveStore(toWaveStore(store));
    },
    [toWaveStore, toggleWaveStore],
  );
  const selectManyWaveStores = useCallback(
    (targets: ReadonlyArray<WaveTargetStore>) => {
      setSelectedWaveMap((prev) => {
        const next = new Map(prev);
        const allPresent =
          targets.length > 0 && targets.every((t) => next.has(t.key));
        if (allPresent) {
          for (const t of targets) next.delete(t.key);
        } else {
          for (const t of targets) next.set(t.key, t);
        }
        return next;
      });
    },
    [],
  );
  const selectedWaveKeys = useMemo(
    () => new Set(selectedWaveMap.keys()),
    [selectedWaveMap],
  );
  const selectedWaveList = useMemo(
    () => Array.from(selectedWaveMap.values()),
    [selectedWaveMap],
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedWaveMap.has(s.key));
  const toggleSelectAllFiltered = useCallback(() => {
    selectManyWaveStores(filtered.map(toWaveStore));
  }, [filtered, selectManyWaveStores, toWaveStore]);
  const handleWaveCreated = useCallback(
    ({ retainStoreKeys }: { createdCount: number; retainStoreKeys: string[] }) => {
      setSelectedWaveMap((prev) => {
        if (retainStoreKeys.length === 0) return new Map();
        const keep = new Set(retainStoreKeys);
        const next = new Map<string, WaveTargetStore>();
        for (const [k, v] of prev.entries()) {
          if (keep.has(k)) next.set(k, v);
        }
        return next;
      });
      setExtraPins([]);
      setScanned(pageSize);
      autoFilled.current = null;
      setWaveRefreshKey((k) => k + 1);
    },
    [pageSize],
  );
  const onlyRetailer = useCallback((name: string) => {
    setRetailerFilter(retailerChainKey(name));
    setSelectedKey(null);
  }, []);

  const clearFilters = () => {
    setCoverage("all");
    setStateFilter("all");
    setMarketFilter("all");
    setRetailerFilter("all");
    setSearch("");
    const params = new URLSearchParams(searchParams);
    params.delete("q");
    params.delete("coverage");
    setSearchParams(params, { replace: true });
  };

  const roster = data?.accountMapCoverage;
  const chips: Array<{ key: CoverageFilter; label: string; n: number }> = [
    { key: "all", label: "All stores", n: counts.all },
    { key: "never_visited", label: "Never visited", n: counts.neverVisited },
    { key: "sampled", label: "Sampled", n: counts.sampled },
    { key: "repeat", label: "Repeat", n: counts.repeat },
    { key: "planned", label: "Visit planned", n: counts.planned },
  ];

  const emptyList =
    stores.length === 0
      ? "No stores yet: nothing with a map position, and no account list uploaded."
      : "No stores match these filters.";
  const offMap = shown.all - shown.onMap;

  return (
    <div className="space-y-5 max-w-7xl spark-fade-in spark-scale">
      <SparkPageHeader
        title="Account map"
        support="One pin per store. Coverage counts filed recaps only: sampled is one visit, repeat is two or more."
      />

      {truncation.truncated && truncation.label ? (
        <div role="status" className="spark-card px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm" style={{ color: "var(--spark-text)" }}>
            <span className="font-semibold">{truncation.label}</span> request rows, so
            some stores and counts are missing.
          </p>
          <button
            type="button"
            disabled={loadingRest}
            onClick={() => void loadRest()}
            className="spark-btn-ghost"
          >
            {loadingRest ? "Loading" : "Load the rest"}
          </button>
        </div>
      ) : null}

      <SparkFilterBar
        label="Stores"
        search={
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by store, city or address"
            aria-label="Search stores by name, city or address"
            className="spark-filter-search"
            style={{ minWidth: 240, maxWidth: 320 }}
          />
        }
      >
        {chips.map((c) => {
          const on = coverage === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCoverageFilter(c.key)}
              aria-pressed={on}
              className="chip chip-muted"
              style={
                on
                  ? {
                      color: "var(--spark-text)",
                      outline: "1.5px solid var(--spark-text)",
                    }
                  : undefined
              }
            >
              {c.label} · {c.n.toLocaleString("en-US")}
            </button>
          );
        })}
        {roster && roster.rosterTotal > 0 ? (
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--spark-text-secondary)" }}>
            Account roster: {roster.rosterTotal.toLocaleString("en-US")}{" "}
            {roster.rosterTotal === 1 ? "account" : "accounts"},{" "}
            {roster.neverVisited.toLocaleString("en-US")} with no filed visit.
          </span>
        ) : null}
        <span className="flex-1" />
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setMarketFilter("all");
          }}
          aria-label="Filter by state"
          style={selectStyle}
        >
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          aria-label="Filter by market"
          style={selectStyle}
        >
          <option value="all">All markets</option>
          {markets.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name} · {m.count}
            </option>
          ))}
        </select>
        <select
          value={retailerFilter}
          onChange={(e) => setRetailerFilter(e.target.value)}
          aria-label="Filter by retailer"
          style={selectStyle}
        >
          <option value="all">All retailers</option>
          {retailers.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name} · {r.count}
            </option>
          ))}
        </select>
        {filtering ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs underline px-1"
            style={{
              color: "var(--spark-text-secondary)",
              background: "none",
              border: 0,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        ) : null}
        {filtered.length > 0 && filtering ? (
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            className="spark-btn-ghost text-xs"
          >
            {allFilteredSelected
              ? `Deselect ${filtered.length.toLocaleString("en-US")} filtered`
              : `Select all ${filtered.length.toLocaleString("en-US")} filtered stores`}
          </button>
        ) : null}
        {selectedWaveList.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedWaveMap(new Map())}
              className="text-xs underline px-1"
              style={{
                color: "var(--spark-text-meta)",
                background: "none",
                border: 0,
                cursor: "pointer",
              }}
            >
              Clear ({selectedWaveList.length.toLocaleString("en-US")})
            </button>
            <button
              type="button"
              onClick={() => setWaveSheetOpen(true)}
              className="btn btn-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                border: "1px solid var(--spark-lime)",
              }}
            >
              Schedule wave ({selectedWaveList.length.toLocaleString("en-US")})
            </button>
          </div>
        ) : null}
      </SparkFilterBar>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="spark-card overflow-hidden order-1 flex flex-col h-[460px] lg:h-[640px]">
          <div className="relative flex-1 min-h-0">
            {mapsReady ? (
              <AccountMapView
                apiKey={apiKey}
                stores={filtered}
                fitKey={fitKey}
                scope={scope}
                selectedKey={selectedKey}
                focus={focus}
                onSelect={selectFromMap}
                onCloseCard={closeCard}
                onSchedule={schedule}
                onOnlyRetailer={onlyRetailer}
              />
            ) : null}
          </div>
          <div
            className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <CoverageLegend />
            {offMap > 0 ? (
              <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                {storesWord(offMap)} in the list {offMap === 1 ? "has" : "have"} no
                map position.
              </p>
            ) : null}
          </div>
        </div>

        <div className="spark-card overflow-hidden flex flex-col order-2 min-h-[280px] max-h-[460px] lg:max-h-[640px]">
          <div
            className="p-4"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <h3 className="font-bold">
              Stores
              <span
                className="text-xs font-normal ml-2"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {filtering
                  ? `${shown.all.toLocaleString("en-US")} of ${counts.all.toLocaleString("en-US")}`
                  : counts.all.toLocaleString("en-US")}
              </span>
            </h3>
            {filtered.length > 0 ? (
              <div className="mt-2">
                <AccountUploader list={list} quiet />
              </div>
            ) : null}
            <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
              {shown.neverVisited.toLocaleString("en-US")} never visited ·{" "}
              {shown.sampled.toLocaleString("en-US")} sampled ·{" "}
              {shown.repeat.toLocaleString("en-US")} repeat
            </p>
          </div>
          {filtered.length === 0 ? (
            <div className="p-6">
              <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
                {emptyList}
              </p>
              {!filtering ? (
                <div className="mt-3">
                  <AccountUploader list={list} quiet />
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="overflow-y-auto flex-1">
              {filtered.slice(0, LIST_ROWS).map((s) => (
                <StoreRow
                  key={s.key}
                  store={s}
                  selected={s.key === selectedKey}
                  checkedForWave={selectedWaveKeys.has(s.key)}
                  onToggleWave={toggleWaveFromStoreRow}
                  onShowOnMap={showOnMap}
                  onSchedule={schedule}
                  onOpenProfile={openProfile}
                  rowRef={(el) => {
                    if (el) rowEls.current.set(s.key, el);
                    else rowEls.current.delete(s.key);
                  }}
                />
              ))}
              {filtered.length > LIST_ROWS ? (
                <li className="px-4 py-3 text-xs" style={{ color: "var(--spark-text-meta)" }}>
                  Showing the first {LIST_ROWS} of{" "}
                  {filtered.length.toLocaleString("en-US")}. Search to find a store.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>

      <SampleNextList
        tenantId={tenantId}
        selectedKeys={selectedWaveKeys}
        onToggleStore={toggleWaveStore}
        onSelectStores={selectManyWaveStores}
        refreshKey={waveRefreshKey}
      />

      <WaveScheduleSheet
        open={waveSheetOpen}
        onClose={() => setWaveSheetOpen(false)}
        tenantId={tenantId}
        stores={selectedWaveList}
        onWaveCreated={handleWaveCreated}
      />
    </div>
  );
};

/**
 * Layout-less body of the Account Map. Used by the client dashboard's
 * "Account Map" tab so we don't render the admin shell (sidebar +
 * topbar) inside the dashboard's existing Layout content area.
 *
 * The default export below wraps this in `<Layout>` for the
 * standalone `/account-map` route.
 */
export const AccountMapBody: React.FC = () => {
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;
  return (
    <Suspense fallback={<PanelSkeleton label="Loading account map" />}>
      <Inner apiKey={apiKey} />
    </Suspense>
  );
};

export default function SparkAccountMap() {
  return (
    <Layout>
      <AccountMapBody />
    </Layout>
  );
}
