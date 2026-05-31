import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { QRCodeCanvas } from "qrcode.react";
import Layout from "@/layout/Layout";
import { ReceiptsQuery } from "@/api/queries/ReceiptsQuery";
import type { ReceiptsQuery as ReceiptsQueryType } from "@api/queries/__generated__/ReceiptsQuery.graphql";
import { ReceiptCampaignsQuery } from "@/api/queries/ReceiptCampaignsQuery";
import type {
  ReceiptCampaignsQuery as ReceiptCampaignsQueryType,
  ReceiptCampaignsQuery$data,
} from "@api/queries/__generated__/ReceiptCampaignsQuery.graphql";
import { ReviewReceiptMutation } from "@/api/mutations/ReviewReceiptMutation";
import type { ReviewReceiptMutation as ReviewReceiptMutationType } from "@api/mutations/__generated__/ReviewReceiptMutation.graphql";
import { MarkReceiptPaidMutation } from "@/api/mutations/MarkReceiptPaidMutation";
import type { MarkReceiptPaidMutation as MarkReceiptPaidMutationType } from "@api/mutations/__generated__/MarkReceiptPaidMutation.graphql";
import { CreateReceiptCampaignMutation } from "@/api/mutations/CreateReceiptCampaignMutation";
import type { CreateReceiptCampaignMutation as CreateReceiptCampaignMutationType } from "@api/mutations/__generated__/CreateReceiptCampaignMutation.graphql";
import { UpdateReceiptCampaignMutation } from "@/api/mutations/UpdateReceiptCampaignMutation";
import type { UpdateReceiptCampaignMutation as UpdateReceiptCampaignMutationType } from "@api/mutations/__generated__/UpdateReceiptCampaignMutation.graphql";
import { DeleteReceiptCampaignMutation } from "@/api/mutations/DeleteReceiptCampaignMutation";
import type { DeleteReceiptCampaignMutation as DeleteReceiptCampaignMutationType } from "@api/mutations/__generated__/DeleteReceiptCampaignMutation.graphql";
import { RunReceiptOcrMutation } from "@/api/mutations/RunReceiptOcrMutation";
import type { RunReceiptOcrMutation as RunReceiptOcrMutationType } from "@api/mutations/__generated__/RunReceiptOcrMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Consumer rebate campaigns (GoToAisle / Vizer style).
 *
 * Replaces the old per-event receipt-upload flow with always-on per-client
 * campaigns. A brand runs a campaign; consumers upload a purchase receipt
 * via the public no-login page (/c/<slug>) along with their Venmo handle;
 * an admin validates it, then pays a fixed reward via Venmo and marks it
 * paid. Spark itself never moves money — the pay button opens Venmo, then
 * the admin confirms with "Mark paid".
 *
 * The dashboard lists campaigns (share link + reward + active toggle +
 * counts) and, when one is selected, its submissions queue with tabs:
 * Pending / Awaiting payout / Paid / Rejected.
 *
 * Visual style mirrors SparkRecapsList (spark-card / chip / mono tokens) —
 * dark theme, lime accent.
 */

// Server caps the receipts list; we pull one bounded page per campaign and
// filter by tab. Receipt volume per campaign is bounded, so a single page
// keeps the queue simple without a "load more".
const FETCH_ALL = 1000;

// Public share link for a campaign — the no-login upload page route.
const campaignShareUrl = (slug: string): string =>
  `${window.location.origin}/c/${slug}`;

type Campaign = ReceiptCampaignsQuery$data["receiptCampaigns"][number];

// Queue tabs map to the receipts query filters {status, paid}.
type TabKey = "pending" | "awaiting" | "paid" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "awaiting", label: "Awaiting payout" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

// Translate a tab into the server filter shape. "Awaiting payout" is
// validated + unpaid; "Paid" is paid=true regardless of status.
const tabFilters = (
  tab: TabKey,
): { status: string | null; paid: boolean | null } => {
  switch (tab) {
    case "pending":
      return { status: "pending", paid: null };
    case "awaiting":
      return { status: "validated", paid: false };
    case "paid":
      return { status: null, paid: true };
    case "rejected":
      return { status: "rejected", paid: null };
  }
};

type Receipt = {
  id: string;
  uuid: string;
  status: string;
  submittedAt: string | null;
  consumerName: string | null;
  consumerEmail: string | null;
  consumerPhone: string | null;
  storeName: string | null;
  purchaseDate: string | null;
  amount: string | null;
  product: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  publicUrl: string | null;
  reviewedByName: string | null;
  payoutHandle: string | null;
  rewardAmount: string | null;
  paidAt: string | null;
  payoutLink: string | null;
  isFlagged: boolean;
  flagReason: string | null;
  ocrStore: string | null;
  ocrAmount: string | null;
  ocrDate: string | null;
  ocrText: string | null;
  ocrRanAt: string | null;
};

// Local overrides applied after a review / payout / OCR run so the row
// updates in place without a refetch.
type ReceiptOverride = {
  status?: string;
  reviewNote?: string | null;
  paidAt?: string | null;
  payoutLink?: string | null;
  rewardAmount?: string | null;
  ocrStore?: string | null;
  ocrAmount?: string | null;
  ocrDate?: string | null;
  ocrText?: string | null;
  ocrRanAt?: string | null;
};

const formatDateTime = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const formatDate = (raw: string | null | undefined): string => {
  if (!raw) return "";
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

// rewardAmount arrives as a numeric string like "5.00"; render "$5.00".
const formatMoney = (raw: string | null | undefined): string => {
  if (raw == null) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("$")) return trimmed;
  const n = Number(trimmed);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : trimmed;
};

// Map a status string to a chip tone + label.
const statusChip = (status: string): { cls: string; label: string } => {
  switch (status) {
    case "validated":
      return { cls: "chip chip-lime", label: "VALIDATED" };
    case "rejected":
      return { cls: "chip chip-orange", label: "REJECTED" };
    case "pending":
      return { cls: "chip chip-gold", label: "PENDING" };
    default:
      return { cls: "chip chip-gold", label: status.toUpperCase() };
  }
};

const inputStyle: React.CSSProperties = {
  padding: "0.75rem 0.95rem",
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
  outline: "none",
};

const limeButton: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "#0a0d09",
  boxShadow: "0 0 16px rgba(197,245,70,0.3)",
};

const ghostButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

// Subtle-red, used for the destructive Delete action so it reads as
// dangerous without shouting.
const dangerButton: React.CSSProperties = {
  background: "rgba(239,90,42,0.12)",
  color: "var(--spark-orange)",
  border: "1px solid rgba(239,90,42,0.5)",
};

// Parse a money-ish string ("12.50", "$12.50") to a finite number, else null.
const parseMoney = (raw: string | null | undefined): number | null => {
  if (raw == null) return null;
  const n = Number(String(raw).trim().replace(/^\$/, ""));
  return Number.isFinite(n) ? n : null;
};

// ─── Copyable share link ───────────────────────────────────────────────
const ShareLink: React.FC<{ slug: string }> = ({ slug }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const url = campaignShareUrl(slug);
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert(
        "Couldn't reach the clipboard — copy the link manually.",
        "warning",
      );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onClick={(e) => {
          e.stopPropagation();
          (e.currentTarget as HTMLInputElement).select();
        }}
        className="rounded-xl text-xs flex-1 mono"
        style={{ ...inputStyle, minWidth: 200, padding: "0.5rem 0.7rem" }}
      />
      <button
        type="button"
        onClick={copy}
        className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
        style={{
          background: copied ? "rgba(95,184,239,0.18)" : "transparent",
          color: copied ? "var(--spark-sky)" : "var(--spark-text)",
          border: `1px solid ${
            copied ? "rgba(95,184,239,0.5)" : "var(--spark-border)"
          }`,
        }}
      >
        {copied ? "✓ Copied" : "📋 Copy"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
        style={ghostButton}
      >
        ↗ Open
      </a>
    </div>
  );
};

// ─── Rendered QR + PNG download ────────────────────────────────────────
// Renders the public campaign URL as a scannable QR on a white rounded
// background and exports the underlying <canvas> to a downloadable PNG.
const QrPanel: React.FC<{ slug: string }> = ({ slug }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const url = campaignShareUrl(slug);
  const wrapRef = useRef<HTMLDivElement>(null);

  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
    // QRCodeCanvas renders a single <canvas>; grab it from the wrapper so
    // we don't need to juggle a forwarded ref through the typed component.
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) {
      showAlert("QR isn't ready yet — try again in a moment.", "warning");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slug}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      showAlert("Couldn't export the QR image.", "error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        ref={wrapRef}
        className="rounded-xl shrink-0 grid place-items-center"
        style={{ background: "#ffffff", padding: 8 }}
      >
        <QRCodeCanvas
          value={url}
          size={104}
          bgColor="#ffffff"
          fgColor="#0a0d09"
          level="M"
          marginSize={1}
        />
      </div>
      <div className="min-w-0">
        <p
          className="mono text-[10px] uppercase"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}
        >
          Scan to open the public page
        </p>
        <button
          type="button"
          onClick={download}
          className="mt-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={ghostButton}
        >
          ⬇ Download QR
        </button>
      </div>
    </div>
  );
};

// ─── Confirm dialog ────────────────────────────────────────────────────
// A small modal that requires an explicit confirm before a destructive
// action runs. Tone "danger" gives the confirm button the subtle-red look.
const ConfirmDialog: React.FC<{
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, body, confirmLabel, busy, tone = "default", onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    onClick={onCancel}
  >
    <div
      className="spark-card w-full max-w-sm"
      style={{ background: "var(--spark-surface, #0f1310)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6">
        <h2 className="display text-lg font-bold">{title}</h2>
        <div
          className="text-sm mt-2"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          {body}
        </div>
      </div>
      <div
        className="px-6 py-4 flex justify-end gap-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={ghostButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={tone === "danger" ? dangerButton : limeButton}
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Count tile ────────────────────────────────────────────────────────
const CountTile: React.FC<{
  label: string;
  value: number;
  tone?: string;
}> = ({ label, value, tone }) => (
  <div
    className="rounded-xl px-3 py-2 text-center"
    style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--spark-border)",
    }}
  >
    <p
      className="display text-xl font-bold"
      style={{ color: tone ?? "var(--spark-text)", lineHeight: 1.1 }}
    >
      {value}
    </p>
    <p className="label-mini mt-0.5">{label}</p>
  </div>
);

// ─── Budget cap progress ───────────────────────────────────────────────
// Shown only when a campaign has a budgetCap (budgetRemaining is non-null).
// Renders paid-of-cap progress, the committed-but-unpaid amount, and a
// "Budget reached" note when nothing is left.
const BudgetBar: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const cap = parseMoney(campaign.budgetCap);
  const paid = parseMoney(campaign.totalPaid) ?? 0;
  const committed = parseMoney(campaign.totalCommitted) ?? 0;
  const remaining = parseMoney(campaign.budgetRemaining);
  const reached = remaining != null && remaining <= 0;
  const pct =
    cap && cap > 0 ? Math.min(100, Math.max(0, (paid / cap) * 100)) : 0;

  return (
    <div
      className="mt-4 pt-4"
      style={{ borderTop: "1px solid var(--spark-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="label-mini">BUDGET</p>
        <p
          className="mono text-[11px]"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          Paid {formatMoney(campaign.totalPaid)} of {formatMoney(campaign.budgetCap)}
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: reached ? "var(--spark-orange)" : "var(--spark-lime)",
            transition: "width 240ms ease",
          }}
        />
      </div>
      {committed > 0 && (
        <p
          className="mono text-[10px] mt-1.5"
          style={{ letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}
        >
          {formatMoney(campaign.totalCommitted)} awaiting payout
        </p>
      )}
      {reached && (
        <p
          className="mono text-[10px] mt-1.5"
          style={{ letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
        >
          Budget reached
        </p>
      )}
    </div>
  );
};

// ─── Campaign card ─────────────────────────────────────────────────────
const CampaignCard: React.FC<{
  campaign: Campaign;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: (next: boolean) => void;
  onDelete: () => void;
  toggling: boolean;
  deleting: boolean;
}> = ({
  campaign,
  selected,
  onSelect,
  onEdit,
  onToggleActive,
  onDelete,
  toggling,
  deleting,
}) => {
  const hasBudget = campaign.budgetRemaining != null;
  return (
    <div
      onClick={onSelect}
      className="spark-card hov p-5 cursor-pointer"
      style={
        selected
          ? { borderColor: "var(--spark-lime)", boxShadow: "0 0 0 1px var(--spark-lime)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-base truncate" title={campaign.name}>
            {campaign.name}
          </p>
          <p
            className="mono text-[10px] uppercase mt-1"
            style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
          >
            {formatMoney(campaign.rewardAmount)} reward
            {campaign.product ? ` · ${campaign.product}` : ""}
          </p>
        </div>
        <span
          className={
            campaign.isActive ? "chip chip-lime shrink-0" : "chip chip-gold shrink-0"
          }
        >
          ● {campaign.isActive ? "ACTIVE" : "PAUSED"}
        </span>
      </div>

      {campaign.headline && (
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          {campaign.headline}
        </p>
      )}

      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
        <QrPanel slug={campaign.slug} />
      </div>

      <div className="mt-4">
        <ShareLink slug={campaign.slug} />
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        <CountTile label="Total" value={campaign.receiptsCount} />
        <CountTile label="Pending" value={campaign.pendingCount} tone="#ffc960" />
        <CountTile
          label="Validated"
          value={campaign.validatedCount}
          tone="var(--spark-lime)"
        />
        <CountTile
          label="Paid"
          value={campaign.paidCount}
          tone="var(--spark-sky)"
        />
      </div>

      {hasBudget && <BudgetBar campaign={campaign} />}

      <div
        className="flex items-center justify-between gap-3 mt-4 pt-4"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive(!campaign.isActive);
          }}
          disabled={toggling}
          className="mono text-[11px] disabled:opacity-40"
          style={{
            letterSpacing: "0.12em",
            color: campaign.isActive ? "var(--spark-orange)" : "var(--spark-lime)",
          }}
        >
          {toggling
            ? "…"
            : campaign.isActive
              ? "⏸ PAUSE CAMPAIGN"
              : "▶ ACTIVATE"}
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="mono text-[11px]"
            style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}
          >
            ✎ EDIT
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="mono text-[11px] disabled:opacity-40"
            style={{ letterSpacing: "0.12em", color: "var(--spark-orange)" }}
          >
            {deleting ? "…" : "🗑 DELETE"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Campaign create / edit modal ──────────────────────────────────────
const CampaignFormModal: React.FC<{
  tenantId: string | null;
  existing: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ tenantId, existing, onClose, onSaved }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [name, setName] = useState(existing?.name ?? "");
  const [reward, setReward] = useState(
    existing ? stripMoney(existing.rewardAmount) : "",
  );
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [product, setProduct] = useState(existing?.product ?? "");
  const [payoutNote, setPayoutNote] = useState(existing?.payoutNote ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [budgetCap, setBudgetCap] = useState(
    existing ? stripMoney(existing.budgetCap) : "",
  );

  const [createCommit, creating] = useMutation<CreateReceiptCampaignMutationType>(
    CreateReceiptCampaignMutation,
  );
  const [updateCommit, updating] = useMutation<UpdateReceiptCampaignMutationType>(
    UpdateReceiptCampaignMutation,
  );
  const inFlight = creating || updating;

  const save = () => {
    if (inFlight) return;
    if (!name.trim()) {
      showAlert("Give the campaign a name.", "warning");
      return;
    }
    // Reward is sent as a Float (dollars). Leave undefined if blank so the
    // server keeps its default / existing value.
    const rewardNum = reward.trim() === "" ? undefined : Number(reward.trim());
    if (rewardNum !== undefined && !Number.isFinite(rewardNum)) {
      showAlert("Reward amount must be a number (e.g. 5 or 5.00).", "warning");
      return;
    }
    // Budget cap is an optional Float (dollars). Blank clears it (null);
    // a non-numeric value is rejected.
    const budgetTrimmed = budgetCap.trim();
    const budgetNum = budgetTrimmed === "" ? undefined : Number(budgetTrimmed);
    if (budgetNum !== undefined && !Number.isFinite(budgetNum)) {
      showAlert("Budget cap must be a number (e.g. 500 or 500.00).", "warning");
      return;
    }

    if (existing) {
      updateCommit({
        variables: {
          input: {
            id: existing.id,
            name: name.trim(),
            rewardAmount: rewardNum ?? null,
            headline: headline.trim() || null,
            description: description.trim() || null,
            product: product.trim() || null,
            payoutNote: payoutNote.trim() || null,
            slug: slug.trim() || null,
            isActive,
            budgetCap: budgetNum ?? null,
          },
        },
        onCompleted: (res) => {
          const payload = res.updateReceiptCampaign;
          if (payload?.success) {
            showAlert(payload.message || "Campaign updated.", "success");
            onSaved();
            onClose();
          } else {
            showAlert(payload?.message ?? "Couldn't update the campaign.", "error");
          }
        },
        onError: (err) => showAlert(`Update failed: ${err.message}`, "error"),
      });
    } else {
      createCommit({
        variables: {
          input: {
            tenantId,
            name: name.trim(),
            rewardAmount: rewardNum ?? null,
            headline: headline.trim() || null,
            description: description.trim() || null,
            product: product.trim() || null,
            payoutNote: payoutNote.trim() || null,
            slug: slug.trim() || null,
            isActive,
            budgetCap: budgetNum ?? null,
          },
        },
        onCompleted: (res) => {
          const payload = res.createReceiptCampaign;
          if (payload?.success) {
            showAlert(payload.message || "Campaign created.", "success");
            onSaved();
            onClose();
          } else {
            showAlert(payload?.message ?? "Couldn't create the campaign.", "error");
          }
        },
        onError: (err) => showAlert(`Create failed: ${err.message}`, "error"),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="spark-card w-full max-w-xl my-8"
        style={{ background: "var(--spark-surface, #0f1310)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <h2 className="display text-xl font-bold">
            {existing ? "Edit campaign" : "New campaign"}
          </h2>
          <button
            onClick={onClose}
            className="mono text-[11px]"
            style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="p-6 space-y-4">
          <Field label="Campaign name *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liquid Death $5 Back"
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Reward amount ($)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="5.00"
                className="w-full rounded-xl text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Product">
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="What must they buy?"
                className="w-full rounded-xl text-sm"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Budget cap ($, optional)">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value)}
              placeholder="Total to spend on this campaign — leave blank for no cap."
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Headline">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Shown big on the public page (e.g. Get $5 back)"
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short blurb shown under the headline."
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Payout note">
            <input
              type="text"
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              placeholder="Internal note attached to Venmo payouts (optional)."
              className="w-full rounded-xl text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Custom slug">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Leave blank to auto-generate from the name."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl text-sm mono"
              style={inputStyle}
            />
            {slug.trim() && (
              <p
                className="mono text-[10px] mt-1"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {campaignShareUrl(slug.trim())}
              </p>
            )}
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-lime-400"
            />
            <span className="text-sm" style={{ color: "var(--spark-text)" }}>
              Active — accept submissions on the public page
            </span>
          </label>
        </div>

        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={ghostButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={inFlight}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={limeButton}
          >
            {inFlight
              ? "Saving…"
              : existing
                ? "Save changes"
                : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Tiny inline spinner used inside buttons while a mutation is in flight.
const Spinner: React.FC = () => (
  <span
    aria-hidden
    className="inline-block rounded-full align-[-1px] animate-spin"
    style={{
      width: 10,
      height: 10,
      border: "2px solid currentColor",
      borderTopColor: "transparent",
    }}
  />
);

// Build the muted "OCR: Store X · $Y · date" comparison line, or null if
// nothing has been read off the image yet.
const ocrSummary = (receipt: Receipt): string | null => {
  const parts = [
    receipt.ocrStore,
    receipt.ocrAmount ? formatMoney(receipt.ocrAmount) : null,
    receipt.ocrDate,
  ].filter((p): p is string => Boolean(p && String(p).trim()));
  if (parts.length === 0) return null;
  return `OCR: ${parts.join(" · ")}`;
};

// ─── Receipt card (within a campaign queue) ────────────────────────────
const ReceiptCard: React.FC<{
  receipt: Receipt;
  onReview: (status: "validated" | "rejected", note: string) => void;
  onMarkPaid: () => void;
  onOcr: () => void;
  busy: boolean;
  ocrBusy: boolean;
}> = ({ receipt, onReview, onMarkPaid, onOcr, busy, ocrBusy }) => {
  const chip = statusChip(receipt.status);
  const [note, setNote] = useState(receipt.reviewNote ?? "");
  const isPaid = Boolean(receipt.paidAt);
  const isPending = receipt.status === "pending";
  const awaitingPayout = receipt.status === "validated" && !isPaid;
  const reward = formatMoney(receipt.rewardAmount);
  const handle = receipt.payoutHandle?.trim().replace(/^@+/, "") ?? "";
  const ocrLine = ocrSummary(receipt);
  const ocrRan = Boolean(receipt.ocrRanAt) || ocrLine != null;

  return (
    <div className="spark-card overflow-hidden">
      <div className="grid sm:grid-cols-[160px_1fr] gap-0">
        {/* Photo */}
        <div
          className="relative grid place-items-center"
          style={{
            minHeight: 160,
            background:
              "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.08), transparent 70%)",
            borderRight: "1px solid var(--spark-border)",
          }}
        >
          {receipt.publicUrl ? (
            <a
              href={receipt.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0"
              title="Open full image"
            >
              <img
                src={receipt.publicUrl}
                alt="Receipt"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <span className="text-4xl" aria-hidden>
              🧾
            </span>
          )}
          <span
            className="absolute top-2 left-2 mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.7)",
              background: "rgba(0,0,0,0.45)",
              padding: "2px 6px",
              borderRadius: 999,
            }}
          >
            RC-{receipt.uuid.slice(-4).toUpperCase()}
          </span>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">
                {receipt.consumerName || "Anonymous"}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "rgba(255,255,255,0.5)" }}
                title={receipt.consumerEmail || receipt.consumerPhone || undefined}
              >
                {receipt.consumerEmail || receipt.consumerPhone || "—"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={chip.cls}>● {chip.label}</span>
              {receipt.isFlagged && (
                <span
                  className="mono inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                  style={{
                    letterSpacing: "0.06em",
                    background: "rgba(255,201,96,0.12)",
                    border: "1px solid rgba(255,201,96,0.5)",
                    color: "#ffc960",
                  }}
                  title={receipt.flagReason || "Possible duplicate submission"}
                >
                  ⚠ Possible duplicate
                </span>
              )}
            </div>
          </div>

          {receipt.isFlagged && receipt.flagReason && (
            <p
              className="text-[11px] mt-1.5"
              style={{ color: "#ffc960" }}
            >
              {receipt.flagReason}
            </p>
          )}

          <div
            className="mono text-[10px] uppercase mt-2"
            style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}
          >
            {receipt.storeName || "Unknown store"}
            {receipt.purchaseDate ? ` · ${formatDate(receipt.purchaseDate)}` : ""}
            {receipt.amount ? ` · ${receipt.amount}` : ""}
            {receipt.product ? ` · ${receipt.product}` : ""}
          </div>

          {/* OCR comparison + admin trigger */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ocrLine && (
              <span
                className="mono text-[10px]"
                style={{ letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)" }}
                title={receipt.ocrText || undefined}
              >
                {ocrLine}
              </span>
            )}
            <button
              type="button"
              onClick={onOcr}
              disabled={ocrBusy}
              className="mono inline-flex items-center gap-1.5 text-[10px] disabled:opacity-50"
              style={{
                letterSpacing: "0.1em",
                color: "var(--spark-sky)",
              }}
              title="Read the receipt image with OCR and fill the OCR fields"
            >
              {ocrBusy ? (
                <>
                  <Spinner /> READING…
                </>
              ) : (
                <>🔍 {ocrRan ? "RE-RUN OCR" : "AUTO-READ (OCR)"}</>
              )}
            </button>
          </div>

          {/* Venmo handle */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="mono inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]"
              style={{
                letterSpacing: "0.04em",
                background: "rgba(95,184,239,0.10)",
                border: "1px solid rgba(95,184,239,0.30)",
                color: "var(--spark-sky)",
              }}
              title="Consumer's Venmo handle"
            >
              Venmo @{handle || "—"}
            </span>
            {reward && (
              <span
                className="mono text-[11px]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Reward {reward}
              </span>
            )}
          </div>

          {receipt.submittedAt && (
            <p
              className="mono mt-2"
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Submitted {formatDateTime(receipt.submittedAt)}
            </p>
          )}

          {/* Actions */}
          {isPending && (
            <div className="mt-3 space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Optional note (e.g. wrong product, blurry photo)…"
                className="w-full rounded-xl text-xs"
                style={inputStyle}
              />
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onReview("rejected", note)}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{
                    background: "rgba(239,90,42,0.12)",
                    color: "var(--spark-orange)",
                    border: "1px solid rgba(239,90,42,0.5)",
                  }}
                >
                  {busy ? "…" : "✕ Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => onReview("validated", note)}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={limeButton}
                >
                  {busy ? "…" : "✓ Validate"}
                </button>
              </div>
            </div>
          )}

          {awaitingPayout && (
            <div className="mt-3 space-y-2">
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Spark doesn't move money. Open Venmo to pay{" "}
                {reward ? `${reward} ` : ""}to @{handle || "the consumer"}, then
                mark it paid.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                {receipt.payoutLink ? (
                  <a
                    href={receipt.payoutLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={limeButton}
                  >
                    Pay {reward || "$"} via Venmo ↗
                  </a>
                ) : (
                  <span
                    className="px-4 py-2 rounded-xl text-sm font-semibold opacity-40"
                    style={limeButton}
                    title="No payout link available"
                  >
                    Pay via Venmo
                  </span>
                )}
                <button
                  type="button"
                  onClick={onMarkPaid}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={ghostButton}
                >
                  {busy ? "…" : "✓ Mark paid"}
                </button>
              </div>
            </div>
          )}

          {isPaid && (
            <p
              className="mono text-[11px] mt-3"
              style={{ letterSpacing: "0.08em", color: "var(--spark-sky)" }}
            >
              ✓ Paid {reward ? `${reward} ` : ""}
              {receipt.paidAt ? `· ${formatDateTime(receipt.paidAt)}` : ""}
            </p>
          )}

          {receipt.status === "rejected" && receipt.reviewNote && (
            <p
              className="text-[11px] mt-3"
              style={{ color: "var(--spark-orange)" }}
            >
              Reason: {receipt.reviewNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Submissions queue (suspends on the receipts query) ────────────────
const SubmissionsQueue: React.FC<{
  campaignId: string;
  tab: TabKey;
  refreshKey: number;
}> = ({ campaignId, tab, refreshKey }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const { status, paid } = tabFilters(tab);

  const data = useLazyLoadQuery<ReceiptsQueryType>(
    ReceiptsQuery,
    {
      first: FETCH_ALL,
      filters: { campaignId, status, paid },
    },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const [reviewCommit, reviewing] = useMutation<ReviewReceiptMutationType>(
    ReviewReceiptMutation,
  );
  const [paidCommit, payingMut] = useMutation<MarkReceiptPaidMutationType>(
    MarkReceiptPaidMutation,
  );
  const [ocrCommit] = useMutation<RunReceiptOcrMutationType>(
    RunReceiptOcrMutation,
  );

  // Local overrides keyed by receipt id so a row reflects its new state
  // after a review / payout / OCR run without waiting on a refetch.
  const [overrides, setOverrides] = useState<Record<string, ReceiptOverride>>(
    {},
  );
  // Which row id is mid review/payout, so only that card shows a busy state.
  const [busyId, setBusyId] = useState<string | null>(null);
  // OCR runs independently of review/payout, so it has its own busy id.
  const [ocrBusyId, setOcrBusyId] = useState<string | null>(null);

  const receipts: Receipt[] = useMemo(() => {
    return (
      data?.receipts?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const ov = overrides[String(n.id)] ?? {};
          const reviewedByName =
            [n.reviewedBy?.firstName, n.reviewedBy?.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            n.reviewedBy?.email ||
            null;
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            status: ov.status ?? n.status,
            submittedAt: n.submittedAt ?? null,
            consumerName: n.consumerName ?? null,
            consumerEmail: n.consumerEmail ?? null,
            consumerPhone: n.consumerPhone ?? null,
            storeName: n.storeName ?? null,
            purchaseDate: n.purchaseDate ?? null,
            amount: n.amount ?? null,
            product: n.product ?? null,
            reviewNote: ov.reviewNote ?? n.reviewNote ?? null,
            reviewedAt: n.reviewedAt ?? null,
            publicUrl: n.publicUrl ?? null,
            reviewedByName,
            payoutHandle: n.payoutHandle ?? null,
            rewardAmount: ov.rewardAmount ?? n.rewardAmount ?? null,
            paidAt: ov.paidAt ?? n.paidAt ?? null,
            payoutLink: ov.payoutLink ?? n.payoutLink ?? null,
            isFlagged: n.isFlagged ?? false,
            flagReason: n.flagReason ?? null,
            ocrStore: ov.ocrStore ?? n.ocrStore ?? null,
            ocrAmount: ov.ocrAmount ?? n.ocrAmount ?? null,
            ocrDate: ov.ocrDate ?? n.ocrDate ?? null,
            ocrText: ov.ocrText ?? n.ocrText ?? null,
            ocrRanAt: ov.ocrRanAt ?? n.ocrRanAt ?? null,
          } satisfies Receipt;
        }) ?? []
    );
  }, [data, overrides]);

  // Hide rows whose local override moved them out of this tab (e.g. a
  // validated receipt should leave the Pending tab immediately).
  const visible = useMemo(
    () => receipts.filter((r) => matchesTab(r, tab)),
    [receipts, tab],
  );

  const review = (
    receipt: Receipt,
    status: "validated" | "rejected",
    note: string,
  ) => {
    if (busyId) return;
    setBusyId(receipt.id);
    reviewCommit({
      variables: {
        input: { id: receipt.id, status, note: note.trim() || null },
      },
      onCompleted: (res) => {
        setBusyId(null);
        const payload = res.reviewReceipt;
        if (payload?.success) {
          showAlert(
            payload.message ||
              `Receipt ${status === "validated" ? "validated" : "rejected"}.`,
            "success",
          );
          setOverrides((prev) => ({
            ...prev,
            [receipt.id]: {
              ...prev[receipt.id],
              status: payload.receipt?.status ?? status,
              reviewNote: payload.receipt?.reviewNote ?? (note.trim() || null),
            },
          }));
        } else {
          showAlert(payload?.message ?? "Receipt review failed.", "error");
        }
      },
      onError: (err) => {
        setBusyId(null);
        showAlert(`Receipt review failed: ${err.message}`, "error");
      },
    });
  };

  const markPaid = (receipt: Receipt) => {
    if (busyId) return;
    setBusyId(receipt.id);
    paidCommit({
      variables: {
        input: {
          id: receipt.id,
          payoutHandle: receipt.payoutHandle?.trim() || null,
        },
      },
      onCompleted: (res) => {
        setBusyId(null);
        const payload = res.markReceiptPaid;
        if (payload?.success) {
          showAlert(payload.message || "Marked paid.", "success");
          setOverrides((prev) => ({
            ...prev,
            [receipt.id]: {
              ...prev[receipt.id],
              status: payload.receipt?.status ?? receipt.status,
              paidAt:
                payload.receipt?.paidAt ?? new Date().toISOString(),
              payoutLink: payload.receipt?.payoutLink ?? receipt.payoutLink,
              rewardAmount:
                payload.receipt?.rewardAmount ?? receipt.rewardAmount,
            },
          }));
        } else {
          showAlert(payload?.message ?? "Couldn't mark it paid.", "error");
        }
      },
      onError: (err) => {
        setBusyId(null);
        showAlert(`Mark paid failed: ${err.message}`, "error");
      },
    });
  };

  // Admin-triggered OCR. Independent of review/payout so it doesn't block
  // them. OCR can be unavailable — surface the server message and never
  // throw.
  const runOcr = (receipt: Receipt) => {
    if (ocrBusyId) return;
    setOcrBusyId(receipt.id);
    ocrCommit({
      variables: { input: { id: receipt.id } },
      onCompleted: (res) => {
        setOcrBusyId(null);
        const payload = res.runReceiptOcr;
        if (payload?.success) {
          showAlert(payload.message || "Receipt read.", "success");
          setOverrides((prev) => ({
            ...prev,
            [receipt.id]: {
              ...prev[receipt.id],
              ocrStore: payload.receipt?.ocrStore ?? prev[receipt.id]?.ocrStore,
              ocrAmount:
                payload.receipt?.ocrAmount ?? prev[receipt.id]?.ocrAmount,
              ocrDate: payload.receipt?.ocrDate ?? prev[receipt.id]?.ocrDate,
              ocrText: payload.receipt?.ocrText ?? prev[receipt.id]?.ocrText,
              ocrRanAt:
                payload.receipt?.ocrRanAt ??
                prev[receipt.id]?.ocrRanAt ??
                new Date().toISOString(),
            },
          }));
        } else {
          showAlert(payload?.message ?? "OCR is unavailable right now.", "error");
        }
      },
      onError: (err) => {
        setOcrBusyId(null);
        showAlert(`OCR failed: ${err.message}`, "error");
      },
    });
  };

  if (visible.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Nothing in {TABS.find((t) => t.key === tab)?.label.toLowerCase()} right
        now.
      </div>
    );
  }

  const busy = reviewing || payingMut;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {visible.map((r) => (
        <ReceiptCard
          key={r.uuid}
          receipt={r}
          busy={busy && busyId === r.id}
          ocrBusy={ocrBusyId === r.id}
          onReview={(status, note) => review(r, status, note)}
          onMarkPaid={() => markPaid(r)}
          onOcr={() => runOcr(r)}
        />
      ))}
    </div>
  );
};

// Does a receipt belong in the given tab (after local overrides)?
const matchesTab = (r: Receipt, tab: TabKey): boolean => {
  const paid = Boolean(r.paidAt);
  switch (tab) {
    case "pending":
      return r.status === "pending" && !paid;
    case "awaiting":
      return r.status === "validated" && !paid;
    case "paid":
      return paid;
    case "rejected":
      return r.status === "rejected" && !paid;
  }
};

// ─── Campaign list (suspends on the campaigns query) ───────────────────
const CampaignList: React.FC<{
  tenantId: string | null;
  refreshKey: number;
  selectedId: string | null;
  onSelect: (c: Campaign) => void;
  onEdit: (c: Campaign) => void;
  onChanged: () => void;
  onMeta: (m: { total: number; selected: Campaign | null }) => void;
}> = ({ tenantId, refreshKey, selectedId, onSelect, onEdit, onChanged, onMeta }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<ReceiptCampaignsQueryType>(
    ReceiptCampaignsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const campaigns = useMemo(
    () => data?.receiptCampaigns ?? [],
    [data],
  );

  const [updateCommit] = useMutation<UpdateReceiptCampaignMutationType>(
    UpdateReceiptCampaignMutation,
  );
  const [deleteCommit] = useMutation<DeleteReceiptCampaignMutationType>(
    DeleteReceiptCampaignMutation,
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Campaign awaiting an explicit delete confirmation, and the id mid-delete.
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Publish total + the resolved selected campaign up to the header.
  useEffect(() => {
    const selected =
      campaigns.find((c) => c.id === selectedId) ?? null;
    onMeta({ total: campaigns.length, selected });
  }, [campaigns, selectedId, onMeta]);

  const toggleActive = (campaign: Campaign, next: boolean) => {
    if (togglingId) return;
    setTogglingId(campaign.id);
    updateCommit({
      variables: { input: { id: campaign.id, isActive: next } },
      onCompleted: (res) => {
        setTogglingId(null);
        const payload = res.updateReceiptCampaign;
        if (payload?.success) {
          showAlert(
            next ? "Campaign activated." : "Campaign paused.",
            "success",
          );
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't update the campaign.", "error");
        }
      },
      onError: (err) => {
        setTogglingId(null);
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  // Runs after the user confirms in the dialog. The backend decides whether
  // to hard-delete (empty) or soft-archive (has receipts); we just surface
  // its message and refetch.
  const confirmDelete = (campaign: Campaign) => {
    if (deletingId) return;
    setDeletingId(campaign.id);
    deleteCommit({
      variables: { input: { id: campaign.id } },
      onCompleted: (res) => {
        setDeletingId(null);
        const payload = res.deleteReceiptCampaign;
        if (payload?.success) {
          showAlert(payload.message || "Campaign deleted.", "success");
          setPendingDelete(null);
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't delete the campaign.", "error");
        }
      },
      onError: (err) => {
        setDeletingId(null);
        showAlert(`Delete failed: ${err.message}`, "error");
      },
    });
  };

  if (campaigns.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <p className="text-sm">No campaigns yet.</p>
        <p className="text-xs mt-1">
          Create one to start collecting consumer receipts and paying rewards.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            selected={c.id === selectedId}
            onSelect={() => onSelect(c)}
            onEdit={() => onEdit(c)}
            onToggleActive={(next) => toggleActive(c, next)}
            onDelete={() => setPendingDelete(c)}
            toggling={togglingId === c.id}
            deleting={deletingId === c.id}
          />
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete campaign?"
          tone="danger"
          confirmLabel="Delete campaign"
          busy={deletingId === pendingDelete.id}
          body={
            <>
              <span className="font-semibold" style={{ color: "var(--spark-text)" }}>
                {pendingDelete.name}
              </span>{" "}
              will be removed. Campaigns with existing receipts are archived
              instead of permanently deleted. This can't be undone.
            </>
          }
          onConfirm={() => confirmDelete(pendingDelete)}
          onCancel={() => {
            if (deletingId) return;
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="label-mini block mb-1.5">{label}</label>
    {children}
  </div>
);

// Strip a leading "$" for editing the numeric reward in the form.
function stripMoney(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().replace(/^\$/, "");
}

export default function SparkReceipts() {
  const { tenantId } = useAuthStore();
  // Bumped to refetch the campaigns list / queue after a mutation.
  const [campaignsKey, setCampaignsKey] = useState(0);
  const [queueKey, setQueueKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("pending");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const [meta, setMeta] = useState<{ total: number; selected: Campaign | null }>(
    { total: 0, selected: null },
  );

  const onMeta = useCallback(
    (m: { total: number; selected: Campaign | null }) => setMeta(m),
    [],
  );

  const refreshAll = useCallback(() => {
    setCampaignsKey((k) => k + 1);
    setQueueKey((k) => k + 1);
  }, []);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setModalOpen(true);
  };

  const selected = meta.selected;

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
            >
              REBATE PROGRAM · {meta.total} CAMPAIGN{meta.total === 1 ? "" : "S"}
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Receipt campaigns.
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Always-on rebates. Share a campaign link, consumers upload a
              receipt + their Venmo, you validate it and pay the reward.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={limeButton}
          >
            + New campaign
          </button>
        </div>

        {/* Campaign list */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading campaigns…
            </div>
          }
        >
          <CampaignList
            tenantId={tenantId}
            refreshKey={campaignsKey}
            selectedId={selectedId}
            onSelect={(c) =>
              setSelectedId((prev) => (prev === c.id ? null : c.id))
            }
            onEdit={openEdit}
            onChanged={refreshAll}
            onMeta={onMeta}
          />
        </Suspense>

        {/* Selected campaign's submissions queue */}
        {selected && (
          <div className="space-y-4">
            <div
              className="flex items-end justify-between flex-wrap gap-3 pt-2"
              style={{ borderTop: "1px solid var(--spark-border)" }}
            >
              <div>
                <p className="label-mini">SUBMISSIONS</p>
                <h2 className="display text-2xl font-bold mt-1">
                  {selected.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mono text-[11px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                ✕ CLOSE QUEUE
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{
                      background: on ? "var(--spark-lime)" : "transparent",
                      color: on ? "#0a0d09" : "var(--spark-text)",
                      border: `1px solid ${
                        on ? "var(--spark-lime)" : "var(--spark-border)"
                      }`,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <Suspense
              fallback={
                <div
                  className="spark-card p-8 text-center text-sm"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Loading submissions…
                </div>
              }
            >
              <SubmissionsQueue
                key={`${selected.id}:${tab}`}
                campaignId={selected.id}
                tab={tab}
                refreshKey={queueKey}
              />
            </Suspense>
          </div>
        )}
      </div>

      {modalOpen && (
        <CampaignFormModal
          tenantId={tenantId}
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={refreshAll}
        />
      )}
    </Layout>
  );
}
