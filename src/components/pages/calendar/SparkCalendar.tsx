import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";

/**
 * Spark v2 — Shifts Board / Calendar.
 * Wireframe: spark-demo/index.html lines 1315-1356 + calChip/calRow helpers.
 *
 * Week-view grid with a Time column + 7 day columns. Each shift renders as
 * a tinted block with a left-bar matching its kind (retail = lime,
 * on-prem = purple, event = sky).
 */

type ShiftKind = "retail" | "onprem" | "event";

type Shift = {
  uuid: string;
  title: string;
  time: string;
  market: string;
  ba: string;
  kind: ShiftKind;
  dayIndex: number; // 0=Mon … 6=Sun
  hourBand: "8AM" | "12PM" | "2PM" | "6PM";
};

const KIND_COLOR: Record<ShiftKind, string> = {
  retail: "var(--spark-lime)",
  onprem: "var(--spark-purple)",
  event: "var(--spark-sky)",
};

const HOURS: Shift["hourBand"][] = ["8AM", "12PM", "2PM", "6PM"];
const HOUR_LABELS: Record<Shift["hourBand"], string> = {
  "8AM": "8 AM",
  "12PM": "12 PM",
  "2PM": "2 PM",
  "6PM": "6 PM",
};

/* ───────────────── helpers ───────────────── */

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const weekDays = (anchor: Date) => {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const monthLabel = (d: Date) =>
  d.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const hourBandFromTime = (start: string | null | undefined): Shift["hourBand"] => {
  if (!start) return "12PM";
  const h = parseInt(start.split(":")[0] ?? "12", 10);
  if (h < 11) return "8AM";
  if (h < 14) return "12PM";
  if (h < 17) return "2PM";
  return "6PM";
};

const inferKind = (label: string | null | undefined): ShiftKind => {
  const s = (label ?? "").toLowerCase();
  if (
    s.includes("retail") ||
    s.includes("whole foods") ||
    s.includes("trader joe")
  )
    return "retail";
  if (s.includes("on-prem") || s.includes("on prem") || s.includes("bar"))
    return "onprem";
  return "event";
};

/* ───────────────── chip ───────────────── */

const ShiftChip: React.FC<{ s: Shift; onClick: () => void }> = ({
  s,
  onClick,
}) => {
  const c = KIND_COLOR[s.kind];
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-2 cursor-pointer transition"
      style={{
        background: `${c}1a`,
        borderLeft: `3px solid ${c}`,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "scale(1.02)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <p
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          color: c,
        }}
      >
        {s.time}
      </p>
      <p className="text-xs font-semibold mt-0.5 leading-tight">{s.title}</p>
      <p
        className="text-[10px] mt-0.5"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {s.market}
      </p>
      <p
        className="text-[10px] mt-0.5 truncate"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        {s.ba}
      </p>
    </div>
  );
};

/* ───────────────── grid ───────────────── */

const ShiftGrid: React.FC<{ shifts: Shift[]; days: Date[] }> = ({
  shifts,
  days,
}) => {
  const navigate = useNavigate();
  const today = new Date();

  const cellShifts = (dayIdx: number, band: Shift["hourBand"]) =>
    shifts.filter((s) => s.dayIndex === dayIdx && s.hourBand === band);

  return (
    <div className="spark-card overflow-x-auto" style={{ borderRadius: 22 }}>
      <table className="w-full" style={{ minWidth: 800 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
            <th
              className="p-3 text-left mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
                width: 80,
              }}
            >
              TIME
            </th>
            {days.map((d, i) => {
              const isToday = isSameDay(d, today);
              return (
                <th
                  key={i}
                  className="p-3 text-left mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: isToday
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.45)",
                    width: "13%",
                  }}
                >
                  {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}{" "}
                  {d.getDate()}
                  {isToday && " · TODAY"}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((band) => (
            <tr
              key={band}
              style={{ borderBottom: "1px solid var(--spark-border)" }}
              className="align-top"
            >
              <td
                className="p-3 mono align-top"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {HOUR_LABELS[band]}
              </td>
              {days.map((_, dayIdx) => (
                <td key={dayIdx} className="p-2 align-top">
                  <div className="space-y-2">
                    {cellShifts(dayIdx, band).map((s) => (
                      <ShiftChip
                        key={s.uuid}
                        s={s}
                        onClick={() => navigate(`/event/view/${s.uuid}`)}
                      />
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ───────────────── inner (queries) ───────────────── */

const SparkCalendarInner: React.FC<{ anchor: Date }> = ({ anchor }) => {
  const days = useMemo(() => weekDays(anchor), [anchor]);

  const data = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { first: 200 },
    { fetchPolicy: "store-or-network" },
  );

  const shifts: Shift[] = useMemo(() => {
    const start = days[0];
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);

    return (
      data?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          if (!n.date) return null;
          const d = new Date(n.date);
          if (Number.isNaN(d.getTime())) return null;
          if (d < start || d > end) return null;
          const dayIndex = Math.max(
            0,
            Math.min(6, Math.floor((d.getTime() - start.getTime()) / 86400000)),
          );
          const fmtTime = (raw: string | null | undefined) => {
            if (!raw) return "";
            const h = parseInt(raw.split(":")[0] ?? "0", 10);
            const m = raw.split(":")[1] ?? "00";
            const ampm = h >= 12 ? "p" : "a";
            const h12 = ((h + 11) % 12) + 1;
            return m === "00" ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
          };
          const time =
            n.startTime && n.endTime
              ? `${fmtTime(n.startTime)}-${fmtTime(n.endTime)}`
              : "all day";
          return {
            uuid: String(n.uuid),
            title: n.name ?? "Untitled",
            time,
            market: n.request?.retailer?.name ?? n.address ?? "—",
            ba: "—",
            kind: inferKind(n.eventType?.name ?? n.name),
            dayIndex,
            hourBand: hourBandFromTime(n.startTime ?? undefined),
          } as Shift;
        })
        ?.filter((s): s is Shift => s !== null) ?? []
    );
  }, [data, days]);

  return <ShiftGrid shifts={shifts} days={days} />;
};

/* ───────────────── page ───────────────── */

export default function SparkCalendar() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor] = useState(new Date());

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SHIFTS BOARD · {monthLabel(anchor)}
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Every shift, at a glance.
            </h1>
          </div>
          <div className="pill-group">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`pill-btn ${v === view ? "on" : ""}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">THIS WEEK</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">UNDER-STAFFED</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-orange)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">HOURS</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">PAYROLL</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
        </div>

        {/* Grid */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading shifts…
            </div>
          }
        >
          <SparkCalendarInner anchor={anchor} />
        </Suspense>
      </div>
    </Layout>
  );
}
