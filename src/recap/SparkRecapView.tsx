import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@api/queries/__generated__/RecapQuery.graphql";
import { GenerateRecapPdfMutation } from "@/api/mutations/GenerateRecapPdfMutation";
import type { GenerateRecapPdfMutation as GenerateRecapPdfMutationType } from "@/api/mutations/__generated__/GenerateRecapPdfMutation.graphql";
import { AddRecapFileMutation } from "@/api/mutations/AddRecapFileMutation";
import type { AddRecapFileMutation as AddRecapFileMutationType } from "@/api/mutations/__generated__/AddRecapFileMutation.graphql";
import { UpdateRecapMutation } from "@/api/mutations/UpdateRecapMutation";
import type { UpdateRecapMutation as UpdateRecapMutationType } from "@/api/mutations/__generated__/UpdateRecapMutation.graphql";
import { ApproveRecapMutation } from "@/api/mutations/ApproveRecapMutation";
import type { ApproveRecapMutation as ApproveRecapMutationType } from "@/api/mutations/__generated__/ApproveRecapMutation.graphql";
import { RemoveRecapFileMutation } from "@/api/mutations/RemoveRecapFileMutation";
import type { RemoveRecapFileMutation as RemoveRecapFileMutationType } from "@/api/mutations/__generated__/RemoveRecapFileMutation.graphql";
import { AmbassadorSearchQuery } from "@/api/queries/AmbassadorSearchQuery";
import type { AmbassadorSearchQuery as AmbassadorSearchQueryType } from "@/api/queries/__generated__/AmbassadorSearchQuery.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import RateBaControl from "@/components/RateBaControl";
import { recapFileKind, recapFileUrl, recapFileUrlFresh } from "@/utils/recapFileUrl";
import { useAlertStore } from "@/store/alertStore";
import HeicImage from "./HeicImage";
import RecapUploader from "./RecapUploader";
import ReassignRecapModal from "./ReassignRecapModal";

/**
 * Spark v2 — Recap Detail.
 * Wireframe: spark-demo/index.html lines 1228-1311.
 */

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "";
  const [h, m] = raw.split(":");
  const hh = parseInt(h ?? "0", 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return m && m !== "00" ? `${h12}:${m} ${ampm}` : `${h12} ${ampm}`;
};

const initials = (full: string) =>
  full
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const KpiTile: React.FC<{
  icon: string;
  label: string;
  value: string;
  delta?: string;
  glow?: boolean;
}> = ({ icon, label, value, delta, glow }) => (
  <div className={`kpi kpi-hover ${glow ? "kpi-glow" : ""}`}>
    <div className="flex items-start justify-between">
      <span className="kpi-icon" aria-hidden>
        {icon}
      </span>
      {delta && <span className="kpi-delta">{delta}</span>}
    </div>
    <p className="kpi-value">{value}</p>
    <p className="kpi-label">{label}</p>
  </div>
);

/* ─────────────────── inner ─────────────────── */

/**
 * Type-ahead BA picker for the recap editor. Searches activeAmbassadors
 * (tenant-scoped) and calls onPick with the BA's Relay id (which
 * updateRecap's ambassador_id runs through resolve_id_to_int). Mirrors
 * the picker on the recap-create form. Suspends on the search query, so
 * the caller wraps it in <Suspense>.
 */
const BaSearch: React.FC<{
  onPick: (id: string, name: string) => void;
}> = ({ onPick }) => {
  const [q, setQ] = useState("");
  const data = useLazyLoadQuery<AmbassadorSearchQueryType>(
    AmbassadorSearchQuery,
    { q, first: 8 },
    { fetchPolicy: "store-or-network" },
  );
  const matches = (data?.activeAmbassadors?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a BA's name or email…"
        className="w-full rounded-lg px-3 py-2 text-[15px]"
        style={{
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
        }}
      />
      {q && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {matches.length === 0 ? (
            <p
              className="mono text-[10px] py-1"
              style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
            >
              NO MATCHES
            </p>
          ) : (
            matches.map((amb) => {
              const full = [amb.user?.firstName, amb.user?.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
              const display = full || amb.user?.email || "(unnamed BA)";
              return (
                <button
                  key={String(amb.id)}
                  type="button"
                  onClick={() => onPick(String(amb.id), display)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--spark-surface-2, rgba(255,255,255,0.04))",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  {display}
                  {full && amb.user?.email && (
                    <span
                      className="mono text-[10px] ml-2"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {amb.user.email}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const SparkRecapInner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitPdf, isPdfRunning] = useMutation<GenerateRecapPdfMutationType>(
    GenerateRecapPdfMutation,
  );
  const [commitAddFile] = useMutation<AddRecapFileMutationType>(
    AddRecapFileMutation,
  );
  const [commitUpdate, isUpdating] =
    useMutation<UpdateRecapMutationType>(UpdateRecapMutation);
  const [commitApprove, isApproving] =
    useMutation<ApproveRecapMutationType>(ApproveRecapMutation);
  const [commitRemoveFile] =
    useMutation<RemoveRecapFileMutationType>(RemoveRecapFileMutation);
  const { isAdmin } = useSparkRole();
  const [isZipping, setIsZipping] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  // Admin-only inline number editor. `editingNumbers` toggles the panel;
  // `draft` holds the in-progress string values keyed by field.
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  // BA the admin newly picked in the editor. Null = leave the recap's
  // current ambassador unchanged (updateRecap's ambassador_id is guarded
  // server-side, so a null is a no-op, not a clear).
  const [pickedBa, setPickedBa] = useState<{ id: string; name: string } | null>(
    null,
  );
  // Bumped after a file is attached so the query refetches and the new
  // photo/receipt shows up in the grid without a full page reload.
  const [refreshKey, setRefreshKey] = useState(0);
  // Per-BA optimistic rating average, keyed by ambassador global id, so
  // the Team card's "★ avg" updates the instant a rating is saved
  // (rateAmbassador returns the recomputed caller-visible average).
  const [ratingOverrides, setRatingOverrides] = useState<
    Record<string, number>
  >({});
  const data = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid },
    // store-and-network (not store-or-network) so bumping refreshKey
    // after a mutation that doesn't return every field (updateRecap
    // returns only id/name/eventId — not the numbers or ambassadors)
    // actually re-fetches from the network. With store-or-network the
    // bump served the stale store and edits/BA didn't show until a
    // manual reload — the same "silly workflow" Nevena hit on photos.
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  const recap = data?.recap;

  if (!recap) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Recap not found.
      </div>
    );
  }

  const event = recap.event;
  const engagement = (recap.consumerEngagements ?? [])[0];
  const consumerFeedback = (recap.consumerFeedback ?? [])[0];
  const accountFeedback = (recap.accountFeedback ?? [])[0];
  const totalConsumer = engagement?.totalConsumer ?? null;
  const firstTime = engagement?.firstTimeConsumers ?? null;
  const brandAware = engagement?.brandAwareConsumers ?? null;
  const willing = engagement?.willingToPurchaseConsumers ?? null;
  const productsSold = recap.productsSold ?? null;
  const ambassadors = (recap.ambassadors ?? []).filter(Boolean);
  // All non-empty files. We split into renderable images (img tag) vs
  // unrenderable (HEIC + PDF + video), shown as labeled tiles.
  const allFiles = (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  );
  const sales = (recap.salesPerformance ?? []).filter(Boolean);
  const notes = (recap.accountFeedback ?? [])[0]?.feedback ?? null;

  const fieldDate = event?.date ?? recap.createdAt;
  const fieldTime =
    event?.startTime && event?.endTime
      ? `${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`
      : "";

  // ── Admin-only number editing ──────────────────────────────────────
  // updateRecap reconciles the full file set AND overwrites scalar
  // fields unconditionally, so we MUST round-trip every existing file +
  // every current scalar value, applying only the user's edits on top.
  // Dropping any of them would delete photos or null out numbers.
  const startEditNumbers = () => {
    setDraft({
      productsSold: recap.productsSold?.toString() ?? "",
      totalCansSold: recap.totalCansSold?.toString() ?? "",
      totalPacksSold: recap.totalPacksSold?.toString() ?? "",
      accountSpendAmount: recap.accountSpendAmount?.toString() ?? "",
      totalConsumer: engagement?.totalConsumer?.toString() ?? "",
    });
    setPickedBa(null);
    setEditingNumbers(true);
  };

  const numOrNull = (s: string): number | null => {
    const t = (s ?? "").trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const saveNumbers = () => {
    if (isUpdating) return;
    // Faithfully reconstruct the full file list so the reconcile keeps
    // every attached photo/receipt. Skip files with no blob (defensive).
    const files = allFiles
      .map((f) => ({
        file: String(f?.file ?? ""),
        fileTypeId: f?.fileTypeId != null ? String(f.fileTypeId) : null,
        fileRecapCategoryId:
          f?.fileRecapCategoryId != null
            ? String(f.fileRecapCategoryId)
            : null,
      }))
      .filter((f) => f.file.length > 0);

    commitUpdate({
      variables: {
        input: {
          id: recap.id,
          name: recap.name ?? "Recap",
          eventId: event?.id ?? "",
          files,
          // BA assignment — only sent when the admin picked one. The
          // backend guards ambassador_id (only updates when present),
          // so a null here leaves the current BA untouched.
          ambassadorId: pickedBa?.id ?? null,
          // Edited numbers (null clears a value intentionally).
          productsSold: numOrNull(draft.productsSold),
          totalCansSold: numOrNull(draft.totalCansSold),
          totalPacksSold: numOrNull(draft.totalPacksSold),
          accountSpendAmount: numOrNull(draft.accountSpendAmount),
          // Preserve the rest of the recap's current scalars so the
          // unconditional overwrite on the backend doesn't blank them.
          totalEarnings: recap.totalEarnings ?? null,
          trafficDescription: recap.trafficDescription ?? null,
          competitivePresence: recap.competitivePresence ?? null,
          // Engagements: keep the existing breakdown, only update the
          // headline total_consumer the editor exposes.
          consumerEngagements: {
            totalConsumer: numOrNull(draft.totalConsumer),
            firstTimeConsumers: engagement?.firstTimeConsumers ?? null,
            brandAwareConsumers: engagement?.brandAwareConsumers ?? null,
            willingToPurchaseConsumers:
              engagement?.willingToPurchaseConsumers ?? null,
            notWillingConsumers: engagement?.notWillingConsumers ?? null,
          },
        },
      },
      onCompleted: (res) => {
        if (res.updateRecap?.success) {
          showAlert("Recap numbers updated.", "success");
          setEditingNumbers(false);
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(
            res.updateRecap?.message ?? "Couldn't save changes.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Save failed: ${err.message}`, "error"),
    });
  };

  // Approve / decline the recap itself (distinct from request approval).
  // Uses the existing approveRecap mutation; the response returns
  // `approved` so the status chip updates in-place.
  const setApproved = (approved: boolean) => {
    if (isApproving) return;
    commitApprove({
      variables: { input: { id: recap.id, approved } },
      onCompleted: (res) => {
        if (res.approveRecap?.success) {
          showAlert(
            approved ? "Recap approved." : "Recap marked not approved.",
            "success",
          );
        } else {
          showAlert(
            res.approveRecap?.message ?? "Couldn't update approval.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Approval failed: ${err.message}`, "error"),
    });
  };

  // Remove a photo/receipt from the recap. Destructive (deletes the
  // blob) so we gate behind a confirm. The mutation returns the
  // refreshed recapFiles so the grid updates from the Relay store.
  const removeFile = (fileId: string, label: string) => {
    if (
      !window.confirm(
        `Remove ${label || "this file"} from the recap? This deletes it permanently.`,
      )
    ) {
      return;
    }
    commitRemoveFile({
      variables: { input: { id: fileId } },
      onCompleted: (res) => {
        if (res.removeRecapFile?.success) {
          showAlert("File removed.", "success");
        } else {
          showAlert(
            res.removeRecapFile?.message ?? "Couldn't remove file.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Remove failed: ${err.message}`, "error"),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <button
        onClick={() => navigate("/recap/list")}
        className="mono text-[11px] transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        ← BACK TO RECAPS
      </button>

      {/* Title card */}
      <div className="spark-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  padding: "0.2rem 0.55rem",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                R-{uuid.slice(-4).toUpperCase()}
              </span>
              <span
                className={`chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
              >
                {recap.approved ? "PUBLISHED" : "DRAFT"}
              </span>
            </div>
            <h1
              className="display text-3xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              {recap.name ?? event?.name ?? "Recap"}
            </h1>
            <p
              className="mt-1"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {event?.request?.retailer?.name ?? event?.address ?? "—"}
              {" · "}
              {fmtDate(fieldDate)}
              {fieldTime ? ` · ${fieldTime}` : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={isPdfRunning}
              onClick={() => {
                commitPdf({
                  variables: { input: { id: recap.id } },
                  onCompleted: (res) => {
                    if (res.generateRecapPdf?.success) {
                      const file = res.generateRecapPdf.recapFile?.file;
                      if (file) {
                        window.open(recapFileUrl(file), "_blank");
                      }
                      showAlert("PDF generated.", "success");
                    } else {
                      showAlert(
                        res.generateRecapPdf?.message ??
                          "PDF generation failed.",
                        "error",
                      );
                    }
                  },
                  onError: (err) =>
                    showAlert(`PDF failed: ${err.message}`, "error"),
                });
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: isPdfRunning ? 0.5 : 1,
              }}
            >
              {isPdfRunning ? "Generating…" : "⬇ PDF"}
            </button>
            <button
              disabled={isZipping || allFiles.length === 0}
              onClick={async () => {
                setIsZipping(true);
                try {
                  const { default: JSZip } = await import("jszip");
                  const zip = new JSZip();
                  // Cap at 200 files for sanity. Order doesn't matter; the
                  // backend can mass-export later.
                  const subset = allFiles.slice(0, 200);
                  let added = 0;
                  for (const f of subset) {
                    const url = recapFileUrl(f?.file);
                    if (!url) continue;
                    try {
                      const resp = await fetch(url);
                      if (!resp.ok) continue;
                      const blob = await resp.blob();
                      const filename =
                        (f?.file ?? "").split("/").pop() || `file-${added}`;
                      zip.file(filename, blob);
                      added += 1;
                    } catch {
                      /* skip individual failures */
                    }
                  }
                  if (added === 0) {
                    showAlert("No downloadable files.", "warning");
                    setIsZipping(false);
                    return;
                  }
                  const out = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 },
                  });
                  const a = document.createElement("a");
                  const downloadUrl = URL.createObjectURL(out);
                  a.href = downloadUrl;
                  a.download = `recap-${uuid.slice(-6)}-photos.zip`;
                  a.click();
                  URL.revokeObjectURL(downloadUrl);
                  showAlert(`Downloaded ${added} files.`, "success");
                } catch (e) {
                  showAlert(`Download failed: ${(e as Error).message}`, "error");
                } finally {
                  setIsZipping(false);
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity:
                  isZipping || allFiles.length === 0 ? 0.5 : 1,
              }}
            >
              {isZipping
                ? `Zipping ${allFiles.length}…`
                : `⬇ Download photos (${allFiles.length})`}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: recap.name ?? "Spark recap",
                      url: window.location.href,
                    })
                    .catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  showAlert("Link copied.", "success");
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ↗ Share
            </button>
            <button
              onClick={() => setReassignOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
              title="Move this recap to a different event (fixes wrong-event mis-links)"
            >
              ⇄ Move to event
            </button>
            {/* Admin-only recap approval. Nevena: "I don't see where to
                approve recap." Distinct from request approval — this
                marks the RECAP itself approved. Shows the current state
                and flips it. */}
            {isAdmin &&
              (recap.approved ? (
                <button
                  onClick={() => setApproved(false)}
                  disabled={isApproving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: "transparent",
                    color: "var(--spark-orange)",
                    border: "1px solid rgba(239,90,42,0.4)",
                    opacity: isApproving ? 0.5 : 1,
                  }}
                  title="This recap is approved — click to un-approve"
                >
                  ✓ Approved · undo
                </button>
              ) : (
                <button
                  onClick={() => setApproved(true)}
                  disabled={isApproving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: "var(--spark-lime)",
                    color: "#0a0d09",
                    boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                    opacity: isApproving ? 0.5 : 1,
                  }}
                  title="Approve this recap"
                >
                  {isApproving ? "Approving…" : "✓ Approve recap"}
                </button>
              ))}

            {/* Admin-only number editor. Replaced the old dead-route
                placeholder (which black-screened, then showed a "ping
                your RMM" toast). Now opens an inline editor for the
                quantitative fields. Clients stay read-only — they see
                no Edit affordance. */}
            {isAdmin && (
              <button
                onClick={() =>
                  editingNumbers ? setEditingNumbers(false) : startEditNumbers()
                }
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: editingNumbers
                    ? "var(--spark-lime)"
                    : "transparent",
                  color: editingNumbers ? "#0a0d09" : "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
                title="Edit the recap's numbers (products sold, cans, packs, engagements, spend)"
              >
                {editingNumbers ? "✕ Close editor" : "✎ Edit recap"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin number editor panel */}
      {isAdmin && editingNumbers && (
        <div
          className="spark-card p-6"
          style={{ borderColor: "rgba(197,245,70,0.3)" }}
        >
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
          >
            EDIT RECAP · ADMIN
          </p>
          <h3 className="display font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
            Correct recap numbers + BA
          </h3>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Photos, feedback, and all other fields are preserved — only the
            numbers below change. Leave a field blank to clear it.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            {(
              [
                { key: "productsSold", label: "Products sold" },
                { key: "totalCansSold", label: "Cans sold" },
                { key: "totalPacksSold", label: "Packs sold" },
                { key: "totalConsumer", label: "Total engagements" },
                { key: "accountSpendAmount", label: "Account spend ($)" },
              ] as { key: string; label: string }[]
            ).map((f) => (
              <div key={f.key}>
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)" }}
                >
                  {f.label.toUpperCase()}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft[f.key] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-[15px]"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* BA assignment. Nevena: "I cant add BA for that recap
              anywhere." Shows the current BA and lets the admin search +
              reassign. Saved together with the numbers on Save changes. */}
          <div className="mt-5">
            <label
              className="mono text-[10px] block mb-1"
              style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)" }}
            >
              ASSIGNED BA
            </label>
            <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.75)" }}>
              {pickedBa ? (
                <>
                  <span style={{ color: "var(--spark-lime)" }}>
                    {pickedBa.name}
                  </span>{" "}
                  <button
                    type="button"
                    onClick={() => setPickedBa(null)}
                    className="mono text-[10px] ml-1"
                    style={{ color: "var(--spark-orange)" }}
                  >
                    (undo)
                  </button>
                </>
              ) : ambassadors.length > 0 ? (
                [ambassadors[0]?.user?.firstName, ambassadors[0]?.user?.lastName]
                  .filter(Boolean)
                  .join(" ") || "Current BA"
              ) : (
                <span style={{ color: "rgba(255,255,255,0.45)" }}>
                  No BA assigned yet
                </span>
              )}
            </p>
            <Suspense
              fallback={
                <div
                  className="mono text-[10px] py-2"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  Loading BA search…
                </div>
              }
            >
              <BaSearch
                onPick={(id, name) => setPickedBa({ id, name })}
              />
            </Suspense>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={saveNumbers}
              disabled={isUpdating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                opacity: isUpdating ? 0.5 : 1,
              }}
            >
              {isUpdating ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => setEditingNumbers(false)}
              disabled={isUpdating}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reassignOpen && (
        <ReassignRecapModal
          recapId={recap.id}
          currentEventName={event?.name ?? null}
          currentEventId={(event?.id as string | undefined) ?? null}
          onClose={() => setReassignOpen(false)}
          onReassigned={() => {
            // No imperative refetch — the Relay store updates from
            // the mutation's selection set (recap.event), which
            // bubbles back into the open view automatically.
          }}
        />
      )}

      {/* 5 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          icon="◉"
          label="Samples"
          value={fmtNum(totalConsumer)}
          glow
        />
        <KpiTile icon="★" label="First-time" value={fmtNum(firstTime)} />
        <KpiTile icon="◍" label="Brand aware" value={fmtNum(brandAware)} />
        <KpiTile icon="$" label="Willing to buy" value={fmtNum(willing)} />
        <KpiTile icon="$" label="Products sold" value={fmtNum(productsSold)} />
      </div>

      {/* Performance row — financial + qualitative signals */}
      {(recap.totalEarnings != null ||
        recap.accountSpendAmount != null ||
        recap.totalCansSold != null ||
        recap.totalPacksSold != null) && (
        <div className="spark-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="display font-bold">Performance</h3>
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              FIELD-LOGGED · UNITS + DOLLARS
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="label-mini">CANS SOLD</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                  color: "var(--spark-lime)",
                }}
              >
                {fmtNum(recap.totalCansSold)}
              </p>
            </div>
            <div>
              <p className="label-mini">PACKS SOLD</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                {fmtNum(recap.totalPacksSold)}
              </p>
            </div>
            <div>
              <p className="label-mini">REVENUE</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                  color: "var(--spark-lime)",
                }}
              >
                {typeof recap.totalEarnings === "number"
                  ? `$${recap.totalEarnings.toLocaleString()}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="label-mini">ACCOUNT SPEND</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                {typeof recap.accountSpendAmount === "number"
                  ? `$${recap.accountSpendAmount.toLocaleString()}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Consumer voice — quotes, demographics, positive stories, reasons-to-decline */}
      {consumerFeedback && (
        consumerFeedback.feedback ||
        consumerFeedback.quotes ||
        consumerFeedback.demographics ||
        consumerFeedback.positiveStories ||
        consumerFeedback.reasonsToDecline
      ) ? (
        <div className="spark-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="display font-bold">Consumer voice</h3>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              QUOTES · DEMOGRAPHICS · WHAT WORKED
            </p>
          </div>
          {consumerFeedback.quotes && (
            <div>
              <p
                className="mono text-[10px] mb-2"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                }}
              >
                QUOTES FROM THE FLOOR
              </p>
              <blockquote
                className="italic text-sm leading-relaxed pl-4"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  borderLeft: "2px solid rgba(197,245,70,0.5)",
                }}
              >
                "{consumerFeedback.quotes}"
              </blockquote>
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-5">
            {consumerFeedback.feedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  GENERAL FEEDBACK
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.feedback}
                </p>
              </div>
            )}
            {consumerFeedback.demographics && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  DEMOGRAPHICS
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.demographics}
                </p>
              </div>
            )}
            {consumerFeedback.positiveStories && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  POSITIVE STORIES
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.positiveStories}
                </p>
              </div>
            )}
            {consumerFeedback.reasonsToDecline && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  REASONS TO DECLINE
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.reasonsToDecline}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Account feedback */}
      {accountFeedback &&
        (accountFeedback.feedback ||
          accountFeedback.doDifferentlyFeedback ||
          accountFeedback.wasCorpoCardUsed) ? (
        <div className="spark-card p-6 space-y-4">
          <h3 className="display font-bold">Account feedback</h3>
          <div className="grid lg:grid-cols-2 gap-5">
            {accountFeedback.feedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  WHAT WENT WELL
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {accountFeedback.feedback}
                </p>
              </div>
            )}
            {accountFeedback.doDifferentlyFeedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  DO DIFFERENTLY
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {accountFeedback.doDifferentlyFeedback}
                </p>
              </div>
            )}
          </div>
          {accountFeedback.wasCorpoCardUsed !== null && (
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: accountFeedback.wasCorpoCardUsed
                  ? "var(--spark-lime)"
                  : "rgba(255,255,255,0.45)",
              }}
            >
              CORPORATE CARD ·{" "}
              {accountFeedback.wasCorpoCardUsed ? "USED" : "NOT USED"}
            </p>
          )}
        </div>
      ) : null}

      {/* Upload zone — admin/BA can add photos + receipts on the fly */}
      <div
        className="spark-card p-6"
        style={{
          borderColor: "rgba(197,245,70,0.25)",
          background:
            "linear-gradient(180deg, rgba(197,245,70,0.04), transparent)",
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              UPLOAD · CAPTURES + RECEIPTS
            </p>
            <h3
              className="display font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              Add files to this recap
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <RecapUploader
              recapUuid={uuid}
              category="photo"
              onUploaded={(blobName) => {
                // Attach the just-uploaded blob to this recap via the
                // dedicated addRecapFile mutation, then bump refreshKey
                // so the Files grid re-queries and shows it. fileTypeId
                // "1" / fileRecapCategoryId "1" mirror the recap-create
                // form's photo defaults.
                commitAddFile({
                  variables: {
                    input: {
                      recapId: recap.id,
                      file: blobName,
                      fileTypeId: "1",
                      fileRecapCategoryId: "1",
                    },
                  },
                  onCompleted: (res) => {
                    if (res.addRecapFile?.success) {
                      showAlert("Photo attached to recap.", "success");
                      setRefreshKey((k) => k + 1);
                    } else {
                      showAlert(
                        res.addRecapFile?.message ?? "Couldn't attach photo.",
                        "error",
                      );
                    }
                  },
                  onError: (err) =>
                    showAlert(`Attach failed: ${err.message}`, "error"),
                });
              }}
            />
            <RecapUploader
              recapUuid={uuid}
              category="receipt"
              onUploaded={(blobName) => {
                commitAddFile({
                  variables: {
                    input: {
                      recapId: recap.id,
                      file: blobName,
                      fileTypeId: "1",
                      // Category "2" = receipt (matches recap-create form).
                      fileRecapCategoryId: "2",
                    },
                  },
                  onCompleted: (res) => {
                    if (res.addRecapFile?.success) {
                      showAlert("Receipt attached to recap.", "success");
                      setRefreshKey((k) => k + 1);
                    } else {
                      showAlert(
                        res.addRecapFile?.message ?? "Couldn't attach receipt.",
                        "error",
                      );
                    }
                  },
                  onError: (err) =>
                    showAlert(`Attach failed: ${err.message}`, "error"),
                });
              }}
            />
          </div>
        </div>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Photos and receipts upload directly to GCS via signed URL, then
          attach to this recap automatically — they appear in the Files
          grid above as soon as the upload completes.
        </p>
      </div>

      {/* Field intelligence — traffic + competitive presence */}
      {(recap.trafficDescription || recap.competitivePresence) && (
        <div className="grid lg:grid-cols-2 gap-5">
          {recap.trafficDescription && (
            <div className="spark-card p-6">
              <p
                className="mono text-[10px] mb-3"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-sky)",
                }}
              >
                TRAFFIC · ON THE GROUND
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {recap.trafficDescription}
              </p>
            </div>
          )}
          {recap.competitivePresence && (
            <div className="spark-card p-6">
              <p
                className="mono text-[10px] mb-3"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-orange)",
                }}
              >
                COMPETITIVE PRESENCE
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {recap.competitivePresence}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Two-col: SKU + Photos + Notes | Team + Compare */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5">
          {/* SKU breakdown */}
          {sales.length > 0 && (
            <div className="spark-card p-6">
              <h3 className="display font-bold mb-3">Per-SKU breakdown</h3>
              <div className="space-y-2">
                {sales.map((s, i) => (
                  <div
                    key={s?.uuid ?? i}
                    className="flex items-center justify-between py-2"
                    style={{
                      borderBottom:
                        i < sales.length - 1
                          ? "1px solid var(--spark-border)"
                          : "none",
                    }}
                  >
                    <p className="text-sm font-medium">
                      {s?.product?.name ?? "—"}
                    </p>
                    <div className="flex items-center gap-3">
                      {s?.typeOfGood?.name && (
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {s.typeOfGood.name.toUpperCase()}
                        </span>
                      )}
                      <p
                        className="tab-num text-sm font-bold"
                        style={{ color: "var(--spark-lime)" }}
                      >
                        {s?.price ? `$${s.price}` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files: images render inline, HEIC + PDF + video shown as
              kind-labeled tiles that open in a new tab. Always rendered
              so missing-data states are visible, not silent. */}
          <div className="spark-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="display font-bold">
                  Files · {allFiles.length}
                </h3>
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  CLICK ANY TILE →
                </p>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {allFiles.slice(0, 36).map((p, i) => {
                  const kind = recapFileKind(p?.file);
                  const url = recapFileUrlFresh(p?.file);
                  const labelByKind: Record<typeof kind, string> = {
                    image: "",
                    heic: "HEIC",
                    pdf: "PDF",
                    video: "VIDEO",
                    other: "FILE",
                  };
                  const fileId = p?.id ? String(p.id) : null;
                  const fileLabel =
                    (p?.file ?? "").split("/").pop() || "this file";
                  return (
                    <a
                      key={p?.uuid ?? i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden relative group"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      {/* Admin-only remove button. Stops the parent <a>
                          from navigating; confirms before deleting. */}
                      {isAdmin && fileId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFile(fileId, fileLabel);
                          }}
                          title="Remove this file from the recap"
                          className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full grid place-items-center text-xs font-bold transition opacity-0 group-hover:opacity-100"
                          style={{
                            background: "rgba(10,13,9,0.85)",
                            color: "var(--spark-orange)",
                            border: "1px solid rgba(239,90,42,0.5)",
                          }}
                        >
                          ✕
                        </button>
                      )}
                      {kind === "image" ? (
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Make failures visible — don't hide. Show
                            // the URL so we can diagnose in the wild.
                            const t = e.currentTarget as HTMLImageElement;
                            t.outerHTML = `<div style="font:9px/12px monospace;color:#ef5a2a;padding:6px;word-break:break-all;background:rgba(239,90,42,0.08)">IMG FAILED<br/>${url}</div>`;
                          }}
                        />
                      ) : kind === "heic" ? (
                        <HeicImage
                          url={url}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center">
                          <div className="text-center">
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                letterSpacing: "0.16em",
                                color: "var(--spark-lime)",
                              }}
                            >
                              {labelByKind[kind]}
                            </span>
                            <p
                              className="mono mt-1"
                              style={{
                                fontSize: 8,
                                letterSpacing: "0.14em",
                                color: "rgba(255,255,255,0.45)",
                              }}
                            >
                              OPEN →
                            </p>
                          </div>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
              {allFiles.length > 36 && (
                <p
                  className="mt-3 mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  + {allFiles.length - 36} more files
                </p>
              )}
              {allFiles.length === 0 && (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  No files attached yet. BAs upload photos + PDFs from the
                  field; they show up here.
                </p>
              )}
            </div>

          {/* BA notes */}
          {notes && (
            <div className="spark-card p-6">
              <h3 className="display font-bold mb-3">BA notes from the field</h3>
              <blockquote
                className="italic text-sm leading-relaxed pl-4"
                style={{
                  color: "rgba(255,255,255,0.75)",
                  borderLeft: "2px solid rgba(197,245,70,0.5)",
                }}
              >
                "{notes}"
              </blockquote>
              {ambassadors[0]?.user && (
                <p
                  className="mono text-[10px] mt-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  — {ambassadors[0].user.firstName?.toUpperCase() ?? ""}{" "}
                  {ambassadors[0].user.lastName?.toUpperCase() ?? ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="spark-card p-5">
            <h3 className="font-bold mb-3">Team</h3>
            {ambassadors.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No team logged yet.
              </p>
            ) : (
              ambassadors.map((a) => {
                const fullName = `${a?.user?.firstName ?? ""} ${a?.user?.lastName ?? ""}`.trim();
                const baId = a?.id ?? "";
                const overridden = baId ? ratingOverrides[baId] : undefined;
                const shownRating =
                  overridden != null
                    ? overridden
                    : typeof a?.rating === "number"
                      ? a.rating
                      : null;
                return (
                  <div key={a?.uuid} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="spark-avatar"
                        style={{ width: 32, height: 32, fontSize: "0.75rem" }}
                      >
                        {initials(fullName || "BA")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {fullName || "Ambassador"}
                        </p>
                        <p
                          className="mono text-[10px]"
                          style={{ color: "rgba(255,255,255,0.45)" }}
                        >
                          {shownRating != null && shownRating > 0
                            ? `★ ${shownRating.toFixed(1)} avg`
                            : "Not yet rated"}
                        </p>
                      </div>
                    </div>
                    {baId && (
                      <div className="mt-2">
                        <p
                          className="mono text-[10px] mb-1"
                          style={{
                            letterSpacing: "0.12em",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          RATE THIS BA
                        </p>
                        <RateBaControl
                          ambassadorId={baId}
                          eventId={event?.id ?? null}
                          ambassadorName={fullName || "this BA"}
                          onRated={(avg) =>
                            setRatingOverrides((prev) => ({
                              ...prev,
                              [baId]: avg,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ─────────────────── page ─────────────────── */

export default function SparkRecapView() {
  const { uuid } = useParams<{ uuid: string }>();
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading recap…
          </div>
        }
      >
        <SparkRecapInner uuid={uuid ?? ""} />
      </Suspense>
    </Layout>
  );
}
