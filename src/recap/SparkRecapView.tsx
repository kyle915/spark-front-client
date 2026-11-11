import { lazy, Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { StatusMorph } from "@/motion/StatusMorph";
import {
  holdActionSuccess,
  recapReviewStatus,
  type ActionPhase,
} from "@/motion/opsMotion";
import {
  RecapDetailBackLink,
  RecapDetailChrome,
  RecapDetailPanel,
  RecapDetailTabs,
  RecapKpiStrip,
  isRecapBodyTab,
  type RecapDetailTab,
} from "@/recap/RecapDetailShell";
import { useLazyLoadQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapPhotoReusePanel } from "./RecapPhotoReusePanel";
import AskAiButton from "@/components/ai/AskAiButton";
import { RecapDetailSkeleton } from "@/layout/PageSkeletons";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@api/queries/__generated__/RecapQuery.graphql";
import { CustomRecapExistsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQueryExistsQuery as CustomRecapsQueryExistsQueryType } from "@/api/queries/__generated__/CustomRecapsQueryExistsQuery.graphql";
import { GenerateRecapPdfMutation } from "@/api/mutations/GenerateRecapPdfMutation";
import type { GenerateRecapPdfMutation as GenerateRecapPdfMutationType } from "@/api/mutations/__generated__/GenerateRecapPdfMutation.graphql";
import { AddRecapFileMutation } from "@/api/mutations/AddRecapFileMutation";
import type { AddRecapFileMutation as AddRecapFileMutationType } from "@/api/mutations/__generated__/AddRecapFileMutation.graphql";
import { UpdateRecapMutation } from "@/api/mutations/UpdateRecapMutation";
import type { UpdateRecapMutation as UpdateRecapMutationType } from "@/api/mutations/__generated__/UpdateRecapMutation.graphql";
import { ApproveRecapMutation } from "@/api/mutations/ApproveRecapMutation";
import type { ApproveRecapMutation as ApproveRecapMutationType } from "@/api/mutations/__generated__/ApproveRecapMutation.graphql";
import { ArchiveRecapMutation } from "@/api/mutations/ArchiveRecapMutation";
import type { ArchiveRecapMutation as ArchiveRecapMutationType } from "@/api/mutations/__generated__/ArchiveRecapMutation.graphql";
import { UnarchiveRecapMutation } from "@/api/mutations/UnarchiveRecapMutation";
import type { UnarchiveRecapMutation as UnarchiveRecapMutationType } from "@/api/mutations/__generated__/UnarchiveRecapMutation.graphql";
import { RemoveRecapFileMutation } from "@/api/mutations/RemoveRecapFileMutation";
import type { RemoveRecapFileMutation as RemoveRecapFileMutationType } from "@/api/mutations/__generated__/RemoveRecapFileMutation.graphql";
import { DeleteRecapMutation } from "@/api/mutations/DeleteRecapMutation";
import type { DeleteRecapMutation as DeleteRecapMutationType } from "@/api/mutations/__generated__/DeleteRecapMutation.graphql";
import { AmbassadorSearchQuery } from "@/api/queries/AmbassadorSearchQuery";
import type { AmbassadorSearchQuery as AmbassadorSearchQueryType } from "@/api/queries/__generated__/AmbassadorSearchQuery.graphql";
import {
  markRecapsListNeedsRefresh,
  recapsListHrefFromReturn,
  recapsListNavState,
} from "./recapListFilters";
import {
  getRecapQueueNeighbors,
  markRecapOpenedInQueue,
  markRecapReviewedInQueue,
  recapQueueWarmTargets,
} from "./recapReviewQueue";
import { prefetchRecapDetails } from "./prefetchRecapDetail";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";
import { useAuthStore } from "@/store/authStore";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@/api/queries/__generated__/ProductsQuery.graphql";
import { CreateProductMutation } from "@/api/mutations/CreateProductMutation";
import type { CreateProductMutation as CreateProductMutationType } from "@/api/mutations/__generated__/CreateProductMutation.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import RateBaControl from "@/components/RateBaControl";
import { recapDisplayUrl, recapFileKind, recapFileUrl, recapFileUrlFresh, recapVideoPlayUrl } from "@/utils/recapFileUrl";
import { useRecapPageCrumb } from "@/layout/pageCrumb";
import ShareRecapModal from "@/recap/components/ShareRecapModal";
import { RecapVideoPlayer } from "@/shared/RecapVideoPlayer";
import RecapStickyOpsBar from "@/recap/RecapStickyOpsBar";
import { parseLocaleNumber } from "@/utils";
import { SpendAmountInput } from "@/recap/SpendAmountInput";
import {
  spendAmountStored,
  spendAmountSubmitError,
} from "@/recap/spendAmount";
import { useAlertStore } from "@/store/alertStore";
import RecapUploader from "./RecapUploader";
import { FileRecapCategoriesQuery } from "@/api/queries/FileRecapCategoriesQuery";
import type { FileRecapCategoriesQuery as FileRecapCategoriesQueryType } from "@/api/queries/__generated__/FileRecapCategoriesQuery.graphql";
import {
  buildFileRecapCategoryOptions,
  defaultUploadCategoryName,
  isReceiptLikeCategory,
  FALLBACK_FILE_CATEGORY_PHOTOS,
} from "@/recap/fileRecapCategoryOptions";
import ReassignRecapModal from "./ReassignRecapModal";
import { thumbUrl } from "@/utils/thumb";
import { RecapClientSignoff } from "@/recap/RecapClientSignoff";
import { RecapDocument } from "@/recap/RecapDocument";
import { editedNote } from "@/recap/recapEditHistory";
import { RecapEditHistorySheet } from "@/recap/RecapEditHistorySheet";
import { recapApprovalMeta } from "@/recap/recapApprovalMeta";
import { formatRecapProductName } from "@/recap/recapFieldLabel";
import { RecapClientSignoffMutation } from "@/api/mutations/RecapClientSignoffMutation";
import type { RecapClientSignoffMutation as RecapClientSignoffMutationType } from "@/api/mutations/__generated__/RecapClientSignoffMutation.graphql";
import PushToPlanButton from "@/field/PushToPlanButton";
import { recapTypeForRow } from "@/lib/activationBucket";

const RecapQualityPanel = lazy(() => import("./RecapQualityPanel"));
const RecapReviewChecks = lazy(() => import("./RecapReviewChecks"));

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

/* ─────────────────── inner ─────────────────── */

/**
 * Type-ahead BA picker for the recap editor. Searches activeAmbassadors
 * (tenant-scoped) and calls onPick with the BA's Relay id (which
 * updateRecap's ambassador_id runs through resolve_id_to_int). Mirrors
 * the picker on the recap-create form. Suspends on the search query, so
 * the caller wraps it in <Suspense>.
 */
// Sentinel id prefix for "external BA" picks — when the worker isn't
// in Spark yet (sub-contractor, one-off helper, etc.). The save handler
// branches on this prefix to send `externalBaName` instead of
// `ambassadorId`. Kept as a string so the existing pickedBa state shape
// (id + name) doesn't have to fork into a discriminated union.
const EXTERNAL_BA_ID_PREFIX = "external:";

type SampleRow = { productId: string; quantity: string };

/**
 * Editor for "products sampled" on a recap: pick products from the client's
 * catalog and enter the units sampled for each. Admin can also add a brand-new
 * product inline (name only — the backend files it under the tenant's default
 * type, no product-type setup required). Mirrors the BaSearch pattern: runs its
 * own tenant-scoped ProductsQuery, so the caller wraps it in <Suspense>.
 */
const ProductSampleEditor: React.FC<{
  tenantId: string;
  rows: SampleRow[];
  onChange: (rows: SampleRow[]) => void;
}> = ({ tenantId, rows, onChange }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [catalogKey, setCatalogKey] = useState(0);
  const data = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { filters: { tenantId }, first: 200 },
    { fetchPolicy: "store-and-network", fetchKey: catalogKey },
  );
  const [commitCreate, creating] =
    useMutation<CreateProductMutationType>(CreateProductMutation);
  const [newName, setNewName] = useState("");

  const catalog = (data?.products?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({ id: String(n.id), name: n.name ?? "Product" }));

  const setRow = (i: number, patch: Partial<SampleRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { productId: "", quantity: "" }]);
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));

  const addNewProduct = () => {
    const name = newName.trim();
    if (!name || creating) return;
    commitCreate({
      variables: { input: { name, tenantId } },
      onCompleted: (res) => {
        const p = res.createProduct?.product;
        if (res.createProduct?.success && p) {
          setNewName("");
          setCatalogKey((k) => k + 1); // refresh the dropdown options
          onChange([...rows, { productId: String(p.id), quantity: "" }]);
        } else {
          showAlert(
            res.createProduct?.message ?? "Couldn't add product.",
            "error",
          );
        }
      },
      onError: (err) =>
        showAlert(`Add product failed: ${err.message}`, "error"),
    });
  };

  const inputStyle = {
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
  } as const;

  return (
    <div className="mt-5">
      <label
        className="mono text-[10px] block mb-2"
        style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
      >
        Products sampled
      </label>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-xs" style={{ color: "var(--recap-faint, #7a7f70)" }}>
            No products added yet — add a line below.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={r.productId}
              onChange={(e) => setRow(i, { productId: e.target.value })}
              className="flex-1 rounded-lg px-3 py-2 text-[15px]"
              style={inputStyle}
            >
              <option value="">Select product…</option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {r.productId &&
                !catalog.some((p) => p.id === r.productId) && (
                  <option value={r.productId}>(selected product)</option>
                )}
            </select>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Units"
              value={r.quantity}
              onChange={(e) => setRow(i, { quantity: e.target.value })}
              className="w-24 rounded-lg px-3 py-2 text-[15px]"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="mono text-[10px]"
              style={{ color: "var(--spark-orange)" }}
            >
              REMOVE
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mono text-[10px] mt-2"
        style={{ color: "var(--spark-lime)" }}
      >
        + ADD PRODUCT LINE
      </button>

      {/* Inline add-a-product (admin): name only; the backend files it under
          the tenant's default product type. */}
      <div
        className="flex gap-2 items-center mt-3 pt-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New product name…"
          className="flex-1 rounded-lg px-3 py-2 text-[15px]"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={addNewProduct}
          disabled={creating || !newName.trim()}
          className="mono text-[10px] px-3 py-2 rounded-lg"
          style={{
            color: "var(--spark-bg)",
            background: "var(--spark-lime)",
            opacity: creating || !newName.trim() ? 0.5 : 1,
          }}
        >
          {creating ? "ADDING…" : "+ ADD NEW PRODUCT"}
        </button>
      </div>
    </div>
  );
};

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
  const trimmedQ = q.trim();
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
            <div>
              <p
                className="mono text-[10px] py-1"
                style={{ letterSpacing: "0.16em", color: "var(--recap-muted, #5c6154)" }}
              >
                NO MATCHES
              </p>
              {/* Reconciliation fallback: let the admin save the typed
                  name as a free-text "external BA" when the worker
                  isn't in Spark yet. Saves to recap.externalBaName so
                  the recap is properly attributed without polluting
                  the Ambassador table with stub accounts. */}
              {trimmedQ.length >= 2 && (
                <button
                  type="button"
                  onClick={() =>
                    onPick(
                      `${EXTERNAL_BA_ID_PREFIX}${trimmedQ}`,
                      trimmedQ,
                    )
                  }
                  className="mt-2 w-full text-left rounded-lg px-3 py-2 text-sm"
                  style={{
                    background:
                      "var(--spark-surface-2, rgba(var(--spark-ink-rgb),0.04))",
                    border: "1px dashed var(--spark-border)",
                  }}
                >
                  + Save{" "}
                  <span style={{ color: "var(--spark-lime)" }}>
                    “{trimmedQ}”
                  </span>{" "}
                  as external BA
                  <span
                    className="mono text-[10px] block mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--recap-muted, #5c6154)",
                    }}
                  >
                    USE WHEN THE WORKER ISN'T IN SPARK YET
                  </span>
                </button>
              )}
            </div>
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
                    background: "var(--spark-surface-2, rgba(var(--spark-ink-rgb),0.04))",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  {display}
                  {full && amb.user?.email && (
                    <span
                      className="mono text-[10px] ml-2"
                      style={{ color: "var(--recap-muted, #5c6154)" }}
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

const SparkRecapInner: React.FC<{
  uuid: string;
  refreshKey: number;
  onRefresh: () => void;
}> = ({ uuid, refreshKey, onRefresh }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [approvePhase, setApprovePhase] = useState<ActionPhase>("idle");
  const [commitArchive, isArchiving] =
    useMutation<ArchiveRecapMutationType>(ArchiveRecapMutation);
  const [commitUnarchive, isUnarchiving] =
    useMutation<UnarchiveRecapMutationType>(UnarchiveRecapMutation);
  const [commitSignoff, isSigningOff] =
    useMutation<RecapClientSignoffMutationType>(RecapClientSignoffMutation);
  const [commitRemoveFile] =
    useMutation<RemoveRecapFileMutationType>(RemoveRecapFileMutation);
  const [commitDelete, isDeleting] =
    useMutation<DeleteRecapMutationType>(DeleteRecapMutation);
  const { isAdmin, isClient } = useSparkRole();
  const environment = useRelayEnvironment();
  const { tenantId: authTenantId } = useAuthStore();
  const [isZipping, setIsZipping] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{
    playSrc: string;
    fileUrl: string;
    name: string;
  } | null>(null);
  const [detailTab, setDetailTab] = useState<RecapDetailTab>("overview");
  // Admin-only inline number editor. `editingNumbers` toggles the panel;
  // `draft` holds the in-progress string values keyed by field.
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState("");
  // Tracks whether Products Sold was set explicitly (stored value or the
  // admin typed one) vs auto-derived from Cans + Packs. While false, we
  // keep Products Sold = Cans + Packs as the admin edits either — mirrors
  // the create form. Liquid Death recaps came in with a null productsSold,
  // so the editor showed it blank even though Cans was filled; this makes
  // it auto-fill on open and as the numbers are corrected.
  const [productsSoldManual, setProductsSoldManual] = useState(false);
  // Products sampled (product + units) the admin is editing in the panel.
  // Seeded from the recap's existing samples on edit; sent on save.
  const [sampleRows, setSampleRows] = useState<SampleRow[]>([]);
  // BA the admin newly picked in the editor. Null = leave the recap's
  // current ambassador unchanged (updateRecap's ambassador_id is guarded
  // server-side, so a null is a no-op, not a clear).
  const [pickedBa, setPickedBa] = useState<{ id: string; name: string } | null>(
    null,
  );
  // Per-BA optimistic rating average, keyed by ambassador global id, so
  // the Team card's "★ avg" updates the instant a rating is saved
  // (rateAmbassador returns the recomputed caller-visible average).
  const [ratingOverrides, setRatingOverrides] = useState<
    Record<string, number>
  >({});
  const data = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid },
    // refreshKey lives ABOVE Suspense so a network refetch that suspends
    // doesn't remount this tree and reset the key (re-serving stale store).
    {
      // store-or-network paints a recap that Next already prefetched,
      // instead of waiting on a second network round trip.
      fetchPolicy: refreshKey === 0 ? "store-or-network" : "network-only",
      fetchKey: refreshKey,
    },
  );

  const recap = data?.recap;
  const lastEditedNote = editedNote(recap?.metricEdits);
  const fileCategoryTenantId =
    recap?.event?.tenant?.id ?? recap?.event?.tenantId ?? "0";
  const categoriesData = useLazyLoadQuery<FileRecapCategoriesQueryType>(
    FileRecapCategoriesQuery,
    { filters: { tenantId: String(fileCategoryTenantId) } },
    { fetchPolicy: "store-and-network" },
  );
  const fileCategoryOptions = useMemo(
    () =>
      buildFileRecapCategoryOptions(
        categoriesData.fileRecapCategories.edges.map((e) => e?.node),
      ),
    [categoriesData],
  );
  const [uploadCategory, setUploadCategory] = useState(
    FALLBACK_FILE_CATEGORY_PHOTOS,
  );
  useEffect(() => {
    setUploadCategory((prev) => {
      if (fileCategoryOptions.some((o) => o.name === prev)) return prev;
      return defaultUploadCategoryName(fileCategoryOptions);
    });
  }, [fileCategoryOptions]);

  const approvalMeta = useMemo(
    () =>
      recap
        ? recapApprovalMeta(
            Boolean(recap.approved),
            recap.approvedBy,
            recap.approvedAt ?? null,
          )
        : null,
    [recap],
  );
  const crumbTitle = useMemo(() => {
    if (!recap) return null;
    const venue =
      recap.name ||
      recap.event?.request?.retailer?.name ||
      recap.event?.address ||
      "Recap";
    const date = fmtDate(recap.event?.date ?? recap.createdAt);
    return date && date !== "—" ? `${venue} · ${date}` : venue;
  }, [recap]);
  useRecapPageCrumb(crumbTitle);

  if (!recap) {
    // The uuid may belong to a custom-template recap (a separate model the
    // legacy `recap` query can't see) reached via a legacy /recap/view link
    // — e.g. an LD custom recap an admin opened from the recaps list or an
    // email. Probe the custom recap and redirect to its dedicated view
    // before dead-ending on "Recap not found."
    return (
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm"
            style={{ color: "var(--recap-muted, #5c6154)" }}
          >
            Loading recap…
          </div>
        }
      >
        <CustomRecapFallback uuid={uuid} />
      </Suspense>
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
  // View-mode KPI tiles. Each carries its raw numeric value so we can drop
  // tiles that have no data (null/blank) before rendering — keeps custom-
  // template recaps from showing a wall of empty "—" cards. Order/labels/
  // icons match the previous fixed layout; "Samples" keeps its glow.
  const kpiTiles = (
    [
      { icon: "◉", label: "Samples", value: totalConsumer, glow: true },
      { icon: "★", label: "First-time", value: firstTime },
      { icon: "◍", label: "Brand aware", value: brandAware },
      { icon: "$", label: "Willing to buy", value: willing },
      { icon: "$", label: "Products sold", value: productsSold },
    ] as { icon: string; label: string; value: number | null; glow?: boolean }[]
  ).filter((t) => t.value != null);
  const ambassadors = (recap.ambassadors ?? []).filter(Boolean);
  // All non-empty files. We split into renderable images (img tag) vs
  // unrenderable (HEIC + PDF + video), shown as labeled tiles.
  const allFiles = (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  );
  const existingPdf = allFiles.find((f) => {
    const ext = (f?.fileType?.extension ?? "").toLowerCase();
    const typeName = (f?.fileType?.name ?? "").toLowerCase();
    const path = (f?.file ?? "").toLowerCase();
    return ext.includes("pdf") || typeName === "pdf" || path.endsWith(".pdf");
  });
  const existingPdfUrl = existingPdf
    ? recapFileUrl(existingPdf.displayUrl || existingPdf.file)
    : "";
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
    // If Products Sold has no stored value, seed it from Cans + Packs
    // (and keep auto-deriving as they're edited). A present value is
    // treated as deliberate — left as-is and flagged manual so editing
    // Cans/Packs won't overwrite it.
    const hasStoredProductsSold = recap.productsSold != null;
    const cans = recap.totalCansSold ?? 0;
    const packs = recap.totalPacksSold ?? 0;
    const autoSum = cans + packs;
    setDraft({
      productsSold: hasStoredProductsSold
        ? recap.productsSold!.toString()
        : autoSum > 0
          ? String(autoSum)
          : "",
      totalCansSold: recap.totalCansSold?.toString() ?? "",
      totalPacksSold: recap.totalPacksSold?.toString() ?? "",
      accountSpendAmount: recap.accountSpendAmount?.toString() ?? "",
      totalConsumer: engagement?.totalConsumer?.toString() ?? "",
      // Recap-level scalars
      trafficDescription: recap.trafficDescription ?? "",
      competitivePresence: recap.competitivePresence ?? "",
      // Consumer feedback (most-recent row; same row the backend
      // updates in-place when feedback is sent).
      cfFeedback: consumerFeedback?.feedback ?? "",
      cfQuotes: consumerFeedback?.quotes ?? "",
      cfPositiveStories: consumerFeedback?.positiveStories ?? "",
      cfReasonsToDecline: consumerFeedback?.reasonsToDecline ?? "",
      cfDemographics: consumerFeedback?.demographics ?? "",
      // Account feedback
      afFeedback: accountFeedback?.feedback ?? "",
      afDoDifferently: accountFeedback?.doDifferentlyFeedback ?? "",
      afCorpoCard: accountFeedback?.corpoCard ?? "",
    });
    setProductsSoldManual(hasStoredProductsSold);
    // Seed the products-sampled editor from the recap's existing samples.
    setSampleRows(
      (recap.productSamples ?? [])
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({
          productId: s.product?.id ? String(s.product.id) : "",
          quantity: s.quantity != null ? String(s.quantity) : "",
        }))
        .filter((r) => r.productId),
    );
    setPickedBa(null);
    setEditReason("");
    setEditingNumbers(true);
  };

  // Field-change handler for the number editor. Products Sold auto-fills
  // from Cans + Packs until the admin types into it directly.
  const handleNumberChange = (key: string, value: string) => {
    setDraft((d) => {
      const nextDraft = { ...d, [key]: value };
      if (key === "productsSold") {
        // handled by setProductsSoldManual below
      } else if (
        (key === "totalCansSold" || key === "totalPacksSold") &&
        !productsSoldManual
      ) {
        const cans = parseLocaleNumber(nextDraft.totalCansSold) ?? 0;
        const packs = parseLocaleNumber(nextDraft.totalPacksSold) ?? 0;
        const sum = cans + packs;
        nextDraft.productsSold = sum > 0 ? String(sum) : "";
      }
      return nextDraft;
    });
    if (key === "productsSold") setProductsSoldManual(true);
  };

  // Locale-tolerant: "96,63" → 96.63 instead of NaN→null (which would
  // silently clear Account Spend on save).
  const numOrNull = (s: string): number | null => parseLocaleNumber(s);

  const saveNumbers = () => {
    if (isUpdating) return;
    const spendErr = spendAmountSubmitError(
      draft.accountSpendAmount,
      recap.accountSpendAmount != null ? String(recap.accountSpendAmount) : "",
    );
    if (spendErr) {
      showAlert(`Account spend: ${spendErr}`, "warning");
      return;
    }
    const storedSpend = spendAmountStored(draft.accountSpendAmount);
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

    // Branch on the sentinel prefix: external picks ride
    // externalBaName, real Spark BAs ride ambassadorId. The backend
    // guards both fields (only updates when not null), so leaving the
    // other side null is a no-op rather than a clear — exactly what
    // we want when the user only touched one of them.
    const isExternalPick = pickedBa?.id?.startsWith(EXTERNAL_BA_ID_PREFIX);
    const externalNameToSend = isExternalPick ? pickedBa!.name : null;
    const ambassadorIdToSend =
      pickedBa && !isExternalPick ? pickedBa.id : null;

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
          ambassadorId: ambassadorIdToSend,
          // Free-text external BA, used for reconciliation when the
          // actual worker isn't in Spark yet.
          externalBaName: externalNameToSend,
          // Edited numbers (null clears a value intentionally).
          productsSold: numOrNull(draft.productsSold),
          totalCansSold: numOrNull(draft.totalCansSold),
          totalPacksSold: numOrNull(draft.totalPacksSold),
          // Products sampled (product + units). Sending the array REPLACES the
          // recap's samples server-side (delete + recreate), so we always send
          // the current rows — removing a row clears it. Incomplete rows (no
          // product or no units) are dropped.
          productSamples: sampleRows
            .map((r) => ({
              productId: r.productId,
              quantity: numOrNull(r.quantity),
            }))
            .filter(
              (r): r is { productId: string; quantity: number } =>
                Boolean(r.productId) && r.quantity != null,
            ),
          accountSpendAmount: storedSpend != null
            ? Number(storedSpend)
            : (draft.accountSpendAmount ?? "").trim()
              ? numOrNull(draft.accountSpendAmount ?? "")
              : null,
          // Preserve totalEarnings; the editor doesn't touch it.
          totalEarnings: recap.totalEarnings ?? null,
          // Recap-level scalars now editable. Empty string clears.
          trafficDescription:
            (draft.trafficDescription ?? "").trim() || null,
          competitivePresence:
            (draft.competitivePresence ?? "").trim() || null,
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
          // Consumer feedback — backend upserts the most-recent row.
          // Always send so the admin can clear fields by emptying them.
          consumerFeedback: {
            feedback: (draft.cfFeedback ?? "").trim() || null,
            quotes: (draft.cfQuotes ?? "").trim() || null,
            positiveStories: (draft.cfPositiveStories ?? "").trim() || null,
            reasonsToDecline:
              (draft.cfReasonsToDecline ?? "").trim() || null,
            demographics: (draft.cfDemographics ?? "").trim() || null,
          },
          // Account feedback — same upsert pattern. wasCorpoCardUsed
          // not exposed in the editor yet; preserve the stored value.
          accountFeedback: {
            feedback: (draft.afFeedback ?? "").trim() || null,
            doDifferentlyFeedback:
              (draft.afDoDifferently ?? "").trim() || null,
            corpoCard: (draft.afCorpoCard ?? "").trim() || null,
            wasCorpoCardUsed: accountFeedback?.wasCorpoCardUsed ?? false,
          },
          editReason: editReason.trim() || null,
        },
      },
      // Dashboards read store-or-network; mark everything stale so they
      // refetch the corrected aggregates on next visit.
      updater: (store, res) => {
        if (res?.updateRecap?.success) store.invalidateStore();
      },
      onCompleted: (res) => {
        if (res.updateRecap?.success) {
          showAlert("Recap numbers updated.", "success");
          setEditingNumbers(false);
          onRefresh();
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

  const queueInfo = useMemo(() => getRecapQueueNeighbors(uuid), [uuid]);
  const [queueNavPending, startQueueNav] = useTransition();
  const goToQueueRecap = (href: string) => {
    startQueueNav(() => {
      navigate(href);
    });
  };
  useEffect(() => {
    markRecapOpenedInQueue(uuid);
    prefetchRecapDetails(environment, recapQueueWarmTargets(uuid));
  }, [uuid, environment]);

  // Approve / decline the recap itself (distinct from request approval).
  // After success, return to the list with a forced network refetch —
  // Relay updates the Recap node but not the Needs review connection, so
  // store-or-network would keep the row in the queue until a hard refresh.
  const setApproved = (approved: boolean, advanceToNext = false) => {
    if (isApproving || approvePhase !== "idle") return;
    if (approved) setApprovePhase("pending");
    const nextUnapproved = advanceToNext ? queueInfo?.nextUnapproved : null;
    const nextItemHref = nextUnapproved?.href ?? null;
    if (nextUnapproved) {
      prefetchRecapDetails(environment, [
        {
          uuid: nextUnapproved.uuid,
          isCustom: nextUnapproved.isCustom,
        },
        ...recapQueueWarmTargets(nextUnapproved.uuid),
      ]);
    }
    commitApprove({
      variables: { input: { id: recap.id, approved } },
      onCompleted: (res) => {
        if (res.approveRecap?.success) {
          markRecapReviewedInQueue(uuid, { approved });
          void refreshSidebarCounts(environment, authTenantId);
          showAlert(
            approved ? "Recap approved." : "Recap marked not approved.",
            "success",
          );
          const finish = () => {
            markRecapsListNeedsRefresh();
            if (nextItemHref) {
              goToQueueRecap(nextItemHref);
              return;
            }
            navigate(
              recapsListHrefFromReturn({
                searchParams,
                fallbackStatus: approved ? "approved" : "needs_review",
              }),
              { state: recapsListNavState(true) },
            );
          };
          if (approved) {
            setApprovePhase("success");
            void holdActionSuccess(nextItemHref ? 180 : undefined).then(finish);
            return;
          }
          finish();
        } else {
          setApprovePhase("idle");
          showAlert(
            res.approveRecap?.message ?? "Couldn't update approval.",
            "error",
          );
        }
      },
      onError: (err) => {
        setApprovePhase("idle");
        showAlert(`Approval failed: ${err.message}`, "error");
      },
    });
  };

  const archiveRecap = () => {
    if (isArchiving || isUnarchiving) return;
    commitArchive({
      variables: { input: { id: recap.id, reason: null } },
      onCompleted: (res) => {
        if (res.archiveRecap?.success) {
          markRecapReviewedInQueue(uuid, { archived: true });
          void refreshSidebarCounts(environment, authTenantId);
          showAlert(
            "Recap archived — kept as proof, hidden from client.",
            "success",
          );
          onRefresh();
        } else {
          showAlert(
            res.archiveRecap?.message ?? "Couldn't archive.",
            "warning",
          );
        }
      },
      onError: (err) =>
        showAlert(`Archive failed: ${err.message}`, "error"),
    });
  };

  const unarchiveRecap = () => {
    if (isArchiving || isUnarchiving) return;
    commitUnarchive({
      variables: { input: { id: recap.id } },
      onCompleted: (res) => {
        if (res.unarchiveRecap?.success) {
          markRecapReviewedInQueue(uuid, { archived: false });
          void refreshSidebarCounts(environment, authTenantId);
          showAlert("Recap restored to Needs review.", "success");
          onRefresh();
        } else {
          showAlert(
            res.unarchiveRecap?.message ?? "Couldn't unarchive.",
            "warning",
          );
        }
      },
      onError: (err) =>
        showAlert(`Unarchive failed: ${err.message}`, "error"),
    });
  };

  // Delete the whole recap (admin-only on the backend; tenant-scoped).
  // Confirms first, then navigates back to the recaps list — which frees
  // the event for a fresh recap. The list refetches on mount so the row
  // is gone when we land there.
  const backToListUrl = useMemo(
    () =>
      recapsListHrefFromReturn({
        searchParams,
        fallbackStatus: recap?.approved ? "approved" : "needs_review",
      }),
    [searchParams, recap?.approved],
  );

  const deleteRecap = () => {
    if (isDeleting) return;
    const ok = window.confirm(
      "Delete this recap? This permanently removes it and frees the event " +
        "for a new recap. This cannot be undone.",
    );
    if (!ok) return;
    commitDelete({
      variables: { input: { id: recap.id } },
      onCompleted: (res) => {
        if (res.deleteRecap?.success) {
          markRecapReviewedInQueue(uuid, { removed: true });
          void refreshSidebarCounts(environment, authTenantId);
          showAlert("Recap deleted.", "success");
          navigate(backToListUrl);
        } else {
          showAlert(res.deleteRecap?.message ?? "Delete failed.", "error");
        }
      },
      onError: (err) => showAlert(`Delete failed: ${err.message}`, "error"),
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
          // Refetch so the removed photo disappears immediately instead of
          // lingering until a manual page reload.
          onRefresh();
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

  const openShare = () => {
    if (!recap.shareToken) {
      showAlert("Share link isn't ready yet.", "warning");
      return;
    }
    setShareOpen(true);
  };

  return (
    <div className={`space-y-6 max-w-7xl${!isClient ? " pb-24" : ""}`}>
      <RecapDetailBackLink onClick={() => navigate(backToListUrl)}>
        ← Recaps
        {recap.name ? ` / ${recap.name}` : ""}
        {event?.request?.retailer?.name || event?.address
          ? ` / ${event?.request?.retailer?.name ?? event?.address}`
          : ""}
        {` / ${fmtDate(fieldDate)}`}
      </RecapDetailBackLink>

      <RecapDocument status={recap.approved ? "APPROVED" : "DRAFT"}>
      <div className="space-y-6">
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
                  background: "rgba(20, 22, 15, 0.05)",
                  color: "var(--recap-muted, #5c6154)",
                }}
              >
                {recap.name ?? event?.name ?? "Recap"}
              </span>
              <span
                className={`chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
              >
                <StatusMorph value={recapReviewStatus(Boolean(recap.approved))} />
              </span>
              {approvalMeta ? (
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.1em",
                    color: "rgba(92,97,84,0.9)",
                  }}
                >
                  {approvalMeta}
                </span>
              ) : null}
              {!isClient && lastEditedNote ? (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="chip recap-edited-chip"
                  title="Admin only — see every staff correction and the BA's original values"
                  data-no-print=""
                >
                  {lastEditedNote} · History
                </button>
              ) : null}
            </div>
            <h1
              className="display text-3xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              {recap.name ?? event?.name ?? "Recap"}
            </h1>
            <p className="mt-1 recap-doc-kicker">
              Field recap
              {" · "}
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
                // Always generate-on-demand — backend reuses only when the
                // GCS blob still exists (avoids NoSuchKey on stale rows).
                commitPdf({
                  variables: { input: { id: recap.id } },
                  onCompleted: (res) => {
                    if (res.generateRecapPdf?.success) {
                      const file = res.generateRecapPdf.recapFile?.file;
                      if (file) {
                        window.open(recapFileUrl(file), "_blank");
                      }
                      showAlert("PDF ready.", "success");
                    } else {
                      showAlert(
                        res.generateRecapPdf?.message ??
                          "PDF generation failed.",
                        "error",
                      );
                    }
                  },
                  onError: (err) =>
                    {
                    console.error("Recap PDF failed", err);
                    showAlert(
                      "We couldn't build the PDF. Please try again in a moment.",
                      "error",
                    );
                  },
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
              {isPdfRunning
                ? "Generating…"
                : existingPdfUrl
                  ? "⬇ Download PDF"
                  : "⬇ PDF"}
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
            {!isClient && fileCategoryTenantId !== "0" ? (
              <AskAiButton
                tenantId={String(fileCategoryTenantId)}
                scope="recap"
                recapId={String(recap.id)}
                subjectLabel={recap.name ?? undefined}
              />
            ) : null}
            {isClient && (
              <button
                onClick={openShare}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                ↗ Share
              </button>
            )}
            {!isClient && (
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
            )}
            {!isClient && (
              <PushToPlanButton
                recapId={recap.id}
                kind="legacy"
                recapName={recap.name}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {!isClient && (
        <Suspense fallback={null}>
          <RecapReviewChecks
            recapId={recap.id}
            isCustom={false}
            conversion={{
              requestType: null,
              recapType: recapTypeForRow(recap.recapType, null),
              engagements: recap.totalEngagements,
              consumersSampled: null,
              productsSold: recap.productsSold,
            }}
          />
        </Suspense>
      )}

      <RecapDetailChrome>
        <RecapDetailTabs
          value={detailTab}
          onChange={setDetailTab}
          photoCount={allFiles.length}
        />

        {kpiTiles.length > 0 ? (
          <RecapKpiStrip
            items={kpiTiles.map((t) => ({
              label: t.label,
              value: fmtNum(t.value),
              glow: t.glow,
              icon: t.icon,
            }))}
          />
        ) : null}
      </RecapDetailChrome>

      <RecapDetailPanel active={isRecapBodyTab(detailTab)}>
      {/* Quality check — server-computed review aid for the approver. Legacy
          recap → isCustom={false}. Self-degrades to nothing on failure;
          wrapped in Suspense for the initial load. */}
      {!isClient && (
      <Suspense fallback={null}>
        <RecapQualityPanel recapId={recap.id} isCustom={false} />
      </Suspense>
      )}
      {!isClient && <RecapPhotoReusePanel recapId={recap.id} isCustom={false} />}
      {isClient && (
        <RecapClientSignoff
          existingStatus={recap.clientSignoffStatus}
          existingComment={recap.clientSignoffComment}
          existingAt={recap.clientSignoffAt}
          busy={isSigningOff}
          approved={recap.approved}
          onApprove={() => setApproved(true)}
          approving={isApproving || approvePhase !== "idle"}
          onSubmit={(status, comment) => {
            commitSignoff({
              variables: { input: { recapId: recap.id, status, comment } },
              onCompleted: (res) => {
                if (res.submitRecapClientSignoff?.success) {
                  showAlert("Sign-off saved.", "success");
                } else {
                  showAlert(
                    res.submitRecapClientSignoff?.message ?? "Couldn't save sign-off.",
                    "error",
                  );
                }
              },
              onError: (err) => showAlert(err.message, "error"),
            });
          }}
        />
      )}
      </RecapDetailPanel>

      <RecapDetailPanel active={isRecapBodyTab(detailTab) || editingNumbers}>
      {/* Products sampled — read view (everyone). Hidden while the admin is
          editing, since the editor panel below shows the same data. */}
      {!editingNumbers &&
        (recap.productSamples ?? []).filter(Boolean).length > 0 && (
          <div className="spark-card p-6">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--recap-heading, #3f5c12)" }}
            >
              Products sampled
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(recap.productSamples ?? [])
                .filter((s): s is NonNullable<typeof s> => Boolean(s))
                .map((s) => (
                  <span key={s.id} className="recap-choice-chip">
                    {s.product?.name
                      ? `${formatRecapProductName(s.product.name)}${
                          s.quantity != null
                            ? ` · ${s.quantity.toLocaleString()}`
                            : ""
                        }`
                      : "Product"}
                  </span>
                ))}
            </div>
          </div>
        )}

      {/* Admin number editor panel */}
      {isAdmin && editingNumbers && (
        <div
          className="spark-card p-6"
          style={{ borderColor: "rgba(var(--spark-accent-rgb),0.3)" }}
        >
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
          >
            EDIT RECAP · ADMIN
          </p>
          <h3 className="display font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
            Edit recap details
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--recap-muted, #5c6154)" }}>
            Numbers, BA assignment, environment notes, and feedback all
            save together. Leave a field blank to clear it. Photos and
            sales-performance rows are preserved.
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
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  {f.label.toUpperCase()}
                </label>
                {f.key === "accountSpendAmount" ? (
                  <SpendAmountInput
                    value={draft.accountSpendAmount ?? ""}
                    onChange={(v) => handleNumberChange(f.key, v)}
                    inputClassName="w-full rounded-lg px-3 py-2 text-[15px]"
                    inputStyle={{
                      background: "var(--spark-bg)",
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                    }}
                    ariaLabel={f.label}
                    hint={false}
                  />
                ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => handleNumberChange(f.key, e.target.value)}
                  title={
                    f.key === "productsSold"
                      ? "Auto-fills from Cans + Packs until you edit it"
                      : undefined
                  }
                  className="w-full rounded-lg px-3 py-2 text-[15px]"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
                )}
              </div>
            ))}
          </div>
          <p
            className="mono text-[10px] mt-2"
            style={{ color: "var(--recap-muted, #5c6154)" }}
          >
            * Products sold auto-fills from Cans + Packs. Type a value to
            override.
          </p>

          {/* Products sampled editor — pick from the client's catalog +
              units, or add a new product inline. Tenant-scoped, suspends on
              its own products query. */}
          {recap.event?.tenantId ? (
            <Suspense
              fallback={
                <p
                  className="text-xs mt-5"
                  style={{ color: "var(--recap-faint, #7a7f70)" }}
                >
                  Loading products…
                </p>
              }
            >
              <ProductSampleEditor
                tenantId={String(recap.event.tenantId)}
                rows={sampleRows}
                onChange={setSampleRows}
              />
            </Suspense>
          ) : null}

          {/* BA assignment. Nevena: "I cant add BA for that recap
              anywhere." Shows the current BA and lets the admin search +
              reassign. Saved together with the numbers on Save changes. */}
          <div className="mt-5">
            <label
              className="mono text-[10px] block mb-1"
              style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
            >
              ASSIGNED BA
            </label>
            <p className="text-sm mb-2" style={{ color: "var(--recap-muted, #5c6154)" }}>
              {pickedBa ? (
                <>
                  <span style={{ color: "var(--spark-lime)" }}>
                    {pickedBa.name}
                  </span>
                  {pickedBa.id.startsWith(EXTERNAL_BA_ID_PREFIX) && (
                    <span
                      className="mono text-[10px] ml-2 px-1.5 py-0.5 rounded"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--recap-muted, #5c6154)",
                        background: "rgba(20, 22, 15, 0.06)",
                        border: "1px solid var(--recap-border, #e2e4d8)",
                      }}
                    >
                      EXTERNAL
                    </span>
                  )}{" "}
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
              ) : recap.externalBaName ? (
                <>
                  {recap.externalBaName}
                  <span
                    className="mono text-[10px] ml-2 px-1.5 py-0.5 rounded"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--recap-muted, #5c6154)",
                      background: "rgba(20, 22, 15, 0.06)",
                      border: "1px solid var(--recap-border, #e2e4d8)",
                    }}
                  >
                    EXTERNAL
                  </span>
                </>
              ) : (
                <span style={{ color: "var(--recap-muted, #5c6154)" }}>
                  No BA assigned yet
                </span>
              )}
            </p>
            <Suspense
              fallback={
                <div
                  className="mono text-[10px] py-2"
                  style={{ color: "var(--recap-muted, #5c6154)" }}
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

          {/* ─── Text fields: feedback, environment, account notes ───
              Kyle hit a reconciliation gap where the editor only let him
              fix numbers + BA. Everything below is the rest of the
              recap's editable text — saved on the same "Save changes"
              click. Trimmed empty strings clear the underlying field.
          */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--spark-border)" }}>
            <p
              className="mono text-[10px] mb-3"
              style={{ letterSpacing: "0.16em", color: "var(--recap-muted, #5c6154)" }}
            >
              FEEDBACK &amp; NOTES
            </p>

            {/* Recap-level: traffic + competitive presence (single line each) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  TRAFFIC DESCRIPTION
                </label>
                <input
                  value={draft.trafficDescription ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, trafficDescription: e.target.value }))
                  }
                  placeholder="e.g. Steady afternoon, busy after 5pm"
                  className="w-full rounded-lg px-3 py-2 text-[15px]"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
              </div>
              <div>
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  COMPETITIVE PRESENCE
                </label>
                <input
                  value={draft.competitivePresence ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, competitivePresence: e.target.value }))
                  }
                  placeholder="e.g. White Claw was sampling next aisle"
                  className="w-full rounded-lg px-3 py-2 text-[15px]"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
              </div>
            </div>

            {/* Consumer feedback group */}
            <p
              className="mono text-[10px] mt-5 mb-2"
              style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
            >
              CONSUMER FEEDBACK
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "cfFeedback", label: "GENERAL FEEDBACK", placeholder: "What did consumers say overall?" },
                { key: "cfQuotes", label: "QUOTES", placeholder: "Verbatim quotes from consumers" },
                { key: "cfPositiveStories", label: "POSITIVE STORIES", placeholder: "Standout reactions, conversions" },
                { key: "cfReasonsToDecline", label: "REASONS TO DECLINE", placeholder: "Why consumers passed" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label
                    className="mono text-[10px] block mb-1"
                    style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                  >
                    {label}
                  </label>
                  <textarea
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                    style={{
                      background: "var(--spark-bg)",
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                      resize: "vertical",
                    }}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  DEMOGRAPHICS
                </label>
                <textarea
                  value={draft.cfDemographics ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, cfDemographics: e.target.value }))
                  }
                  placeholder="Age range, gender mix, vibe, etc."
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            {/* Account feedback group */}
            <p
              className="mono text-[10px] mt-5 mb-2"
              style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
            >
              ACCOUNT FEEDBACK
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  ACCOUNT FEEDBACK
                </label>
                <textarea
                  value={draft.afFeedback ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, afFeedback: e.target.value }))
                  }
                  placeholder="Store/account manager comments"
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    resize: "vertical",
                  }}
                />
              </div>
              <div>
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  THINGS TO DO DIFFERENTLY
                </label>
                <textarea
                  value={draft.afDoDifferently ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, afDoDifferently: e.target.value }))
                  }
                  placeholder="Improvement notes for next time"
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    resize: "vertical",
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label
                  className="mono text-[10px] block mb-1"
                  style={{ letterSpacing: "0.14em", color: "var(--recap-muted, #5c6154)" }}
                >
                  CORPORATE CARD REFERENCE
                </label>
                <input
                  value={draft.afCorpoCard ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, afCorpoCard: e.target.value }))
                  }
                  placeholder="Last 4, identifier, or note"
                  className="w-full rounded-lg px-3 py-2 text-[15px]"
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                />
              </div>
            </div>
          </div>

          <input
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            maxLength={500}
            placeholder="Reason for edit (optional)"
            aria-label="Reason for edit"
            className="w-full rounded-lg px-3 py-2 text-[15px] mt-5"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveNumbers}
              disabled={isUpdating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
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

      {shareOpen && recap.shareToken && (
        <ShareRecapModal
          recapId={recap.id}
          kind="legacy"
          shareToken={recap.shareToken}
          recapName={recap.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {(recap.metricEdits?.length ?? 0) > 0 && (
        <RecapEditHistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          edits={recap.metricEdits ?? []}
        />
      )}

      </RecapDetailPanel>

      <RecapDetailPanel active={isRecapBodyTab(detailTab)}>
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
                color: "var(--recap-muted, #5c6154)",
              }}
            >
              FIELD-LOGGED · UNITS + DOLLARS
            </span>
          </div>
          {/* Only render metrics that actually have a value — a partial
              recap shows just the numbers it logged instead of "—" cards.
              The section header above is already gated on at least one of
              these being present. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {recap.totalCansSold != null && (
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
            )}
            {recap.totalPacksSold != null && (
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
            )}
            {typeof recap.totalEarnings === "number" && (
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
                  {`$${recap.totalEarnings.toLocaleString()}`}
                </p>
              </div>
            )}
            {typeof recap.accountSpendAmount === "number" && (
              <div>
                <p className="label-mini">ACCOUNT SPEND</p>
                <p
                  className="display tab-num font-bold mt-1"
                  style={{
                    fontSize: "1.75rem",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {`$${recap.accountSpendAmount.toLocaleString()}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      </RecapDetailPanel>

      <RecapDetailPanel active={isRecapBodyTab(detailTab)}>
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
                color: "var(--recap-muted, #5c6154)",
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
                  color: "var(--recap-text, #14160f)",
                  borderLeft: "2px solid rgba(var(--spark-accent-rgb),0.5)",
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  style={{ color: "var(--recap-text, #14160f)" }}
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
                  : "var(--recap-muted, #5c6154)",
              }}
            >
              CORPORATE CARD ·{" "}
              {accountFeedback.wasCorpoCardUsed ? "USED" : "NOT USED"}
            </p>
          )}
        </div>
      ) : null}

      </RecapDetailPanel>

      <RecapDetailPanel active={detailTab === "photos"}>
      {/* Upload zone — admin/BA can add photos + receipts on the fly */}
      <div
        className="spark-card p-6"
        style={{
          borderColor: "rgba(var(--spark-accent-rgb),0.25)",
          background:
            "linear-gradient(180deg, rgba(var(--spark-accent-rgb),0.04), transparent)",
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
              UPLOAD · TENANT PHOTO SECTIONS
            </p>
            <h3
              className="display font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              Add files to this recap
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              title="Section for new uploads"
              className="spark-input text-sm rounded-full"
            >
              {fileCategoryOptions.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
            </select>
            <RecapUploader
              recapUuid={uuid}
              category={
                isReceiptLikeCategory(uploadCategory) ? "receipt" : "photo"
              }
              label={`Upload · ${uploadCategory}`}
              onUploaded={(blobName) => {
                commitAddFile({
                  variables: {
                    input: {
                      recapId: recap.id,
                      file: blobName,
                      fileTypeId: "1",
                      fileRecapCategoryId: uploadCategory,
                    },
                  },
                  onCompleted: (res) => {
                    if (res.addRecapFile?.success) {
                      showAlert(`${uploadCategory} attached to recap.`, "success");
                      onRefresh();
                    } else {
                      showAlert(
                        res.addRecapFile?.message ?? "Couldn't attach file.",
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
          style={{ color: "var(--recap-muted, #5c6154)" }}
        >
          Pick a tenant photo section, then upload. Files go to GCS via
          signed URL and attach to this recap automatically — they appear
          in the Files grid below as soon as the upload completes.
        </p>
      </div>

      <div className="spark-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="display font-bold">Files · {allFiles.length}</h3>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--recap-muted, #5c6154)",
            }}
          >
            CLICK ANY TILE →
          </p>
        </div>
        {allFiles.length === 0 ? (
          <div className="spark-chart-empty min-h-[140px]">
            No files attached yet. Upload above to add photos or receipts.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {allFiles.slice(0, 36).map((p, i) => {
              const source = recapDisplayUrl(p?.displayUrl || p?.file);
              const kind = recapFileKind(source);
              const url = recapFileUrlFresh(source);
              const labelByKind: Record<typeof kind, string> = {
                image: "",
                heic: "HEIC",
                pdf: "PDF",
                video: "VIDEO",
                other: "FILE",
              };
              const fileId = p?.id ? String(p.id) : null;
              const fileLabel = (p?.file ?? "").split("/").pop() || "this file";
              const rawFile = p?.file ? String(p.file) : "";
              return (
                <a
                  key={p?.uuid ?? i}
                  href={kind === "video" ? undefined : url}
                  target={kind === "video" ? undefined : "_blank"}
                  rel={kind === "video" ? undefined : "noreferrer"}
                  onClick={
                    kind === "video"
                      ? (event) => {
                          event.preventDefault();
                          if (!rawFile) return;
                          setPlayingVideo({
                            playSrc: recapVideoPlayUrl(rawFile),
                            fileUrl: recapFileUrl(rawFile),
                            name: fileLabel,
                          });
                        }
                      : undefined
                  }
                  className="block aspect-square rounded-lg overflow-hidden relative group"
                  style={{
                    background: "rgba(20, 22, 15, 0.04)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
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
                      src={thumbUrl(url, 400) || url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const t = e.currentTarget as HTMLImageElement;
                        if (url && t.src !== url) {
                          t.src = url;
                          return;
                        }
                        t.outerHTML = `<div style="font:9px/12px monospace;color:#ef5a2a;padding:6px;word-break:break-all;background:rgba(239,90,42,0.08)">IMG FAILED<br/>${url}</div>`;
                      }}
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
                            color: "var(--recap-muted, #5c6154)",
                          }}
                        >
                          {kind === "video" ? "PLAY" : "OPEN →"}
                        </p>
                      </div>
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
        {allFiles.length > 36 ? (
          <p
            className="mt-3 mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--recap-muted, #5c6154)",
            }}
          >
            + {allFiles.length - 36} more files
          </p>
        ) : null}
      </div>
      </RecapDetailPanel>

      <RecapDetailPanel active={isRecapBodyTab(detailTab)}>
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
                style={{ color: "var(--recap-text, #14160f)" }}
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
                style={{ color: "var(--recap-text, #14160f)" }}
              >
                {recap.competitivePresence}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Two-col: SKU + Notes | Team */}
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
                            color: "var(--recap-muted, #5c6154)",
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

          {/* BA notes */}
          {notes ? (
            <div className="spark-card p-6">
              <h3 className="display font-bold mb-3">BA notes from the field</h3>
              <blockquote
                className="italic text-sm leading-relaxed pl-4"
                style={{
                  color: "var(--recap-text, #14160f)",
                  borderLeft: "2px solid rgba(var(--spark-accent-rgb),0.5)",
                }}
              >
                "{notes}"
              </blockquote>
              {ambassadors[0]?.user ? (
                <p
                  className="mono text-[10px] mt-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--recap-muted, #5c6154)",
                  }}
                >
                  — {ambassadors[0].user.firstName?.toUpperCase() ?? ""}{" "}
                  {ambassadors[0].user.lastName?.toUpperCase() ?? ""}
                </p>
              ) : recap.externalBaName ? (
                <p
                  className="mono text-[10px] mt-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--recap-muted, #5c6154)",
                  }}
                >
                  — {recap.externalBaName.toUpperCase()} (EXTERNAL)
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="spark-card p-5">
            <h3 className="font-bold mb-3">Team</h3>
            {ambassadors.length === 0 && recap.externalBaName ? (
              // External BA fallback — when the recap was attributed
              // to a worker who isn't in Spark yet (sub-contractor,
              // not-yet-onboarded BA), surface the typed name here so
              // the read-only view (and PDF) actually credit them
              // instead of saying "No team logged yet". No avatar,
              // no rating, no rate-control — they're not a real BA row.
              <div className="flex items-center gap-3">
                <span
                  className="spark-avatar"
                  style={{
                    width: 32,
                    height: 32,
                    fontSize: "0.75rem",
                    opacity: 0.55,
                  }}
                >
                  {initials(recap.externalBaName)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {recap.externalBaName}
                  </p>
                  <p
                    className="mono text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--recap-muted, #5c6154)",
                      background: "rgba(20, 22, 15, 0.06)",
                      border: "1px solid var(--recap-border, #e2e4d8)",
                    }}
                  >
                    EXTERNAL · NOT IN SPARK
                  </p>
                </div>
              </div>
            ) : ambassadors.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: "var(--recap-muted, #5c6154)" }}
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
                          style={{ color: "var(--recap-muted, #5c6154)" }}
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
                            color: "var(--recap-faint, #7a7f70)",
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
      </RecapDetailPanel>
      </div>
      </RecapDocument>

      {/* Ops-only sticky Approve / Share / Edit / Archive / Delete — single
          predictable action surface while scrolling photo-first content.
          Not mounted for clients or /r/:token. */}
      {!isClient && (
        <RecapStickyOpsBar
          queueNav={
            queueInfo
              ? {
                  index: queueInfo.index,
                  total: queueInfo.total,
                  prevHref: queueInfo.prev?.href ?? null,
                  nextHref: queueInfo.next?.href ?? null,
                  pending: queueNavPending,
                  onNavigate: goToQueueRecap,
                  onApproveNext:
                    !recap.approved &&
                    !recap.archivedAt &&
                    queueInfo.nextUnapproved
                      ? () => setApproved(true, true)
                      : null,
                }
              : null
          }
        >
          <button
            type="button"
            onClick={openShare}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ↗ Share
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() =>
                editingNumbers ? setEditingNumbers(false) : startEditNumbers()
              }
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: editingNumbers
                  ? "var(--spark-lime)"
                  : "transparent",
                color: editingNumbers ? "var(--spark-on-accent)" : "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
              title="Edit the recap's numbers (products sold, cans, packs, engagements, spend)"
            >
              {editingNumbers ? "✕ Close editor" : "✎ Edit recap"}
            </button>
          )}
          {isAdmin &&
            (recap.archivedAt ? (
              <button
                type="button"
                onClick={unarchiveRecap}
                disabled={isUnarchiving}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  opacity: isUnarchiving ? 0.5 : 1,
                }}
                title="Restore this recap to Needs review"
              >
                {isUnarchiving ? "Restoring…" : "Unarchive"}
              </button>
            ) : (
              <button
                type="button"
                onClick={archiveRecap}
                disabled={isArchiving}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "transparent",
                  color: "rgba(var(--spark-ink-rgb),0.7)",
                  border: "1px solid var(--spark-border)",
                  opacity: isArchiving ? 0.5 : 1,
                }}
                title="Park this recap — keep proof, hide from client"
              >
                {isArchiving ? "Archiving…" : "Archive"}
              </button>
            ))}
          {isAdmin && (
            <button
              type="button"
              onClick={deleteRecap}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-orange)",
                border: "1px solid rgba(239,90,42,0.4)",
                opacity: isDeleting ? 0.5 : 1,
              }}
              title="Delete this recap and free the event for a new one"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          )}
          {isAdmin &&
            (recap.approved ? (
              <button
                type="button"
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
              <>
                <ActionMorphButton
                  onClick={() => setApproved(true, false)}
                  disabled={isApproving || Boolean(recap.archivedAt)}
                  phase={approvePhase}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={
                    queueInfo?.nextUnapproved
                      ? {
                          background: "transparent",
                          color: "var(--spark-lime)",
                          border: "1px solid rgba(var(--spark-accent-rgb),0.45)",
                          opacity: isApproving ? 0.5 : 1,
                        }
                      : {
                          background: "var(--spark-lime)",
                          color: "var(--spark-on-accent)",
                          opacity: isApproving ? 0.5 : 1,
                        }
                  }
                  title={
                    recap.archivedAt
                      ? "Unarchive before approving"
                      : "Approve this recap and return to list"
                  }
                  pendingLabel="Approving…"
                  successLabel="Approved"
                >
                  Approve recap
                </ActionMorphButton>
                {queueInfo?.nextUnapproved && !recap.archivedAt && (
                  <ActionMorphButton
                    onClick={() => setApproved(true, true)}
                    disabled={isApproving}
                    phase={approvePhase}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{
                      background: "var(--spark-lime)",
                      color: "var(--spark-on-accent)",
                      opacity: isApproving ? 0.5 : 1,
                    }}
                    title="Approve this recap and advance to the next unapproved recap in the queue (a)"
                    pendingLabel="Approving…"
                    successLabel="Approved →"
                  >
                    Approve & next →
                  </ActionMorphButton>
                )}
              </>
            ))}
        </RecapStickyOpsBar>
      )}
      {playingVideo ? (
        <RecapVideoPlayer
          src={playingVideo.playSrc}
          fileUrl={playingVideo.fileUrl}
          name={playingVideo.name}
          onClose={() => setPlayingVideo(null)}
        />
      ) : null}
    </div>
  );
};

/* ─────────────────── page ─────────────────── */

/**
 * Custom-recap fallback for the legacy detail route. The default
 * /recap/view/:uuid route renders SparkRecapInner, which queries the LEGACY
 * `recap` only. A custom-template recap (separate model) returns null there,
 * so an admin opening one via a legacy link saw "Recap not found." (Myriant
 * on an LD custom recap). Probe `customRecap(uuid)`: if it exists, redirect
 * to the dedicated custom view (which renders the template fields, photos,
 * approve, etc.); otherwise it's a genuine miss. `replace` so Back doesn't
 * bounce between the two routes.
 */
const CustomRecapFallback: React.FC<{ uuid: string }> = ({ uuid }) => {
  const data = useLazyLoadQuery<CustomRecapsQueryExistsQueryType>(
    CustomRecapExistsQuery,
    { uuid },
    { fetchPolicy: "store-or-network" },
  );
  if (data?.customRecap) {
    return <Navigate to={`/recap/view-custom/${uuid}`} replace />;
  }
  return (
    <div
      className="spark-card p-8 text-center text-sm"
      style={{ color: "var(--recap-muted, #5c6154)" }}
    >
      Recap not found.
    </div>
  );
};

export default function SparkRecapView() {
  const { uuid } = useParams<{ uuid: string }>();
  // Keep refreshKey above Suspense so a suspending refetch can't remount
  // the inner tree and reset the key back to 0 (stale store).
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <Layout>
      <Suspense fallback={<RecapDetailSkeleton />}>
        <SparkRecapInner
          uuid={uuid ?? ""}
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      </Suspense>
    </Layout>
  );
}
