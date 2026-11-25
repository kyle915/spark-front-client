import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { TalentRosterQuery } from "@/api/queries/TalentRosterQuery";
import type { TalentRosterQuery as TalentRosterQueryType } from "@api/queries/__generated__/TalentRosterQuery.graphql";
import {
  displayEmail,
  talentName,
  talentPhone,
  talentPlace,
  type TalentSource,
} from "./talentDisplay";
import InviteNewBAModal from "./InviteNewBAModal";
import BAProfileModal from "./BAProfileModal";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Talent search.
 *
 * Wired to the live AmbassadorsListQuery. Fields we surface today:
 *   - name + initials (from user.firstName / lastName) + headshot
 *   - rating (live)
 *   - email + city (parsed from address when present)
 *   - college + in-college flag
 *   - active status
 *
 * Search by address + city, by college, and an "In college only" toggle
 * are pushed to the server (AmbassadorFiltersInput). Clicking a card
 * opens the BAProfileModal — full profile + gig history + DM. The
 * ambassador-events aggregation that powers jobs/brand history now ships
 * (ambassadorProfileDetail / ambassadorGigHistory).
 */

type Tier = "CAPTAIN" | "TOP" | "RISING" | "NEW";

/** The API's page size for the ambassadors list (its max). */
const PAGE_SIZE = 50;

type RosterEdge = NonNullable<
  TalentRosterQueryType["response"]["ambassadors"]
>["edges"][number];

type BA = {
  uuid: string;
  name: string;
  /** Contactable email only — "" for a walk-up placeholder. */
  email: string;
  phone: string;
  source: TalentSource;
  homeCity: string;
  initials: string;
  location: string;
  college: string;
  inCollege: boolean;
  headshotUrl: string | null;
  rating: number | null;
  jobs: number | null;
  tier: Tier;
  isActive: boolean;
};

const TIER_CHIP: Record<Tier, string> = {
  CAPTAIN: "chip chip-lime",
  TOP: "chip chip-lime",
  RISING: "chip chip-sky",
  NEW: "chip chip-muted",
};

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.65rem 0.9rem",
  color: "var(--spark-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const tierFromRating = (
  rating: number | null,
  isActive: boolean,
): Tier => {
  if (!isActive) return "NEW";
  if (rating == null) return "NEW";
  if (rating >= 4.85) return "CAPTAIN";
  if (rating >= 4.6) return "TOP";
  if (rating >= 4.0) return "RISING";
  return "NEW";
};

// Pull a friendly city out of a free-text address. Cheap heuristic:
// last comma-separated segment that isn't a ZIP/country.
const cityFromAddress = (raw: string): string => {
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // Drop trailing "USA" / state-codes / zips
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (/^(usa|united states|us)$/i.test(seg)) continue;
    if (/^\d{5}(-\d{4})?$/.test(seg)) continue;
    if (/^[A-Z]{2}( \d{5})?$/.test(seg)) continue;
    return seg;
  }
  return parts[0] ?? "";
};

const TalentInner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const baParam = (searchParams.get("ba") ?? "").trim();

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [college, setCollege] = useState("");
  const [minRating, setMinRating] = useState("any");
  const [activeOnly, setActiveOnly] = useState(true);
  const [inCollegeOnly, setInCollegeOnly] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Selected BA whose profile pop-up is open.
  const [openBA, setOpenBA] = useState<{ uuid: string; name: string } | null>(
    null,
  );

  // Every filter, the search box included, runs on the server: the API
  // pages 50 BAs at a time, so filtering only the loaded page missed
  // everyone past the first 50. The box is debounced, and the deferred
  // value keeps the current roster (and the box's focus) on screen while
  // the next result loads instead of dropping to the page fallback.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const liveFilters = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (tenantId) f.tenantId = tenantId;
    if (debouncedQuery) f.talentSearch = debouncedQuery;
    if (city.trim()) f.city = city.trim();
    if (college.trim()) f.college = college.trim();
    if (inCollegeOnly) f.inCollege = true;
    if (activeOnly) f.isActive = true;
    const minR = minRating === "any" ? null : parseInt(minRating, 10);
    if (minR != null && !Number.isNaN(minR)) f.ratingMin = minR;
    return f;
  }, [tenantId, debouncedQuery, city, college, inCollegeOnly, activeOnly, minRating]);
  const filters = useDeferredValue(liveFilters);
  const searching = filters !== liveFilters;

  const data = useLazyLoadQuery<TalentRosterQueryType>(
    TalentRosterQuery,
    { first: PAGE_SIZE, after: null, filters },
    { fetchPolicy: "store-and-network" },
  );
  const firstPage = data?.ambassadors;

  // Pages fetched with "Load more", for these filters only.
  const [more, setMore] = useState<{
    filters: typeof filters;
    edges: RosterEdge[];
    endCursor: string | null;
    hasNextPage: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more && more.filters === filters ? more : null;
  const hasNextPage = extra ? extra.hasNextPage : Boolean(firstPage?.pageInfo?.hasNextPage);
  const endCursor = extra ? extra.endCursor : firstPage?.pageInfo?.endCursor ?? null;
  const totalCount = firstPage?.totalCount ?? 0;

  const loadMore = async () => {
    if (loadingMore || !hasNextPage || !endCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchQuery<TalentRosterQueryType>(
        environment,
        TalentRosterQuery,
        { first: PAGE_SIZE, after: endCursor, filters },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const page = res?.ambassadors;
      if (page) {
        setMore({
          filters,
          edges: [...(extra?.edges ?? []), ...(page.edges ?? [])],
          endCursor: page.pageInfo?.endCursor ?? null,
          hasNextPage: Boolean(page.pageInfo?.hasNextPage),
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const all: BA[] = useMemo(() => {
    const seen = new Set<string>();
    return [...(firstPage?.edges ?? []), ...(extra?.edges ?? [])]
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => {
        if (!n || seen.has(String(n.uuid))) return false;
        seen.add(String(n.uuid));
        return true;
      })
      .map((n) => {
        // Walk-up identities carry a synthetic checkin-<phone>@walkup.spark
        // email; name them by phone and place them by their last shift.
        const source: TalentSource = {
          firstName: n.user?.firstName,
          lastName: n.user?.lastName,
          email: n.user?.email,
          phone: n.phone,
          lastWorkedMarket: n.lastWorkedMarket,
          lastWorkedTenant: n.lastWorkedTenant,
        };
        const name = talentName(source);
        const homeCity = cityFromAddress(n.address ?? "");
        const rating = typeof n.rating === "number" ? n.rating : null;
        const isActive = Boolean(n.isActive);
        return {
          uuid: String(n.uuid),
          name,
          email: displayEmail(n.user?.email),
          phone: talentPhone(source),
          source,
          homeCity,
          initials: /[A-Za-z]/.test(name) ? initialsOf(name) : "BA",
          location: talentPlace(source, homeCity),
          college: n.college ?? "",
          inCollege: Boolean(n.inCollege),
          headshotUrl: n.headshotUrl ?? null,
          rating,
          jobs: null,
          tier: tierFromRating(rating, isActive),
          isActive,
        };
      });
  }, [firstPage, extra]);

  useEffect(() => {
    if (!baParam) return;
    const matched = all.find((b) => b.uuid === baParam);
    setOpenBA((prev) => {
      if (prev?.uuid === baParam) {
        if (matched && prev.name === "Ambassador") {
          return { uuid: baParam, name: matched.name };
        }
        return prev;
      }
      return { uuid: baParam, name: matched?.name ?? "Ambassador" };
    });
  }, [baParam, all]);

  const filtered = all;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            ROSTER · {filtered.length} of {totalCount} BAs{searching ? " · searching…" : ""}
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Search talent.
          </h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Live from the BA roster. Filter by city, college, or in-college
            status, then open a card for the full profile, gig history, and
            a quick DM.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          + Invite BA
        </button>
      </div>
      {inviteOpen && (
        <InviteNewBAModal onClose={() => setInviteOpen(false)} />
      )}
      {openBA && (
        <BAProfileModal
          ambassadorUuid={openBA.uuid}
          fallbackName={openBA.name}
          onClose={() => {
            setOpenBA(null);
            if (baParam) {
              const next = new URLSearchParams(searchParams);
              next.delete("ba");
              setSearchParams(next, { replace: true });
            }
          }}
        />
      )}

      {/* Filter row */}
      <div className="spark-card p-4 grid lg:grid-cols-3 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, phone, email…"
          style={inputStyle}
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City / address…"
          style={inputStyle}
        />
        <input
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          placeholder="College…"
          style={inputStyle}
        />
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          style={inputStyle}
        >
          <option value="any">Any rating</option>
          <option value="3">★ 3+</option>
          <option value="4">★ 4+</option>
          <option value="5">★ 5</option>
        </select>
        <label
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <input
            type="checkbox"
            checked={inCollegeOnly}
            onChange={(e) => setInCollegeOnly(e.target.checked)}
            className="accent-[var(--spark-lime)]"
          />
          In college only
        </label>
        <label
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-[var(--spark-lime)]"
          />
          Active only
        </label>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No BAs match these filters.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.uuid}
              role="button"
              tabIndex={0}
              onClick={() => setOpenBA({ uuid: b.uuid, name: b.name })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenBA({ uuid: b.uuid, name: b.name });
                }
              }}
              className="spark-card hov p-5 text-left cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {b.headshotUrl ? (
                  <img
                    src={b.headshotUrl}
                    alt={b.name}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    className="spark-avatar"
                    style={{
                      width: 56,
                      height: 56,
                      fontSize: "1.05rem",
                      borderRadius: 16,
                    }}
                  >
                    {b.initials}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold truncate">{b.name}</h4>
                    {!b.isActive && (
                      <span
                        className="mono text-[9px]"
                        style={{
                          letterSpacing: "0.16em",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        INACTIVE
                      </span>
                    )}
                  </div>
                  {(b.location || b.email || b.phone) && (
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {b.location || b.email || b.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`${TIER_CHIP[b.tier]} inline-flex`}>
                      {b.tier}
                    </span>
                    {b.inCollege && (
                      <span className="chip chip-sky inline-flex">
                        IN COLLEGE
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {b.college && (
                <p
                  className="text-[11px] mt-3 truncate"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {b.college}
                </p>
              )}
              <div
                className="mt-4 pt-3 grid grid-cols-3 gap-2 text-center"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <div>
                  <p
                    className="tab-num text-lg font-bold"
                    style={{ color: "var(--spark-lime)" }}
                  >
                    {b.rating != null && b.rating > 0
                      ? `★ ${b.rating.toFixed(1)}`
                      : "—"}
                  </p>
                  <p className="label-mini">RATING</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">
                    {b.isActive ? "Active" : "—"}
                  </p>
                  <p className="label-mini">STATUS</p>
                </div>
                <div>
                  <p
                    className="tab-num text-sm font-bold"
                    style={{ color: "var(--spark-sky)" }}
                  >
                    View →
                  </p>
                  <p className="label-mini">PROFILE</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${Math.max(totalCount - filtered.length, 0)} more)`}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default function SparkTalent() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading roster…
          </div>
        }
      >
        <TalentInner />
      </Suspense>
    </Layout>
  );
}
