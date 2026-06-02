import { Suspense, useMemo } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";

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
 * LIST-ONLY (no approve action). The recap-approval mutations
 * (`approveRecap` / `approveCustomRecap`) are gated only by
 * `StrictIsAuthenticated` on the backend and load the recap by raw PK
 * with NO tenant check (recaps/mutations.py RecapMutationService.
 * approve_recap / approve_custom_recap) — i.e. recap approval is NOT
 * tenant-scoped. Until that backend gap is closed we deliberately do
 * not surface an approve button here; the row's "Review" link points
 * at the recap detail (where the existing Approve action lives) so the
 * sign-off path is unchanged, just not duplicated on this list.
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

const ApprovalRow: React.FC<{ row: PendingRecap }> = ({ row }) => {
  const reviewTo =
    row.kind === "custom"
      ? `/recap/view-custom/${row.uuid}`
      : `/recap/view/${row.uuid}`;
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
      </div>
      <Link
        to={reviewTo}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0d09",
          textDecoration: "none",
          boxShadow: "0 0 14px rgba(197,245,70,0.25)",
        }}
        title="Open this recap to review and sign off"
      >
        Review →
      </Link>
    </li>
  );
};

/* ─────────────────── inner ─────────────────── */

const ClientApprovalsInner: React.FC = () => {
  const { tenantId } = useAuthStore();

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

  if (rows.length === 0) {
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
      {rows.map((r) => (
        <ApprovalRow key={`${r.kind}:${r.id}`} row={r} />
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
