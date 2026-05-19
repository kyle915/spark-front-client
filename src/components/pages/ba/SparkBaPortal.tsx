import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useAuthStore } from "@/store/authStore";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import {
  Calendar as CalendarIcon,
  FileText,
  DollarSign,
  User,
  LogOut,
} from "lucide-react";

/**
 * Spark v2 — BA portal (web).
 *
 * Mirrors the mobile app at a high level so BAs can do the same things
 * from a desktop browser (clock in, submit recaps, check earnings).
 * Uses a different chrome from the admin/client app — no left rail,
 * just a bottom-style nav at the top and big touch targets.
 */

type Tab = "shifts" | "recap" | "earnings" | "profile";

const NAV: Array<{
  key: Tab;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { key: "shifts", label: "Shifts", Icon: CalendarIcon },
  { key: "recap", label: "Submit Recap", Icon: FileText },
  { key: "earnings", label: "Earnings", Icon: DollarSign },
  { key: "profile", label: "Profile", Icon: User },
];

const Shell: React.FC<{
  active: Tab;
  onSelect: (t: Tab) => void;
  children: React.ReactNode;
}> = ({ active, onSelect, children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const initials = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--spark-bg)" }}
    >
      <header
        className="sticky top-0 z-30 px-6 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: "rgba(10,13,9,0.85)",
          borderBottom: "1px solid var(--spark-border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-baseline gap-2">
          <span
            className="display italic text-2xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Spark
          </span>
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            BA · IGNITE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="spark-avatar"
            style={{ width: 32, height: 32, fontSize: "0.75rem" }}
          >
            {initials}
          </span>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn btn-ghost btn-sm flex items-center gap-1"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav
        className="sticky z-20 flex"
        style={{
          top: 57,
          background: "rgba(10,13,9,0.9)",
          borderBottom: "1px solid var(--spark-border)",
          backdropFilter: "blur(8px)",
        }}
      >
        {NAV.map((n) => {
          const on = n.key === active;
          const Icon = n.Icon;
          return (
            <button
              key={n.key}
              onClick={() => onSelect(n.key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition"
              style={{
                color: on ? "var(--spark-lime)" : "rgba(255,255,255,0.55)",
                borderBottom: on
                  ? "2px solid var(--spark-lime)"
                  : "2px solid transparent",
              }}
            >
              <Icon size={18} />
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                }}
              >
                {n.label.toUpperCase()}
              </span>
            </button>
          );
        })}
      </nav>

      <main className="flex-1 px-6 py-8 max-w-3xl w-full self-center">
        {children}
      </main>
    </div>
  );
};

/* ───────────────────────── Shifts ───────────────────────── */

const fmtTime12 = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const fmtDayLabel = (raw: string | null | undefined, today: Date): string => {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (d.toDateString() === today.toDateString()) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
};

type Shift = {
  uuid: string;
  venue: string;
  market: string;
  dayLabel: string;
  time: string;
  status: "active" | "upcoming";
};

const ShiftsInner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const horizon = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 14);
    return d;
  }, [today]);

  const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
  const data = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      first: 50,
      filters: tenantId
        ? { tenantId, startDate: fmtIso(today), endDate: fmtIso(horizon) }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const shifts: Shift[] = useMemo(() => {
    const events =
      data?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    const out: Shift[] = events
      .filter((n) => n.date)
      .map((n) => {
        const eventDate = new Date(n.date!);
        const isToday = eventDate.toDateString() === today.toDateString();
        const venue = n.request?.retailer?.name ?? n.name ?? "Untitled";
        const market = n.address ?? "";
        const time =
          n.startTime && n.endTime
            ? `${fmtTime12(n.startTime)} – ${fmtTime12(n.endTime)}`
            : "";
        return {
          uuid: String(n.uuid),
          venue,
          market,
          dayLabel: fmtDayLabel(n.date, today),
          time,
          status: isToday ? ("active" as const) : ("upcoming" as const),
        };
      })
      .sort((a, b) => {
        // Active (today) first, then by date.
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return 0;
      });
    return out;
  }, [data, today]);

  return (
    <div className="space-y-6">
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          YOUR SHIFTS · NEXT 14D
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          What's on the books.
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Live from Spark — events scheduled in the next two weeks.
          BA-specific filtering arrives when the mobile clock-in
          attendance feed lands.
        </p>
      </div>

      {shifts.length === 0 ? (
        <div
          className="spark-card p-8 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No shifts on the books in the next 14 days. Check back later.
        </div>
      ) : (
        shifts.map((s) => {
          const color =
            s.status === "active"
              ? "var(--spark-lime)"
              : "var(--spark-sky)";
          return (
            <div key={s.uuid} className="spark-card p-5">
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 w-1 self-stretch rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.18em",
                      color,
                    }}
                  >
                    {s.status.toUpperCase()}
                  </p>
                  <p
                    className="display text-xl font-bold mt-1"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {s.venue}
                  </p>
                  {s.market && (
                    <p
                      className="text-sm mt-1"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {s.market} · {s.dayLabel}
                    </p>
                  )}
                  {s.time && (
                    <p
                      className="mono text-xs mt-2"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-lime)",
                      }}
                    >
                      {s.time}
                    </p>
                  )}
                </div>
              </div>
              {s.status === "active" && (
                <button
                  className="mt-4 w-full px-4 py-3 rounded-xl text-sm font-semibold"
                  style={{
                    background: "var(--spark-lime)",
                    color: "#0a0d09",
                    boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                  }}
                >
                  📍 Clock in
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

const ShiftsPane: React.FC = () => (
  <Suspense
    fallback={
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Loading your shifts…
      </div>
    }
  >
    <ShiftsInner />
  </Suspense>
);

/* ───────────────────────── Recap ───────────────────────── */

const RecapPane: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="spark-card p-6 text-center">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          READY TO RECAP?
        </p>
        <h2 className="display text-3xl font-bold mt-2" style={{ letterSpacing: "-0.02em" }}>
          Use the full recap form.
        </h2>
        <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.65)" }}>
          Numbers · consumer voice · account feedback · photos + receipts —
          all in one place. We'll pre-link it to your assigned shift.
        </p>
        <button
          onClick={() => navigate("/recap/create")}
          className="mt-5 px-6 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.35)",
          }}
        >
          Start a recap →
        </button>
      </div>
    </div>
  );
};


/* ───────────────────────── Earnings + Profile ───────────────────────── */

const EarningsPane: React.FC = () => (
  <div className="space-y-6">
    <div>
      <p
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        EARNINGS
      </p>
      <h1
        className="display text-4xl font-bold mt-2"
        style={{ letterSpacing: "-0.04em" }}
      >
        You've earned
      </h1>
    </div>
    <div
      className="rounded-3xl p-8"
      style={{
        background:
          "linear-gradient(180deg, var(--spark-surface), var(--spark-surface-2))",
        border: "1px solid rgba(197,245,70,0.4)",
        boxShadow: "0 0 0 1px rgba(197,245,70,0.1), 0 24px 48px rgba(0,0,0,0.4)",
      }}
    >
      <p
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.22em",
          color: "var(--spark-lime)",
        }}
      >
        THIS PAY PERIOD
      </p>
      <p
        className="display tab-num font-bold mt-2"
        style={{
          fontSize: "5rem",
          lineHeight: 1,
          letterSpacing: "-0.05em",
        }}
      >
        $1,420
      </p>
      <p
        className="mt-3 text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Pays Friday · ACH via Wingspan
      </p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="spark-card p-4">
        <p className="label-mini">HOURS</p>
        <p
          className="display tab-num font-bold mt-1"
          style={{ fontSize: "1.75rem", letterSpacing: "-0.03em" }}
        >
          42.5
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">SHIFTS</p>
        <p
          className="display tab-num font-bold mt-1"
          style={{ fontSize: "1.75rem", letterSpacing: "-0.03em" }}
        >
          6
        </p>
      </div>
    </div>
  </div>
);

const ProfilePane: React.FC = () => {
  const { user } = useAuthStore();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "—";
  const initials = (user?.firstName ?? user?.email ?? "U")
    .charAt(0)
    .toUpperCase();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <span
          className="spark-avatar"
          style={{
            width: 80,
            height: 80,
            fontSize: "2rem",
            borderRadius: 20,
            margin: "0 auto",
          }}
        >
          {initials}
        </span>
        <h1
          className="display text-2xl font-bold mt-4"
          style={{ letterSpacing: "-0.03em" }}
        >
          {name}
        </h1>
        <p
          className="mono text-xs mt-2"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {user?.email}
        </p>
      </div>
      {[
        { label: "Identity", value: "TABC certified · Aug 2026" },
        { label: "Rating", value: "★ 4.9 · 142 jobs" },
        { label: "Top brands", value: "Liquid Death · Constellation" },
      ].map((row) => (
        <div
          key={row.label}
          className="spark-card p-4 flex items-center justify-between"
        >
          <span className="label-mini">{row.label.toUpperCase()}</span>
          <span className="text-sm">{row.value}</span>
        </div>
      ))}
      {["📄 Tax docs (W-9 / 1099)", "🏦 Payout method", "📜 Contractor agreement"].map(
        (label) => (
          <button
            key={label}
            className="w-full spark-card p-4 text-left text-sm transition"
          >
            {label}
          </button>
        ),
      )}
    </div>
  );
};

/* ───────────────────────── Page ───────────────────────── */

export default function SparkBaPortal() {
  const [tab, setTab] = useState<Tab>("shifts");
  useEffect(() => {
    document.title = "Spark BA · Ignite";
  }, []);
  return (
    <Shell active={tab} onSelect={setTab}>
      {tab === "shifts" && <ShiftsPane />}
      {tab === "recap" && <RecapPane />}
      {tab === "earnings" && <EarningsPane />}
      {tab === "profile" && <ProfilePane />}
    </Shell>
  );
}
