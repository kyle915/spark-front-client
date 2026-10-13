import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { BrandCompareGateQuery } from "@/api/queries/BrandCompareGateQuery";
import type { BrandCompareGateQuery as BrandCompareGateQueryType } from "@api/queries/__generated__/BrandCompareGateQuery.graphql";
import { BrandGroupCompareQuery } from "@/api/queries/BrandGroupCompareQuery";
import type { BrandGroupCompareQuery as BrandGroupCompareQueryType } from "@api/queries/__generated__/BrandGroupCompareQuery.graphql";
import { BrandGroupAccessQuery } from "@/api/queries/BrandGroupAccessQuery";
import type { BrandGroupAccessQuery as BrandGroupAccessQueryType } from "@api/queries/__generated__/BrandGroupAccessQuery.graphql";
import { SetBrandGroupAccessMutation } from "@/api/mutations/SetBrandGroupAccessMutation";
import type { SetBrandGroupAccessMutation as SetBrandGroupAccessMutationType } from "@/api/mutations/__generated__/SetBrandGroupAccessMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import type { BrandView } from "./useBrandView";

const muted = "rgba(255,255,255,0.55)";

function SwitchInner({
  tenantId,
  view,
  onChange,
}: {
  tenantId: string;
  view: BrandView;
  onChange: (next: BrandView) => void;
}) {
  const data = useLazyLoadQuery<BrandCompareGateQueryType>(
    BrandCompareGateQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const allowed = data.canCompareBrands;
  useEffect(() => {
    if (!allowed && view === "compare") onChange("brand");
  }, [allowed, view, onChange]);
  if (!allowed) return null;
  return (
    <div
      role="tablist"
      aria-label="Brand view"
      className="inline-flex p-1 rounded-xl"
      style={{ border: "1px solid var(--spark-border)" }}
    >
      {(
        [
          { key: "brand", label: "This brand" },
          { key: "compare", label: "Compare brands" },
        ] as { key: BrandView; label: string }[]
      ).map((t) => {
        const active = view === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
            style={{
              background: active ? "var(--spark-lime)" : "transparent",
              color: active ? "#0a0a0a" : muted,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Renders nothing unless this brand is in a group the viewer may compare. */
export function BrandViewSwitch(props: {
  tenantId: string | null;
  view: BrandView;
  onChange: (next: BrandView) => void;
}) {
  if (!props.tenantId) return null;
  return (
    <Suspense fallback={null}>
      <SwitchInner tenantId={props.tenantId} view={props.view} onChange={props.onChange} />
    </Suspense>
  );
}

type Period = "30" | "90" | "ytd" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All time" },
];

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const periodRange = (p: Period): { startDate: string | null; endDate: string | null } => {
  const today = new Date();
  switch (p) {
    case "30":
    case "90": {
      const start = new Date(today);
      start.setDate(today.getDate() - Number(p));
      return { startDate: iso(start), endDate: iso(today) };
    }
    case "ytd":
      return { startDate: `${today.getFullYear()}-01-01`, endDate: iso(today) };
    case "all":
      return { startDate: null, endDate: null };
    default: {
      const unreachable: never = p;
      return unreachable;
    }
  }
};

const fmt = (n: number) => n.toLocaleString();

function CompareBody({
  tenantId,
  period,
  coOnly,
}: {
  tenantId: string;
  period: Period;
  coOnly: boolean;
}) {
  const range = useMemo(() => periodRange(period), [period]);
  const data = useLazyLoadQuery<BrandGroupCompareQueryType>(
    BrandGroupCompareQuery,
    { tenantId, ...range, coActivationsOnly: coOnly },
    { fetchPolicy: "store-and-network" },
  );
  const cmp = data.brandGroupCompare;
  if (!cmp) {
    return (
      <div className="spark-card p-6 text-sm" style={{ color: muted }}>
        Brand comparison isn&apos;t available for this brand.
      </div>
    );
  }
  const maxSampled = Math.max(1, ...cmp.brands.map((b) => b.consumersSampled));
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Activations" value={fmt(cmp.activations)} sub="Multi-brand counted once" />
        <Kpi label="Co-activations" value={fmt(cmp.coActivations)} sub="2+ brands on one shift" />
        <Kpi
          label="Brand recaps"
          value={fmt(cmp.brands.reduce((s, b) => s + b.recaps, 0))}
          sub="One per brand per shift"
        />
        <Kpi
          label="Units sold"
          value={fmt(cmp.brands.reduce((s, b) => s + b.unitsSold, 0))}
          sub="Each brand's own sales"
        />
      </div>

      <div className="spark-card p-5 overflow-x-auto">
        <p className="mono text-[10px] mb-3" style={{ letterSpacing: "0.18em", color: muted }}>
          {cmp.groupName.toUpperCase()} · PER BRAND
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: muted }}>
              <th className="py-2 pr-3 font-medium">Brand</th>
              <th className="py-2 pr-3 font-medium text-right">Recaps</th>
              <th className="py-2 pr-3 font-medium text-right">Co-activation</th>
              <th className="py-2 pr-3 font-medium text-right">Consumers sampled</th>
              <th className="py-2 pr-3 font-medium text-right">Units sold</th>
              <th className="py-2 font-medium text-right">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {cmp.brands.map((b) => (
              <tr key={b.tenantPk} style={{ borderTop: "1px solid var(--spark-border)" }}>
                <td className="py-2.5 pr-3">
                  <div className="font-semibold">{b.name}</div>
                  <div
                    className="h-1.5 rounded-full mt-1.5"
                    style={{
                      width: `${Math.max(4, (b.consumersSampled / maxSampled) * 100)}%`,
                      background: "var(--spark-lime)",
                      opacity: 0.8,
                    }}
                  />
                </td>
                <td className="py-2.5 pr-3 text-right tab-num">
                  {fmt(b.recaps)}
                  <div className="text-[11px]" style={{ color: muted }}>
                    {fmt(b.retailRecaps)} retail · {fmt(b.otherRecaps)} event
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right tab-num">{fmt(b.coActivationRecaps)}</td>
                <td className="py-2.5 pr-3 text-right tab-num">{fmt(b.consumersSampled)}</td>
                <td className="py-2.5 pr-3 text-right tab-num">{fmt(b.unitsSold)}</td>
                <td className="py-2.5 text-right tab-num">
                  {b.conversionPct == null ? "—" : `${b.conversionPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cmp.notes.length > 0 ? (
        <ul className="text-[12px] space-y-1 pl-4 list-disc" style={{ color: muted }}>
          {cmp.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="spark-card p-4">
      <p className="text-sm mb-1" style={{ color: muted }}>
        {label}
      </p>
      <p className="tab-num text-2xl font-bold leading-none">{value}</p>
      {sub ? (
        <p className="text-[11px] mt-1.5" style={{ color: muted }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function AccessManager({ tenantId }: { tenantId: string }) {
  const { showAlert } = useAlertStore();
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<BrandGroupAccessQueryType>(
    BrandGroupAccessQuery,
    { tenantId },
    { fetchPolicy: "network-only", fetchKey },
  );
  const [commit, busy] = useMutation<SetBrandGroupAccessMutationType>(SetBrandGroupAccessMutation);
  const [email, setEmail] = useState("");

  const save = (target: string, granted: boolean) =>
    commit({
      variables: { tenantId, email: target.trim(), granted },
      onCompleted: (_, errors) => {
        if (errors?.length) {
          showAlert(errors[0].message, "error");
          return;
        }
        if (granted) setEmail("");
        setFetchKey((k) => k + 1);
        showAlert(granted ? "Compare access granted" : "Compare access removed", "success");
      },
      onError: (e) => showAlert(e.message, "error"),
    });

  return (
    <div className="spark-card p-5">
      <p className="mono text-[10px] mb-1" style={{ letterSpacing: "0.18em", color: muted }}>
        WHO CAN COMPARE
      </p>
      <p className="text-[12px] mb-3" style={{ color: muted }}>
        Ignite staff always see this tab. Brand contacts only see it when added here.
      </p>
      <ul className="space-y-1.5 mb-3">
        {data.brandGroupAccess.length === 0 ? (
          <li className="text-sm" style={{ color: muted }}>
            No brand contacts yet.
          </li>
        ) : (
          data.brandGroupAccess.map((g) => (
            <li key={g.userPk} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {g.name || g.email}
                {g.name ? (
                  <span className="ml-2" style={{ color: muted }}>
                    {g.email}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => save(g.email, false)}
                className="text-[12px] px-2 py-1 rounded-lg"
                style={{ border: "1px solid var(--spark-border)", color: muted }}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) save(email, true);
        }}
      >
        <input
          type="email"
          className="input input-sm input-bordered flex-1"
          placeholder="client@brand.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={busy || !email.trim()} className="btn btn-sm">
          Grant
        </button>
      </form>
    </div>
  );
}

/** Body of the "Compare brands" view: per-brand table + staff access list. */
export function BrandComparePanel({
  tenantId,
  canManageAccess,
}: {
  tenantId: string;
  canManageAccess: boolean;
}) {
  const [period, setPeriod] = useState<Period>("90");
  const [coOnly, setCoOnly] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className="mono text-[10px] px-2.5 py-1.5 rounded-lg"
            style={{
              letterSpacing: "0.12em",
              color: period === p.key ? "#0a0a0a" : muted,
              background: period === p.key ? "var(--spark-lime)" : "transparent",
              border: "1px solid var(--spark-border)",
            }}
          >
            {p.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm ml-2 cursor-pointer" style={{ color: muted }}>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={coOnly}
            onChange={(e) => setCoOnly(e.target.checked)}
          />
          Co-activations only
        </label>
      </div>
      <Suspense
        fallback={
          <div className="spark-card p-6 text-sm" style={{ color: muted }}>
            Loading brand comparison…
          </div>
        }
      >
        <CompareBody tenantId={tenantId} period={period} coOnly={coOnly} />
      </Suspense>
      {canManageAccess ? (
        <Suspense fallback={null}>
          <AccessManager tenantId={tenantId} />
        </Suspense>
      ) : null}
    </div>
  );
}
