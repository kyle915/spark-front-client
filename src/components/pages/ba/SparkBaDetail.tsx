/**
 * Spark v2 — BA detail page at /ba/:uuid.
 *
 * Admin view of a single Brand Ambassador: stats hero, profile
 * details, skills, recent reviews, internal notes. Mirrors the
 * spark-demo "baProfile" wireframe.
 *
 * Uses the existing `ambassadorProfile(uuid)` query — no new
 * backend. Star/Invite/Message buttons are placeholders until the
 * back-end favorites + DM mutations ship; the star wires to the
 * localStorage favorites helper from PR #226 so it composes.
 */

import React, { Suspense, useMemo, useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { AmbassadorProfileQuery } from "@/api/queries/AmbassadorProfileQuery";
import type { AmbassadorProfileQuery as AmbassadorProfileQueryType } from "@api/queries/__generated__/AmbassadorProfileQuery.graphql";
import { AmbassadorRatingsQuery } from "@/api/queries/AmbassadorRatingsQuery";
import type { AmbassadorRatingsQuery as AmbassadorRatingsQueryType } from "@api/queries/__generated__/AmbassadorRatingsQuery.graphql";
import RateBaControl, { StarMeter } from "@/components/RateBaControl";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";

type Profile = NonNullable<
  AmbassadorProfileQueryType["response"]["ambassadorProfile"]
>;

const displayName = (p: Profile) => {
  const u = p.ambassador?.user;
  return (
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    u?.email ||
    "(unnamed)"
  );
};

const initials = (p: Profile) => {
  const u = p.ambassador?.user;
  const a = (u?.firstName ?? "")[0] ?? "";
  const b = (u?.lastName ?? "")[0] ?? "";
  return (a + b).toUpperCase() || "?";
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const Inner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const navigate = useNavigate();
  const data = useLazyLoadQuery<AmbassadorProfileQueryType>(
    AmbassadorProfileQuery,
    { uuid },
    { fetchPolicy: "store-and-network" },
  );
  const profile = data.ambassadorProfile as Profile | null;
  const [favIds, setFavIds] = useState<Set<string>>(() =>
    loadFavorites(tenantId),
  );
  useEffect(() => {
    setFavIds(loadFavorites(tenantId));
  }, [tenantId]);

  const avgScore = useMemo(() => {
    if (!profile) return null;
    const scores = (profile.reviews ?? [])
      .map((r) => Number(r?.score))
      .filter((s) => Number.isFinite(s) && s > 0);
    if (scores.length === 0) return null;
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  }, [profile]);

  if (!profile?.ambassador) {
    return (
      <div
        className="spark-card p-10 text-center max-w-3xl"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Brand Ambassador not found.
      </div>
    );
  }

  const ba = profile.ambassador;
  const isFav = favIds.has(String(ba.id));
  const memberSince = fmtDate(ba.createdAt);

  const onStar = () => {
    const next = toggleFavorite(tenantId, String(ba.id));
    setFavIds(next);
    showAlert(
      next.has(String(ba.id))
        ? `${displayName(profile)} added to favorites.`
        : `${displayName(profile)} removed from favorites.`,
      "success",
    );
  };

  const onMessage = () => {
    if (ba.user?.email) {
      window.location.href = `mailto:${ba.user.email}`;
    } else {
      showAlert("No email on file for this BA.", "warning");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        className="mono text-[11px] inline-flex items-center gap-2 transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.55)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        ← BACK
      </button>

      {/* Hero */}
      <div className="spark-card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className="display font-bold"
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(197,245,70,0.10)",
              color: "var(--spark-lime)",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
            }}
          >
            {initials(profile)}
          </div>

          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="display text-3xl font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                {displayName(profile)}
              </h1>
              {isFav && <span className="chip chip-lime">★ FAVORITE</span>}
              {ba.isActive ? (
                <span className="chip chip-sky">ACTIVE</span>
              ) : (
                <span className="chip chip-muted">INACTIVE</span>
              )}
            </div>
            <p
              className="mt-1 text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {ba.address ?? "—"} · joined {memberSince}
            </p>
            <div className="flex flex-wrap items-center gap-6 mt-4">
              <Stat
                label={`${(profile.reviews ?? []).length} REVIEWS`}
                value={avgScore != null ? `★ ${avgScore.toFixed(1)}` : "★ —"}
                highlight
              />
              <Stat
                label="SKILLS"
                value={(profile.skills ?? []).length}
              />
              <Stat
                label="NOTES"
                value={(profile.notes ?? []).length}
              />
              <Stat
                label="T-SHIRT"
                value={ba.tShirtSize ?? "—"}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onStar}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: isFav ? "transparent" : "var(--spark-lime)",
                color: isFav ? "var(--spark-lime)" : "#0a0d09",
                border: isFav
                  ? "1px solid var(--spark-lime)"
                  : "none",
              }}
            >
              {isFav ? "★ Unfavorite" : "★ Favorite"}
            </button>
            <button
              onClick={onMessage}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ✉ Message
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      {ba.aboutMe && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ABOUT
          </p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {ba.aboutMe}
          </p>
        </div>
      )}

      {/* Contact details */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          CONTACT
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="EMAIL">
            {ba.user?.email ? (
              <a
                href={`mailto:${ba.user.email}`}
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                {ba.user.email}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="PHONE">
            {ba.phone ? (
              <a
                href={`tel:${ba.phone}`}
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                {ba.phone}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="ADDRESS">{ba.address ?? "—"}</Field>
          <Field label="LOCATION">
            {ba.location?.name ?? "—"}
          </Field>
        </div>
      </div>

      {/* Skills */}
      {(profile.skills ?? []).length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            SKILLS · {profile.skills.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) =>
              s?.skill?.name ? (
                <span key={s.id} className="chip chip-sky">
                  {s.skill.name}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-3"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          REVIEWS · {(profile.reviews ?? []).length}
        </p>
        {(profile.reviews ?? []).length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No reviews yet.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.reviews.map((r) =>
              r ? (
                <div
                  key={r.id}
                  className="flex items-start gap-3"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <span
                    className="mono text-[12px]"
                    style={{
                      color: "var(--spark-lime)",
                      minWidth: 36,
                    }}
                  >
                    ★ {r.score ?? "—"}
                  </span>
                  <div className="flex-1">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      {r.review || (
                        <span
                          style={{
                            color: "rgba(255,255,255,0.45)",
                            fontStyle: "italic",
                          }}
                        >
                          (no comment)
                        </span>
                      )}
                    </p>
                    <p
                      className="mono text-[10px] mt-1"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Gig ratings — the new 1-5 star ratings (admin + client), distinct
          from legacy AmbassadorReviews above. Loads in its own boundary. */}
      <RatingsCard
        ambassadorId={String(ba.id)}
        ambassadorName={displayName(profile)}
      />

      {/* Internal notes */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-3"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          INTERNAL NOTES · {(profile.notes ?? []).length}
        </p>
        {(profile.notes ?? []).length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No internal notes on this BA.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.notes.map((n) =>
              n ? (
                <div
                  key={n.id}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    paddingTop: "0.75rem",
                  }}
                >
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {n.note}
                  </p>
                  <p
                    className="mono text-[10px] mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {fmtDate(n.createdAt)}
                  </p>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Audit footer */}
      <div className="spark-card p-5">
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              AMBASSADOR UUID
            </p>
            <p
              className="mono text-xs"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {ba.uuid}
            </p>
          </div>
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SHORTCUTS
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                to="/talent"
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                ← Talent search
              </Link>
              <Link
                to="/favorites"
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                Favorites →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Gig ratings card. Loads `ambassadorRatings` (server enforces who can
 * see which rows), shows the average + a list, and lets the admin leave
 * a general profile rating with an optional note. Re-fetches after each
 * save via a fetchKey bump so the new row + recomputed average appear
 * without a reload.
 */
const RatingsInner: React.FC<{
  ambassadorId: string;
  ambassadorName: string;
}> = ({ ambassadorId, ambassadorName }) => {
  const [bump, setBump] = useState(0);
  const data = useLazyLoadQuery<AmbassadorRatingsQueryType>(
    AmbassadorRatingsQuery,
    { ambassadorId },
    { fetchPolicy: "store-and-network", fetchKey: bump },
  );
  const ratings = (data.ambassadorRatings ?? []).filter(Boolean);
  const scores = ratings
    .map((r) => Number(r?.score))
    .filter((s) => Number.isFinite(s) && s > 0);
  const avg = scores.length
    ? scores.reduce((s, v) => s + v, 0) / scores.length
    : 0;

  return (
    <div className="spark-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
        >
          GIG RATINGS · {ratings.length}
        </p>
        <StarMeter value={avg} count={ratings.length} size={18} />
      </div>

      <div
        className="mb-5"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "1rem",
        }}
      >
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          RATE THIS BA
        </p>
        <RateBaControl
          ambassadorId={ambassadorId}
          ambassadorName={ambassadorName}
          onRated={() => setBump((b) => b + 1)}
        />
      </div>

      {ratings.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          No ratings yet.
        </p>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) =>
            r ? (
              <div
                key={r.id}
                className="flex items-start gap-3"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  paddingTop: "0.75rem",
                }}
              >
                <span
                  className="mono text-[12px]"
                  style={{ color: "var(--spark-lime)", minWidth: 36 }}
                >
                  ★ {r.score}
                </span>
                <div className="flex-1">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {r.comment || (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.45)",
                          fontStyle: "italic",
                        }}
                      >
                        (no comment)
                      </span>
                    )}
                  </p>
                  <p
                    className="mono text-[10px] mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {r.raterName || "—"}
                    {r.byClient ? " · CLIENT" : " · IGNITE"} ·{" "}
                    {fmtDate(r.createdAt)}
                  </p>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
};

const RatingsCard: React.FC<{
  ambassadorId: string;
  ambassadorName: string;
}> = (props) => (
  <Suspense
    fallback={
      <div
        className="spark-card p-6 text-xs"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        Loading ratings…
      </div>
    }
  >
    <RatingsInner {...props} />
  </Suspense>
);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <p
      className="mono text-[10px] mb-1"
      style={{
        letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </p>
    <div
      className="text-sm"
      style={{ color: "rgba(255,255,255,0.85)" }}
    >
      {children}
    </div>
  </div>
);

const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div>
    <p
      className="tab-num text-2xl font-bold"
      style={{ color: highlight ? "var(--spark-lime)" : undefined }}
    >
      {value}
    </p>
    <p
      className="mono text-[10px]"
      style={{
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </p>
  </div>
);

export default function SparkBaDetail() {
  const { uuid } = useParams<{ uuid: string }>();
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            BA detail pages are a Spark Admin surface.
          </p>
        </div>
      </Layout>
    );
  }
  if (!uuid) {
    return (
      <Layout>
        <div
          className="spark-card p-10 text-center max-w-3xl"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Missing ambassador uuid.
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
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading profile…
          </div>
        }
      >
        <Inner uuid={uuid} />
      </Suspense>
    </Layout>
  );
}
