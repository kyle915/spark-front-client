import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import ProgramSwitch from "./ProgramSwitch";

/**
 * Torch field marketing planner. Separate from retail sampling.
 * Marketers plan the month, submit events onto the tracker for Ignite,
 * and log results against the monthly KPI scorecard.
 */

type Manager = {
  market: string;
  marketLabel: string;
  name: string;
  email: string;
  phone: string;
};

type Kpi = {
  key: string;
  label: string;
  detail: string;
  target: number;
  planned: number;
  logged: number | null;
  unit: string;
};

type FmEvent = {
  id: string;
  market: string;
  marketLabel: string;
  managerName: string;
  activity: string;
  activityLabel: string;
  name: string;
  startsOn: string;
  days: number;
  address: string;
  notes: string;
  plannedFullCans: number;
  plannedPourSamples: number;
  plannedEmails: number;
  loggedFullCans: number | null;
  loggedPourSamples: number | null;
  loggedEmails: number | null;
  loggedDays: number | null;
  status: string;
  requestCode: string | null;
};

type Board = {
  available: boolean;
  month: string;
  monthLabel: string;
  managers: Manager[];
  kpis: Kpi[];
  events: FmEvent[];
};

const BOARD = `
  query FieldMarketingBoard($month: String) {
    fieldMarketing(month: $month) {
      available
      month
      monthLabel
      managers { market marketLabel name email phone }
      kpis { key label detail target planned logged unit }
      events {
        id market marketLabel managerName activity activityLabel name startsOn days
        address notes plannedFullCans plannedPourSamples plannedEmails
        loggedFullCans loggedPourSamples loggedEmails loggedDays status requestCode
      }
    }
  }
`;

const PLAN = `
  mutation PlanFieldMarketing($input: PlanFieldMarketingInput!) {
    planFieldMarketing(input: $input) {
      success
      message
    }
  }
`;

const SUBMIT = `
  mutation SubmitFieldMarketing($input: SubmitFieldMarketingInput!) {
    submitFieldMarketing(input: $input) {
      success
      message
    }
  }
`;

const LOG = `
  mutation LogFieldMarketing($input: LogFieldMarketingInput!) {
    logFieldMarketing(input: $input) {
      success
      message
    }
  }
`;

const ACTIVITIES = [
  { id: "full_can", label: "Full can samples" },
  { id: "pour", label: "4oz pour samples" },
  { id: "sponsorship", label: "Local event sponsorship" },
  { id: "retail_support", label: "Retail activation / support" },
];

async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}

function shiftMonth(month: string, delta: number): string {
  const [yearS, monS] = month.split("-");
  const cursor = new Date(Number(yearS), Number(monS) - 1 + delta, 1);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtNum(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

const emptyForm = {
  market: "miami",
  activity: "full_can",
  name: "",
  startsOn: "",
  days: "1",
  address: "",
  notes: "",
  plannedFullCans: "",
  plannedPourSamples: "",
  plannedEmails: "",
};

export default function FieldMarketing() {
  const [month, setMonth] = useState(currentMonth);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logDraft, setLogDraft] = useState({
    cans: "",
    pours: "",
    emails: "",
    days: "",
  });

  const load = useCallback(async (nextMonth: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await postGql<{ fieldMarketing: Board }>(BOARD, {
        month: nextMonth,
      });
      setBoard(data.fieldMarketing);
      setMonth(data.fieldMarketing.month || nextMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    // Initial load only. Month changes go through the buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activity = form.activity;
  const showCans = activity === "full_can" || activity === "sponsorship";
  const showPours = activity === "pour" || activity === "sponsorship";
  const showDays = activity === "sponsorship";

  const managers = board?.managers ?? [];

  const plannedLine = useMemo(() => {
    const count = board?.events.length ?? 0;
    if (!count) return "Nothing planned this month.";
    const submitted = board?.events.filter((row) => row.status === "submitted").length ?? 0;
    return `${count} planned · ${submitted} with Ignite`;
  }, [board]);

  async function save(submit: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const num = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return 0;
        const value = Number(trimmed);
        if (!Number.isFinite(value)) throw new Error("Use whole numbers.");
        return Math.round(value);
      };
      await postGql(PLAN, {
        input: {
          market: form.market,
          activity: form.activity,
          name: form.name.trim(),
          startsOn: form.startsOn,
          days: showDays ? num(form.days || "1") : 1,
          address: form.address.trim(),
          notes: form.notes.trim(),
          plannedFullCans: showCans ? num(form.plannedFullCans) : 0,
          plannedPourSamples: showPours ? num(form.plannedPourSamples) : 0,
          plannedEmails: num(form.plannedEmails),
          submit,
        },
      });
      setForm({ ...emptyForm, market: form.market, activity: form.activity });
      setNotice(submit ? "Submitted to Ignite." : "Saved to the plan.");
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function submitExisting(eventId: string) {
    setError("");
    setNotice("");
    try {
      await postGql(SUBMIT, { input: { eventId } });
      setNotice("Submitted to Ignite.");
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    }
  }

  async function logEvent(row: FmEvent) {
    setError("");
    setNotice("");
    const optional = (raw: string): number | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const value = Number(trimmed);
      if (!Number.isFinite(value)) throw new Error("Use whole numbers.");
      return Math.round(value);
    };
    try {
      await postGql(LOG, {
        input: {
          eventId: row.id,
          loggedFullCans:
            row.activity === "full_can" || row.activity === "sponsorship"
              ? optional(logDraft.cans)
              : null,
          loggedPourSamples:
            row.activity === "pour" || row.activity === "sponsorship"
              ? optional(logDraft.pours)
              : null,
          loggedEmails: optional(logDraft.emails),
          loggedDays: row.activity === "sponsorship" ? optional(logDraft.days) : null,
        },
      });
      setLoggingId(null);
      setNotice("Logged. The scorecard uses this number.");
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log.");
    }
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl spark-fade-in">
        <SparkPageHeader
          eyebrow="TORCH THC · FIELD MARKETING"
          title="Field marketing."
          support="Plan the month, submit events for Ignite to execute, and log the scorecard. Retail sampling stays on My requests."
        />
        <ProgramSwitch active="field" />

        {board && !board.available ? (
          <p className="spark-support">
            Field marketing is the Torch THC program. Switch to that brand to plan it.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm" style={{ color: "var(--spark-lime, #c5f546)" }}>
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => {
                const next = shiftMonth(month, -1);
                setMonth(next);
                void load(next);
              }}
            >
              Prev
            </button>
            <p className="spark-title text-lg">{board?.monthLabel || month}</p>
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => {
                const next = shiftMonth(month, 1);
                setMonth(next);
                void load(next);
              }}
            >
              Next
            </button>
          </div>
          <p className="spark-support">{loading ? "Loading…" : plannedLine}</p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(board?.kpis ?? []).map((kpi) => (
            <article
              key={kpi.key}
              className="rounded-2xl border border-white/10 p-4"
              style={{ background: "#0A0B0D" }}
            >
              <p className="label-mini mb-2">{kpi.label}</p>
              <p className="text-2xl font-bold tabular-nums">
                {fmtNum(kpi.logged)}
                <span className="text-sm font-normal opacity-60">
                  {" "}
                  / {kpi.target.toLocaleString()}
                </span>
              </p>
              <p className="mt-2 text-xs opacity-70">
                Planned {kpi.planned.toLocaleString()} {kpi.unit}
              </p>
              <p className="mt-2 text-xs leading-snug opacity-60">{kpi.detail}</p>
            </article>
          ))}
        </section>
        <p className="text-xs opacity-60">
          The big number is logged. A dash means nobody has reported that result yet.
          Planned is what is on the calendar. Targets are the monthly scorecard.
        </p>

        {managers.length ? (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {managers.map((manager) => (
              <article key={manager.market} className="rounded-2xl border border-white/10 p-4">
                <p className="label-mini mb-1">{manager.marketLabel}</p>
                <p className="font-semibold">{manager.name}</p>
                <p className="text-sm opacity-70">{manager.phone}</p>
                <a className="text-sm" href={`mailto:${manager.email}`}>
                  {manager.email}
                </a>
              </article>
            ))}
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 p-4 space-y-3">
          <p className="label-mini">Plan an event</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="opacity-70">Market</span>
              <select
                className="input input-bordered w-full"
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value })}
              >
                {(managers.length
                  ? managers
                  : [
                      { market: "miami", marketLabel: "Miami" },
                      { market: "orlando", marketLabel: "Orlando" },
                      { market: "houston", marketLabel: "Houston" },
                      { market: "austin-dallas", marketLabel: "Austin / Dallas" },
                    ]
                ).map((manager) => (
                  <option key={manager.market} value={manager.market}>
                    {manager.marketLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="opacity-70">Activity</span>
              <select
                className="input input-bordered w-full"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
              >
                {ACTIVITIES.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="opacity-70">Event</span>
              <input
                className="input input-bordered w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Wynwood product drop"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="opacity-70">Date</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={form.startsOn}
                onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
              />
            </label>
            {showDays ? (
              <label className="text-sm space-y-1">
                <span className="opacity-70">Days</span>
                <input
                  inputMode="numeric"
                  className="input input-bordered w-full"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                />
              </label>
            ) : null}
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="opacity-70">Address</span>
              <input
                className="input input-bordered w-full"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Required before Ignite can execute it"
              />
            </label>
            {showCans ? (
              <label className="text-sm space-y-1">
                <span className="opacity-70">Planned full cans</span>
                <input
                  inputMode="numeric"
                  className="input input-bordered w-full"
                  value={form.plannedFullCans}
                  onChange={(e) => setForm({ ...form, plannedFullCans: e.target.value })}
                />
              </label>
            ) : null}
            {showPours ? (
              <label className="text-sm space-y-1">
                <span className="opacity-70">Planned 4oz pours</span>
                <input
                  inputMode="numeric"
                  className="input input-bordered w-full"
                  value={form.plannedPourSamples}
                  onChange={(e) =>
                    setForm({ ...form, plannedPourSamples: e.target.value })
                  }
                />
              </label>
            ) : null}
            <label className="text-sm space-y-1">
              <span className="opacity-70">Planned emails</span>
              <input
                inputMode="numeric"
                className="input input-bordered w-full"
                value={form.plannedEmails}
                onChange={(e) => setForm({ ...form, plannedEmails: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="opacity-70">Notes</span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="spark-btn-ghost"
              disabled={saving}
              onClick={() => void save(false)}
            >
              Save plan
            </button>
            <button
              type="button"
              className="spark-btn-primary"
              disabled={saving}
              onClick={() => void save(true)}
            >
              Submit to Ignite
            </button>
          </div>
        </section>

        <section className="space-y-2">
          {(board?.events ?? []).map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-mini">
                    {fmtDay(row.startsOn)} · {row.marketLabel} · {row.activityLabel}
                  </p>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-sm opacity-70">
                    {row.managerName}
                    {row.address ? ` · ${row.address}` : ""}
                  </p>
                  <p className="text-sm opacity-70">
                    Plan{" "}
                    {[
                      row.plannedFullCans ? `${row.plannedFullCans} cans` : "",
                      row.plannedPourSamples ? `${row.plannedPourSamples} pours` : "",
                      row.activity === "sponsorship" ? `${row.days} days` : "",
                      row.plannedEmails ? `${row.plannedEmails} emails` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "no sample target"}
                    {row.loggedFullCans != null ||
                    row.loggedPourSamples != null ||
                    row.loggedEmails != null ||
                    row.loggedDays != null
                      ? ` · Logged ${[
                          row.loggedFullCans != null ? `${row.loggedFullCans} cans` : "",
                          row.loggedPourSamples != null
                            ? `${row.loggedPourSamples} pours`
                            : "",
                          row.loggedDays != null ? `${row.loggedDays} days` : "",
                          row.loggedEmails != null ? `${row.loggedEmails} emails` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill-btn on">
                    {row.status === "submitted"
                      ? row.requestCode || "With Ignite"
                      : "Planned"}
                  </span>
                  {row.status !== "submitted" ? (
                    <button
                      type="button"
                      className="spark-btn-primary"
                      onClick={() => void submitExisting(row.id)}
                    >
                      Submit to Ignite
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="spark-btn-ghost"
                    onClick={() => {
                      setLoggingId(loggingId === row.id ? null : row.id);
                      setLogDraft({ cans: "", pours: "", emails: "", days: "" });
                    }}
                  >
                    Log results
                  </button>
                </div>
              </div>
              {loggingId === row.id ? (
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {row.activity === "full_can" || row.activity === "sponsorship" ? (
                    <input
                      className="input input-bordered"
                      inputMode="numeric"
                      placeholder="Cans logged"
                      value={logDraft.cans}
                      onChange={(e) => setLogDraft({ ...logDraft, cans: e.target.value })}
                    />
                  ) : null}
                  {row.activity === "pour" || row.activity === "sponsorship" ? (
                    <input
                      className="input input-bordered"
                      inputMode="numeric"
                      placeholder="Pours logged"
                      value={logDraft.pours}
                      onChange={(e) => setLogDraft({ ...logDraft, pours: e.target.value })}
                    />
                  ) : null}
                  {row.activity === "sponsorship" ? (
                    <input
                      className="input input-bordered"
                      inputMode="numeric"
                      placeholder="Days logged"
                      value={logDraft.days}
                      onChange={(e) => setLogDraft({ ...logDraft, days: e.target.value })}
                    />
                  ) : null}
                  <input
                    className="input input-bordered"
                    inputMode="numeric"
                    placeholder="Emails logged"
                    value={logDraft.emails}
                    onChange={(e) => setLogDraft({ ...logDraft, emails: e.target.value })}
                  />
                  <button
                    type="button"
                    className="spark-btn-primary"
                    onClick={() => void logEvent(row)}
                  >
                    {row.activity === "retail_support" ? "Save / mark done" : "Save logged"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </Layout>
  );
}
