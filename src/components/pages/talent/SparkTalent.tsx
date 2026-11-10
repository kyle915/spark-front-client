import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
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

type BA = {
  uuid: string;
  name: string;
  email: string;
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

  // Server-side filters. address+city, college and the in-college flag
  // are pushed down (AmbassadorFiltersInput); the free-text `query` box
  // stays client-side over the loaded page for snappy name/email typing.
  const filters = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (tenantId) f.tenantId = tenantId;
    if (city.trim()) f.city = city.trim();
    if (college.trim()) f.college = college.trim();
    if (inCollegeOnly) f.inCollege = true;
    if (activeOnly) f.isActive = true;
    const minR = minRating === "any" ? null : parseInt(minRating, 10);
    if (minR != null && !Number.isNaN(minR)) f.ratingMin = minR;
    return f;
  }, [tenantId, city, college, inCollegeOnly, activeOnly, minRating]);

  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    { first: 200, filters },
    { fetchPolicy: "store-and-network" },
  );

  const all: BA[] = useMemo(() => {
    return (data?.ambassadors?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((n) => {
        const firstName = n.user?.firstName ?? "";
        const lastName = n.user?.lastName ?? "";
        const name =
          [firstName, lastName].filter(Boolean).join(" ") ||
          n.user?.email ||
          "BA";
        const rating = typeof n.rating === "number" ? n.rating : null;
        const isActive = Boolean(n.isActive);
        return {
          uuid: String(n.uuid),
          name,
          email: n.user?.email ?? "",
          initials: initialsOf(name),
          location: cityFromAddress(n.address ?? ""),
          college: n.college ?? "",
          inCollege: Boolean(n.inCollege),
          headshotUrl: n.headshotUrl ?? null,
          rating,
          jobs: null,
          tier: tierFromRating(rating, isActive),
          isActive,
        };
      });
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return all.filter((b) => {
      if (
        q &&
        !b.name.toLowerCase().includes(q) &&
        !b.location.toLowerCase().includes(q) &&
        !b.college.toLowerCase().includes(q) &&
        !b.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [all, query]);

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
            ROSTER · {filtered.length} of {all.length} BAs
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
            color: "#0a0d09",
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
          onClose={() => setOpenBA(null)}
        />
      )}

      {/* Filter row */}
      <div className="spark-card p-4 grid lg:grid-cols-3 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email…"
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
                  {(b.location || b.email) && (
                    <p
                      className="mono text-[10px] uppercase mt-0.5 truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {b.location || b.email}
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
                  🎓 {b.college}
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
