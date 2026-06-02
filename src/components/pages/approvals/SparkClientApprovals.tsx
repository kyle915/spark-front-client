import { Suspense, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { ApproveRecapMutation } from "@/api/mutations/ApproveRecapMutation";
import type { ApproveRecapMutation as ApproveRecapMutationType } from "@api/mutations/__generated__/ApproveRecapMutation.graphql";
import { ApproveCustomRecapMutation } from "@/api/mutations/ApproveCustomRecapMutation";
import type { ApproveCustomRecapMutation as ApproveCustomRecapMutationType } from "@api/mutations/__generated__/ApproveCustomRecapMutation.graphql";

/**
 * Spark v2 — Client Approvals (/my-approvals).
 *
 * The clean, brand-stakeholder counterpart to the admin `/approvals`
 * ops queue. Where the admin page is the RMM request-approval workload
 * (bulk approve/decline, decline-reason emails to requestors, SLA
 * tracking, "copy queue for Slack"), this page answers one question for
 * a client: "what recaps are still waiting on me?"
 *
 * It lists the client's own recaps that haven't been signed off yet
 * (approved == false), each with the event/recap summary and a
 * "Review" link to the recap detail. No admin ops controls.
 *
 * DATA SCOPE — safe. Both `recaps` and `customRecaps` are tenant-scoped
 * server-side (recaps/queries.py filters `event__tenant_id=tenant_id`),
 * and we pass `useAuthStore().tenantId` — the same id every per-tenant
 * surface resolves — so a client only ever sees their own tenant's
 * recaps. We additionally pass `approved: false` to fetch only the
 * pending pile.
 *
 * ONE-CLICK SIGN-OFF (safe as of the recap-IDOR sweep). approveRecap /
 * approveCustomRecap are now tenant-scoped on the backend: they authorize
 * the caller against the recap's owning tenant (#708) and a cross-tenant
 * id is denied with a non-existence-leaking "not found" (#247). So a
 * client can sign off their OWN recap straight from this list, and a
 * guessed cross-tenant id can neither be approved nor probed. Each row
 * keeps its "Review" link to the detail view; the inline "Approve" adds a
 * two-step confirm so a sign-off (which emails the requestor + mapped RMM
 * the PDF) is never a single stray click. On success the row drops off
 * immediately (the approved=false query also prunes it on its next fetch).
 */

type PendingRecap = {
  kind: "legacy" | "custom";
  id: string;
  uuid: string;
  name: string;
  /** YYYY-MM-DD or ISO; "" when neither event date nor createdAt exist. */
  date: string;
  /** "Venue · City, ST" — best-effort, "—" when unknown. */
  where: string;
  /** "Event Activation" / template name / null. */
  typeLabel: string | null;
  /** Sort key — event date (ms), falling back to createdAt, then 0. */
  sortMs: number;
};

const fmtDate = (raw: string | null | undefined): string => {
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

const toMs = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

const joinWhere = (venue: string | null, city: string | null, st: string | null): string => {
  const place = [city, st].filter(Boolean).join(", ");
  const parts = [venue, place].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
};

/* ─────────────────── row ─────────────────── */

const ApprovalRow: React.FC<{
  row: PendingRecap;
  onApproved: (key: string) => void;
}> = ({ row, onApproved }) => {
  const reviewTo =
    row.kind === "custom"
      ? `/recap/view-custom/${row.uuid}`
      : `/recap/view/${row.uuid}`;

  // Both hooks are created unconditionally (rules of hooks); we fire the one
  // matching this row's kind. Approval is tenant-scoped server-side (#708)
  // and cross-tenant ids read as "not found" (#247), so this is safe.
  const [commitLegacy, legacyInFlight] =
    useMutation<ApproveRecapMutationType>(ApproveRecapMutation);
  const [commitCustom, customInFlight] =
    useMutation<ApproveCustomRecapMutationType>(ApproveCustomRecapMutation);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = legacyInFlight || customInFlight;

  const approve = useCallback(() => {
    setError(null);
    const key = `${row.kind}:${row.id}`;
    const fail = (msg?: string | null) =>
      setError(msg ?? "Couldn't sign off this recap. Please try again.");
    if (row.kind === "custom") {
      commitCustom({
        variables: { input: { id: row.id, approved: true } },
        onCompleted: (res) =>
          res.approveCustomRecap?.success
            ? onApproved(key)
            : fail(res.approveCustomRecap?.message),
        onError: () => fail(),
      });
    } else {
      commitLegacy({
        variables: { input: { id: row.id, approved: true } },
        onCompleted: (res) =>
          res.approveRecap?.success
            ? onApproved(key)
            : fail(res.approveRecap?.message),
        onError: () => fail(),
      });
    }
  }, [row.kind, row.id, commitCustom, commitLegacy, onApproved]);

  return (
    <li
      className="spark-card p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: "var(--spark-card-bg, rgba(255,255,255,0.02))",
        borderRadius: 14,
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{row.name}</span>
          <span className="chip chip-orange">AWAITING SIGN-OFF</span>
          {row.typeLabel && (
            <span
              className="mono text-[10px] px-2 py-0.5 rounded-full"
              style={{
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.6)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {row.typeLabel.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
          {row.where}
          <span style={{ opacity: 0.5 }}> · </span>
          {fmtDate(row.date)}
        </p>
        {error && (
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "var(--spark-danger, #ff7a7a)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={reviewTo}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--spark-text)",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
          title="Open this recap to review the details"
        >
          Review →
        </Link>

        {confirming ? (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={inFlight}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                border: "none",
                boxShadow: "0 0 14px rgba(197,245,70,0.25)",
                opacity: inFlight ? 0.6 : 1,
                cursor: inFlight ? "default" : "pointer",
              }}
              title="Confirm — this signs off the recap and emails the requestor + RMM"
            >
              {inFlight ? "Signing off…" : "Confirm sign-off"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={inFlight}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.14)",
                cursor: inFlight ? "default" : "pointer",
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-lime)",
              border: "1px solid var(--spark-lime)",
              cursor: "pointer",
            }}
            title="Sign off on this recap"
          >
            Approve ✓
          </button>
        )}
      </div>
    </li>
  );
};

/* ─────────────────── inner ─────────────────── */

const ClientApprovalsInner: React.FC = () => {
  const { tenantId } = useAuthStore();

  // Rows the client just signed off — hidden immediately for snappy feedback.
  // The approved=false queries also prune them on their next network refresh
  // (store-and-network), so this is belt-and-suspenders, not the only path.
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const handleApproved = useCallback((key: string) => {
    setApprovedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Pending legacy recaps — tenant-scoped (event__tenant_id) + approved=false.
  // store-and-network so a recap that just got approved elsewhere drops off
  // the list on the next paint without a manual reload.
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    {
      first: 200,
      filters: tenantId ? { tenantId, approved: false } : null,
    },
    { fetchPolicy: "store-and-network" },
  );

  // Pending custom-template recaps (Borjomi, Girl Beer, …). Same tenant
  // scope + approved=false. Tenants typically use legacy XOR custom; a
  // tenant on both just sees both lists merged below.
  const customData = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    {
      first: 200,
      filters: tenantId ? { tenantId, approved: false } : null,
    },
    { fetchPolicy: "store-and-network" },
  );

  const rows: PendingRecap[] = useMemo(() => {
    const legacy: PendingRecap[] =
      data?.recaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const venue =
            n.event?.retailer?.name ??
            n.event?.request?.retailer?.name ??
            null;
          const city =
            n.event?.location?.name ??
            n.event?.retailer?.location?.name ??
            n.location?.name ??
            null;
          const st =
            n.event?.state?.code ??
            n.event?.retailer?.location?.state?.code ??
            n.state?.code ??
            null;
          const date = n.event?.date ?? n.createdAt ?? "";
          return {
            kind: "legacy" as const,
            id: String(n.id),
            uuid: String(n.uuid),
            name: n.name ?? n.event?.name ?? "Untitled recap",
            date,
            where: joinWhere(venue, city, st),
            typeLabel: n.event?.request?.requestType?.name ?? null,
            sortMs: toMs(n.event?.date) || toMs(n.createdAt),
          };
        }) ?? [];

    const custom: PendingRecap[] =
      customData?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const date = n.event?.date ?? n.createdAt ?? "";
          return {
            kind: "custom" as const,
            id: String(n.id),
            uuid: String(n.uuid),
            name:
              n.name ??
              n.event?.name ??
              n.customRecapTemplate?.name ??
              "Custom recap",
            date,
            where: joinWhere(n.retailer?.name ?? null, n.location?.name ?? null, null),
            typeLabel: n.customRecapTemplate?.name ?? null,
            sortMs: toMs(n.event?.date) || toMs(n.createdAt),
          };
        }) ?? [];

    return [...legacy, ...custom].sort((a, b) => b.sortMs - a.sortMs);
  }, [data, customData]);

  const visibleRows = useMemo(
    () => rows.filter((r) => !approvedKeys.has(`${r.kind}:${r.id}`)),
    [rows, approvedKeys],
  );

  if (visibleRows.length === 0) {
    return (
      <div
        className="spark-card p-10 text-center"
        style={{ borderRadius: 16 }}
      >
        <p className="display text-2xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          You&rsquo;re all caught up.
        </p>
        <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Nothing awaiting your approval.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {visibleRows.map((r) => (
        <ApprovalRow
          key={`${r.kind}:${r.id}`}
          row={r}
          onApproved={handleApproved}
        />
      ))}
    </ul>
  );
};

/* ─────────────────── page ─────────────────── */

/**
 * Layout-less body. Mirrors the AccountMapBody / ApprovalsBody pattern
 * so this view can be embedded elsewhere (e.g. a dashboard tab) without
 * nesting `<Layout>` twice. The default export wraps it in `<Layout>`
 * for the standalone `/my-approvals` route.
 */
export const ClientApprovalsBody: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header — brand-voice, not SEO keyword stuffing. */}
      <div>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          YOUR APPROVALS
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Recaps to review.
        </h1>
        <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
          Recaps from your events that are waiting on your sign-off. Open one
          to review the details and approve it.
        </p>
      </div>

      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading your approvals…
          </div>
        }
      >
        <ClientApprovalsInner />
      </Suspense>
    </div>
  );
};

export default function SparkClientApprovals() {
  return (
    <Layout>
      <ClientApprovalsBody />
    </Layout>
  );
}
