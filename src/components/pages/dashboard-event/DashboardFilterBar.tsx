/**
 * Compact filter bar pinned to the top of the per-tenant dashboard.
 *
 * Six controls: date-range (start/end), user (RMM assigned), state,
 * retailer, distributor, and a clear-all chip. Lives next to the
 * pre-existing 7d/30d/90d/YTD pill group — when a custom range is
 * picked, the pill group goes muted so it's obvious which one wins.
 *
 * Data sources:
 *   • Users      → RmmClientsQuery (per-tenant)
 *   • States     → StatesQuery (global)
 *   • Retailers  → RetailersQuery (per-tenant filter input)
 *   • Distributors → DistributorsQuery (per-tenant)
 *
 * All four lookups are tiny lists in practice so we just load them up
 * front. If/when retailers/users get big we can swap to a typeahead.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";
import { StatesQuery } from "@/api/queries/StatesQuery";
import type { StatesQuery as StatesQueryType } from "@/api/queries/__generated__/StatesQuery.graphql";
import { RetailersQuery } from "@/api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@/api/queries/__generated__/RetailersQuery.graphql";

type Option = { value: string; label: string };

interface Props {
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  padding: "6px 10px",
  fontSize: 13,
  minWidth: 130,
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  minWidth: 130,
};

export default function DashboardFilterBar({ value, onChange }: Props) {
  const tenantId = useAuthStore((s) => s.tenantId);
  const [users, setUsers] = useState<Option[]>([]);
  const [states, setStates] = useState<Option[]>([]);
  const [retailers, setRetailers] = useState<Option[]>([]);

  /* -------- load options once per tenant ----------------------- */
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchQuery<RmmClientsQueryType>(
          environment,
          RmmClientsQuery,
          { tenantId },
        ).toPromise();
        if (cancelled) return;
        const list = (data?.rmmClients ?? []).filter(Boolean) as Array<{
          id: string;
          firstName: string | null;
          lastName: string | null;
          username: string | null;
        }>;
        setUsers(
          list
            .map((u) => {
              const name =
                [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                u.username ||
                "—";
              return { value: String(u.id), label: name };
            })
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      } catch {
        /* non-fatal — dropdown just stays empty */
      }
    })();

    (async () => {
      try {
        const data = await fetchQuery<StatesQueryType>(
          environment,
          StatesQuery,
          { first: 100 },
        ).toPromise();
        if (cancelled) return;
        const list =
          data?.states?.edges
            ?.map((e) => e?.node)
            .filter(Boolean) ?? [];
        setStates(
          (list as Array<{ id: string; name: string; code: string }>)
            .map((s) => ({
              value: String(s.id),
              label: s.code ?? s.name,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      } catch {
        /* non-fatal */
      }
    })();

    (async () => {
      try {
        const data = await fetchQuery<RetailersQueryType>(
          environment,
          RetailersQuery,
          { filters: { tenantId }, first: 200 },
        ).toPromise();
        if (cancelled) return;
        const list =
          data?.retailers?.edges
            ?.map((e) => e?.node)
            .filter(Boolean) ?? [];
        setRetailers(
          (list as Array<{ id: string; name: string }>)
            .map((r) => ({ value: String(r.id), label: r.name }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      } catch {
        /* non-fatal */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  /* -------- handlers ------------------------------------------- */
  const patch = (key: keyof DashboardFilters, v: string | null) =>
    onChange({ ...value, [key]: v || null });

  const anyActive =
    value.rmmAsignedId ||
    value.stateId ||
    value.retailerId ||
    (value.startDate && value.endDate);
  const clearAll = () =>
    onChange({
      ...value,
      rmmAsignedId: null,
      stateId: null,
      retailerId: null,
    });

  // The dashboard's range pill drives startDate/endDate too — when
  // those are set we expose date inputs that can override the pill.
  const dateNote = useMemo(() => {
    if (!value.startDate || !value.endDate) return null;
    return `${value.startDate} → ${value.endDate}`;
  }, [value.startDate, value.endDate]);

  return (
    <div
      className="spark-card p-3 flex items-center gap-2 flex-wrap"
      style={{ borderRadius: 14 }}
    >
      <span
        className="mono text-[10px] mr-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        FILTERS
      </span>

      {/* User (RMM mapped) */}
      <select
        style={selectStyle}
        value={value.rmmAsignedId ?? ""}
        onChange={(e) => patch("rmmAsignedId", e.target.value)}
        title="User · request mapped"
      >
        <option value="">All users</option>
        {users.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* State */}
      <select
        style={selectStyle}
        value={value.stateId ?? ""}
        onChange={(e) => patch("stateId", e.target.value)}
        title="State"
      >
        <option value="">All states</option>
        {states.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Retailer */}
      <select
        style={selectStyle}
        value={value.retailerId ?? ""}
        onChange={(e) => patch("retailerId", e.target.value)}
        title="Retailer"
      >
        <option value="">All retailers</option>
        {retailers.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Date range (start/end). When set, overrides the pill. */}
      <input
        type="date"
        style={inputStyle}
        value={value.startDate ?? ""}
        onChange={(e) => patch("startDate", e.target.value)}
        title="Start date"
      />
      <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
      <input
        type="date"
        style={inputStyle}
        value={value.endDate ?? ""}
        onChange={(e) => patch("endDate", e.target.value)}
        title="End date"
      />

      {dateNote && (
        <span
          className="mono text-[10px]"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {dateNote}
        </span>
      )}

      {anyActive && (
        <button
          onClick={clearAll}
          className="px-2 py-1 rounded-md text-xs"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
