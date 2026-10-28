import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { clientOrigin } from "@/utils/publicHosts";
import { postGql } from "./fieldMarketingGql";
import PushToPlanSheet from "./PushToPlanSheet";
import type { RecapKind } from "./planResultsApi";

type Manager = { market: string; marketLabel: string; name: string };

type EventRecapRow = {
  id: string;
  kind: RecapKind;
  uuid: string;
  date: string;
  type: string;
  typeLabel: string;
  name: string;
  place: string;
  cityState: string;
  market: string;
  marketLabel: string;
  baName: string;
  consumersSampled: number | null;
  samples: number | null;
  samplesLabel: string;
  sampleFormat: string;
  /** 4oz pours served — separate from cans; null on recaps that didn't ask. */
  pours: number | null;
  emails: number | null;
  planId: string | null;
  planName: string;
  planCode: string | null;
  href: string;
};

type EventRecaps = {
  start: string;
  end: string;
  canAttach: boolean;
  truncated: boolean;
  rows: EventRecapRow[];
};

type Attached = "" | "attached" | "unattached";

const TYPES = [
  { id: "event", label: "Event" },
  { id: "guerilla", label: "Guerilla" },
  { id: "seeding", label: "Seeding" },
];

const QUERY = `
  query FieldMarketingEventRecaps(
    $tenantId: ID, $month: String, $start: String, $end: String,
    $markets: [String!], $types: [String!], $attached: String
  ) {
    fieldMarketingEventRecaps(
      tenantId: $tenantId, month: $month, start: $start, end: $end,
      markets: $markets, types: $types, attached: $attached
    ) {
      start end canAttach truncated
      rows {
        id kind uuid date type typeLabel name place cityState market marketLabel
        baName consumersSampled samples samplesLabel sampleFormat pours emails
        planId planName planCode href
      }
    }
  }
`;

function fmtNum(value: number | null): string {
  return value == null ? "—" : value.toLocaleString();
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toggle(set: string[], id: string): string[] {
  return set.includes(id) ? set.filter((v) => v !== id) : [...set, id];
}

/**
 * Approved Event / Guerilla / Seeding recaps in the selected RMM's markets
 * for the scorecard's month. Rows are listed, never summed — several BAs on
 * one event each report that event's numbers.
 */
export default function FieldMarketingEventRecaps({
  month,
  market,
  managers,
  onAttached,
}: {
  month: string;
  market: string;
  managers: Manager[];
  onAttached?: () => void;
}) {
  const { tenantId } = useAuthStore();
  const [markets, setMarkets] = useState<string[]>(market ? [market] : []);
  const [types, setTypes] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [attached, setAttached] = useState<Attached>("");
  const [data, setData] = useState<EventRecaps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<EventRecapRow | null>(null);

  const [scopedTo, setScopedTo] = useState(market);
  if (scopedTo !== market) {
    setScopedTo(market);
    setMarkets(market ? [market] : []);
  }

  useEffect(() => {
    setStart("");
    setEnd("");
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await postGql<{ fieldMarketingEventRecaps: EventRecaps }>(
        QUERY,
        {
          tenantId: tenantId || null,
          month,
          start: start || null,
          end: end || null,
          markets: markets.length ? markets : null,
          types: types.length ? types : null,
          attached: attached || null,
        },
      );
      setData(res.fieldMarketingEventRecaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recaps.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, month, start, end, markets, types, attached]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const onPlan = rows.filter((r) => r.planId).length;
  const recapUrl = (row: EventRecapRow) =>
    data?.canAttach ? row.href : `${clientOrigin()}${row.href}`;
  const marketChips = [
    ...managers.map((m) => ({ id: m.market, label: m.marketLabel })),
    { id: "unassigned", label: "No market" },
  ];

  return (
    <section className="space-y-3" aria-label="Event recaps">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="spark-title text-lg">Event recaps</p>
          <p className="text-xs opacity-60">
            Approved Event, Guerilla and Seeding recaps
            {data ? ` · ${dayLabel(data.start)} – ${dayLabel(data.end)}` : ""}.
            Retail sampling recaps stay on the Recaps tab.
          </p>
        </div>
        {data ? (
          <p className="mono text-[11px] opacity-60">
            {rows.length} recap{rows.length === 1 ? "" : "s"} · {onPlan} on a
            plan
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 items-center" aria-label="Markets">
        <button
          type="button"
          className={`pill-btn ${markets.length === 0 ? "on" : ""}`}
          onClick={() => setMarkets([])}
        >
          All markets
        </button>
        {marketChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={markets.includes(chip.id)}
            className={`pill-btn ${markets.includes(chip.id) ? "on" : ""}`}
            onClick={() => setMarkets((cur) => toggle(cur, chip.id))}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={types.includes(t.id)}
            className={`pill-btn ${types.includes(t.id) ? "on" : ""}`}
            onClick={() => setTypes((cur) => toggle(cur, t.id))}
          >
            {t.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs opacity-80">
          From
          <input
            type="date"
            className="input input-xs input-bordered bg-transparent"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs opacity-80">
          To
          <input
            type="date"
            className="input input-xs input-bordered bg-transparent"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        {start || end ? (
          <button
            type="button"
            className="spark-btn-ghost text-xs"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
          >
            Use month
          </button>
        ) : null}
        <select
          className="select select-xs select-bordered bg-transparent"
          value={attached}
          onChange={(e) => setAttached(e.target.value as Attached)}
          aria-label="Attached to a plan"
        >
          <option value="">On a plan or not</option>
          <option value="attached">On a plan</option>
          <option value="unattached">Not on a plan</option>
        </select>
      </div>

      {error ? (
        <p className="text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider opacity-60">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Event / venue</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">BA</th>
                <th className="px-3 py-2 text-right">Consumers sampled</th>
                <th className="px-3 py-2 text-right">Cans sampled</th>
                <th className="px-3 py-2 text-right">Emails</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-sm opacity-60">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-sm opacity-60">
                    No approved event recaps for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-white/5">
                    <td className="px-3 py-2 whitespace-nowrap tab-num">
                      {dayLabel(row.date)}
                    </td>
                    <td className="px-3 py-2">{row.typeLabel}</td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      <p className="font-medium leading-snug">{row.name}</p>
                      {row.cityState || row.place ? (
                        <p className="text-[11px] opacity-55 leading-snug">
                          {row.cityState || row.place}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.marketLabel}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.baName || "—"}</td>
                    <td className="px-3 py-2 text-right tab-num">
                      {fmtNum(row.consumersSampled)}
                    </td>
                    <td
                      className="px-3 py-2 text-right tab-num"
                      title={
                        [row.samplesLabel, row.sampleFormat]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                    >
                      {fmtNum(row.samples)}
                      {row.sampleFormat ? (
                        <p className="text-[10px] opacity-50 whitespace-nowrap">
                          {row.sampleFormat}
                        </p>
                      ) : null}
                      {row.pours != null ? (
                        <p className="text-[10px] opacity-70 whitespace-nowrap">
                          + {row.pours.toLocaleString()} 4oz pours
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tab-num">{fmtNum(row.emails)}</td>
                    <td className="px-3 py-2 min-w-[9rem]">
                      {row.planId ? (
                        <span className="text-xs">
                          {row.planName}
                          {row.planCode ? (
                            <span className="opacity-50"> · {row.planCode}</span>
                          ) : null}
                        </span>
                      ) : data?.canAttach ? (
                        <button
                          type="button"
                          className="spark-btn-ghost text-xs"
                          onClick={() => setTarget(row)}
                        >
                          Attach
                        </button>
                      ) : (
                        <span className="text-xs opacity-45">Not on a plan</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a
                        href={recapUrl(row)}
                        className="text-xs underline-offset-2 hover:underline"
                        style={{ color: "var(--spark-lime, #f2f3ee)" }}
                      >
                        Open recap
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {data?.truncated ? (
        <p className="text-xs opacity-55">
          Showing the newest 300. Narrow the dates or markets to see the rest.
        </p>
      ) : null}
      <p className="text-xs opacity-55">
        Each BA files their own recap, so one event can show several rows with
        the same event numbers — rows aren't added up. Market comes from the
        recap's own address, else the plan it's on.
      </p>

      {target ? (
        <PushToPlanSheet
          open
          onOpenChange={(next) => {
            if (!next) setTarget(null);
          }}
          recapId={target.id}
          kind={target.kind}
          recapName={target.name}
          onChanged={() => {
            void load();
            onAttached?.();
          }}
        />
      ) : null}
    </section>
  );
}
