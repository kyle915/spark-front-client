import Layout from "@/layout/Layout";
import AskAiButton from "@/components/ai/AskAiButton";
import { GetCustomRecapQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQueryDetailsQuery as CustomRecapsQueryDetailsQueryType } from "@/api/queries/__generated__/CustomRecapsQueryDetailsQuery.graphql";
import { FileRecapCategoriesQuery } from "@/api/queries/FileRecapCategoriesQuery";
import type { FileRecapCategoriesQuery as FileRecapCategoriesQueryType } from "@/api/queries/__generated__/FileRecapCategoriesQuery.graphql";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@/api/queries/__generated__/ProductsQuery.graphql";
import { UpdateCustomRecapMutation } from "@/api/mutations/UpdateCustomRecapMutation";
import type { UpdateCustomRecapMutation as UpdateCustomRecapMutationType } from "@/api/mutations/__generated__/UpdateCustomRecapMutation.graphql";
import { ApproveCustomRecapMutation } from "@/api/mutations/ApproveCustomRecapMutation";
import type { ApproveCustomRecapMutation as ApproveCustomRecapMutationType } from "@/api/mutations/__generated__/ApproveCustomRecapMutation.graphql";
import { ArchiveCustomRecapMutation } from "@/api/mutations/ArchiveCustomRecapMutation";
import type { ArchiveCustomRecapMutation as ArchiveCustomRecapMutationType } from "@/api/mutations/__generated__/ArchiveCustomRecapMutation.graphql";
import { UnarchiveCustomRecapMutation } from "@/api/mutations/UnarchiveCustomRecapMutation";
import type { UnarchiveCustomRecapMutation as UnarchiveCustomRecapMutationType } from "@/api/mutations/__generated__/UnarchiveCustomRecapMutation.graphql";
import { AddCustomRecapFileMutation } from "@/api/mutations/AddCustomRecapFileMutation";
import type { AddCustomRecapFileMutation as AddCustomRecapFileMutationType } from "@/api/mutations/__generated__/AddCustomRecapFileMutation.graphql";
import { DeleteCustomRecapMutation } from "@/api/mutations/DeleteCustomRecapMutation";
import type { DeleteCustomRecapMutation as DeleteCustomRecapMutationType } from "@/api/mutations/__generated__/DeleteCustomRecapMutation.graphql";
import { DeleteCustomRecapFileMutation } from "@/api/mutations/DeleteCustomRecapFileMutation";
import type { DeleteCustomRecapFileMutation as DeleteCustomRecapFileMutationType } from "@/api/mutations/__generated__/DeleteCustomRecapFileMutation.graphql";
import { SetCustomRecapFileCategoryMutation } from "@/api/mutations/SetCustomRecapFileCategoryMutation";
import type { SetCustomRecapFileCategoryMutation as SetCustomRecapFileCategoryMutationType } from "@/api/mutations/__generated__/SetCustomRecapFileCategoryMutation.graphql";
import { GenerateCustomRecapPdfMutation } from "@/api/mutations/GenerateCustomRecapPdfMutation";
import type { GenerateCustomRecapPdfMutation as GenerateCustomRecapPdfMutationType } from "@/api/mutations/__generated__/GenerateCustomRecapPdfMutation.graphql";
import { RecapUploader } from "./RecapUploader";
import { RecapSourceBadge } from "./RecapSourceBadge";
import { coActivationLabel } from "./coActivationLabel";
import { ThirdPartyRecapBadge } from "./ThirdPartyRecapBadge";
import { ThirdPartyStoreMap } from "./ThirdPartyStoreMap";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AmbassadorPicker } from "./AmbassadorPicker";
import { RecapDetailSkeleton } from "@/layout/PageSkeletons";
import {
  buildCustomFieldValuesPayload,
  invalidNumberFieldEdit,
  totalEngagementsToSend,
} from "./customRecapSave";
import { editedNote } from "./recapEditHistory";
import { RecapEditHistorySheet } from "./RecapEditHistorySheet";
import {
  DropOffLocationsField,
  DropOffLocationsReadout,
} from "./DropOffLocationsField";
import {
  isDropOffLocationsField,
  locationHasPin,
  parseDropOffLocations,
  productSamplesFromDropOffs,
} from "./dropOffLocations";
import { sampleQtyLabels } from "./productsSampledQty";
import { SpendAmountInput } from "./SpendAmountInput";
import {
  isSpendAmountField,
  spendAmountStored,
  spendAmountSubmitError,
} from "./spendAmount";
import { useAuthStore } from "@/store/authStore";
import { useAdoptRecordTenant } from "@/hooks/useAdoptRecordTenant";
import { useLazyLoadQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import {
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  Suspense,
} from "react";
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
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { StatusMorph } from "@/motion/StatusMorph";
import {
  holdActionSuccess,
  recapReviewStatus,
  type ActionPhase,
} from "@/motion/opsMotion";
import { formatDate, parseLocaleNumber } from "@/utils";
import { formatInstantDate } from "@/utils/formatInstantDate";
import { recapApprovalMeta } from "@/recap/recapApprovalMeta";
import { thumbUrl } from "@/utils/thumb";
import {
  Calendar,
  Goal,
  MapPin,
  Package,
  ShoppingCart,
  Users,
  List,
  Image as ImageIcon,
  FolderOpen,
  FileText,
  Trash2,
  Video,
  X as XIcon,
} from "lucide-react";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { RecapVideoPlayer } from "@/shared/RecapVideoPlayer";
import { useAlertStore } from "@/store/alertStore";
import { recapDisplayUrl, recapFileUrl, recapGallerySlot, recapVideoPlayUrl } from "@/utils/recapFileUrl";
import { useRecapPageCrumb } from "@/layout/pageCrumb";
import ShareRecapModal from "@/recap/components/ShareRecapModal";
import RecapStickyOpsBar from "@/recap/RecapStickyOpsBar";
import useSparkRole from "@/hooks/useSparkRole";
import { RetailerSuggestion, tickedByDefault } from "./RetailerSuggestion";
import useBaLabel from "@/hooks/useBaLabel";
import { RecapClientSignoff } from "@/recap/RecapClientSignoff";
import { ClientTenantRecapBrand } from "@/recap/TenantBrandedRecap";
import { RecapDocument } from "@/recap/RecapDocument";
import { clientRecapKpis } from "@/recap/clientRecapKpis";
import {
  RecapChoiceChip,
  RecapFieldBlockLabel,
  RecapFieldRow,
  RecapFieldStack,
  RecapShareFieldSections,
} from "@/recap/RecapFieldRows";
import {
  formatRecapFieldLabel,
  formatRecapProductName,
  recapLabelsMatch,
} from "@/recap/recapFieldLabel";
import {
  buildFileRecapCategoryOptions,
  defaultUploadCategoryName,
  isReceiptLikeCategory,
  FALLBACK_FILE_CATEGORY_PHOTOS,
} from "@/recap/fileRecapCategoryOptions";
import {
  RecapDetailBackLink,
  RecapDetailChrome,
  RecapDetailPanel,
  RecapDetailTabs,
  RecapKpiStrip,
  isRecapBodyTab,
  type RecapDetailTab,
} from "@/recap/RecapDetailShell";
import { RecapClientSignoffMutation } from "@/api/mutations/RecapClientSignoffMutation";
import type { RecapClientSignoffMutation as RecapClientSignoffMutationType } from "@/api/mutations/__generated__/RecapClientSignoffMutation.graphql";
import PushToPlanButton from "@/field/PushToPlanButton";
import { recapTypeForRow } from "@/lib/activationBucket";
import { RecapPhotoReusePanel } from "./RecapPhotoReusePanel";
import { RecapBestPhotosPanel } from "./RecapBestPhotosPanel";

const RecapQualityPanel = lazy(() => import("./RecapQualityPanel"));
const RecapReviewChecks = lazy(() => import("./RecapReviewChecks"));
const RecapPhotoTrust = lazy(() => import("./RecapPhotoTrust"));

// Custom-field type → control kind. Field-type names are lowercase by
// convention (text / number / image / longtext / select / multiselect);
// match case-insensitively and treat anything unknown as text. Mirrors
// SparkRecapCreate.fieldKind so the view and the create form agree on what
// an "image" / "choice" field is.
function customFieldKind(
  typeName: string | null | undefined,
): "image" | "select" | "multiselect" | "other" {
  const name = (typeName ?? "").toLowerCase();
  if (name.includes("image") || name.includes("photo") || name.includes("img"))
    return "image";
  if (name === "multiselect" || name.includes("multi")) return "multiselect";
  if (name === "select" || name.includes("dropdown")) return "select";
  return "other";
}

// A multiselect answer is persisted as a JSON array of the chosen option
// strings; a single-select answer is the plain option string. Parse either
// shape into a string[] for rendering (and tolerate a legacy plain string
// landing in a multiselect field).
function customFieldHasDisplayValue(
  field: {
    name?: string | null;
    value?: string | null;
    customFieldType?: { name?: string | null } | null;
  },
): boolean {
  if (isDropOffLocationsField(field)) {
    return parseDropOffLocations(field.value).some(
      (loc) => Boolean((loc.placeName ?? "").trim()) || locationHasPin(loc),
    );
  }
  const kind = customFieldKind(field.customFieldType?.name);
  const value = field.value ?? "";
  if (kind === "image") return Boolean(value);
  if (kind === "select" || kind === "multiselect") {
    return parseChoiceList(value).length > 0;
  }
  return Boolean(String(value).trim());
}

function parseChoiceList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    // not JSON — fall through and treat as a single plain value
  }
  return [value];
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};
const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
};
const dangerBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-orange)",
  border: "1px solid rgba(239,90,42,0.4)",
};
const muted: React.CSSProperties = { color: "var(--recap-muted, #5c6154)" };
const faint: React.CSSProperties = { color: "var(--recap-faint, #7a7f70)" };
const lime: React.CSSProperties = { color: "var(--recap-heading, #3f5c12)" };
const hairline: React.CSSProperties = {
  borderBottom: "1px solid var(--recap-border, var(--spark-border))",
};
const inset: React.CSSProperties = {
  border: "1px solid var(--recap-border, var(--spark-border))",
  background: "rgba(20, 22, 15, 0.03)",
};

const KpiCardContainer = ({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`spark-card p-6 ${className ?? ""}`}>
    <p
      className="text-sm font-semibold mb-4 flex items-center gap-2"
      style={{ color: "var(--recap-heading, #3f5c12)" }}
    >
      {icon}
      {formatRecapFieldLabel(title)}
    </p>
    {children}
  </div>
);

// const Gallery3DCard = ({
//   src,
//   alt,
//   debugName,
//   isLoading,
//   onClick,
// }: {
//   src: string;
//   alt: string;
//   debugName?: string;
//   isLoading?: boolean;
//   onClick?: () => void;
// }) => (
//   <div className="hover-3d cursor-pointer" onClick={onClick}>
//     <figure className="w-full aspect-4/3 overflow-hidden rounded-2xl bg-base-200">
//       {isLoading ? (
//         <div className="flex h-full w-full items-center justify-center bg-base-300/40">
//           <div className="flex flex-col items-center gap-3 text-base-content/60">
//             <span className="loading loading-spinner loading-md" />
//             <span className="text-sm">Loading image...</span>
//           </div>
//         </div>
//       ) : (
//         <img
//           src={src}
//           alt={alt}
//           className="w-full h-full object-contain"
//           onError={(event) => {
//             console.error("Gallery image failed to render", {
//               debugName,
//               src,
//               event,
//             });
//           }}
//         />
//       )}
//     </figure>
//     <div></div>
//     <div></div>
//     <div></div>
//     <div></div>
//     <div></div>
//     <div></div>
//     <div></div>
//     <div></div>
//   </div>
// );


const DropOffLocationsEditBridge = ({
  tenantId,
  value,
  onChange,
  required,
  label,
}: {
  tenantId: string | null;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  label: string;
}) => {
  const data = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  const products = useMemo(
    () =>
      (data.products?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((p) => ({
          id: String(p.id),
          name: p.name,
          category: p.productType?.name ?? null,
          imageUrl: p.image ?? null,
        })),
    [data],
  );
  return (
    <DropOffLocationsField
      label={label}
      required={required}
      value={value}
      onChange={onChange}
      products={products}
      theme="ops"
      accent="var(--spark-lime)"
    />
  );
};

// Edit-mode editor for "Products Sampled" units on the custom-recap view.
// Loads the recap tenant's product catalog (same ProductsQuery the create
// form's picker + the read-only Product Samples card use) and renders one
// numeric units-sampled input per SKU. The parent owns the quantities map
// (keyed by Product global id) and turns it into the productSamples payload
// on save. This is what lets an admin record sampled products + units on a
// Connecteam-imported recap — the import never creates sample rows, so the
// section was simply absent there before. Suspends on first open (the
// caller wraps it in <Suspense>).
const ProductSamplesEditor = ({
  tenantId,
  quantities,
  onChange,
}: {
  tenantId: string | null;
  quantities: Record<string, string>;
  onChange: (productId: string, v: string) => void;
}) => {
  const data = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  const products = useMemo(
    () =>
      (data.products?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );
  const totalUnits = useMemo(
    () =>
      products.reduce((sum, p) => {
        const n = parseLocaleNumber(quantities[String(p.id)] ?? "");
        return (
          sum + (n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : 0)
        );
      }, 0),
    [products, quantities],
  );

  if (products.length === 0) {
    return (
      <p className="text-sm" style={muted}>
        No products are set up for this client yet — add SKUs under Products
        to track units sampled.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const id = String(p.id);
          return (
            <div
              key={id}
              className="rounded-xl p-4 flex items-center gap-3"
              style={inset}
            >
              <div className="w-12 h-12 rounded-lg p-1 shrink-0 grid place-items-center overflow-hidden bg-white">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span
                    className="text-[9px] font-bold tracking-wider"
                    style={faint}
                  >
                    SKU
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate" title={p.name}>
                  {p.name}
                </p>
                {p.productType?.name && (
                  <p
                    className="text-[11px] uppercase tracking-wider mt-0.5 truncate"
                    style={muted}
                  >
                    {p.productType.name}
                  </p>
                )}
              </div>
              <input
                value={quantities[id] ?? ""}
                onChange={(e) => onChange(id, e.target.value)}
                inputMode="numeric"
                placeholder="0"
                aria-label={`Units sampled — ${p.name}`}
                className="spark-input w-20 text-right shrink-0 text-sm"
              />
            </div>
          );
        })}
      </div>
      <p className="mono text-[10px] mt-3" style={{ ...lime, letterSpacing: "0.14em" }}>
        {totalUnits} UNIT{totalUnits === 1 ? "" : "S"} SAMPLED
      </p>
    </>
  );
};

function RecapVideoThumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-1"
        style={{ color: "var(--spark-lime)" }}
      >
        <Video className="h-8 w-8" />
        <span className="text-[10px] font-black uppercase tracking-wider">
          Video
        </span>
      </div>
    );
  }
  return (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      className="pointer-events-none h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

const RecapCustomViewInner = ({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  // Brand clients see "First L." — never an ambassador's full name.
  const baLabel = useBaLabel();
  const environment = useRelayEnvironment();
  const [searchParams] = useSearchParams();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{
    playSrc: string;
    fileUrl: string;
    name: string;
  } | null>(null);
  // Id of the Evidences file currently being deleted, so only that card's
  // ×-button shows the in-flight state (the useMutation `isDeletingFile`
  // flag is global to the gallery).
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  // Section a new Evidences upload lands in. Send the category NAME so
  // it never collides with a real FileRecapCategory PK (LD "Table Set
  // Up" is PK 2). "" = Uncategorized.
  const [uploadCategory, setUploadCategory] = useState(
    FALLBACK_FILE_CATEGORY_PHOTOS,
  );

  // A Connecteam import routes here with ?needPhotos=1 when the PDF carried
  // no usable photos — so the admin lands directly in the photo-upload
  // workflow instead of discovering the gap later. We surface a prompt in
  // the Evidences section and scroll it into view. Dismissible per-view.
  const needPhotos = searchParams.get("needPhotos") === "1";

  useEffect(() => {
    if (!isClient) return;
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "spark-v2");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, [isClient]);
  const [photoPromptDismissed, setPhotoPromptDismissed] = useState(false);
  const showPhotoPrompt = needPhotos && !photoPromptDismissed;
  const evidenceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!needPhotos) return;
    // Defer past first paint so the Evidences section is mounted.
    const t = setTimeout(() => {
      evidenceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 400);
    return () => clearTimeout(t);
  }, [needPhotos]);

  const data = useLazyLoadQuery<CustomRecapsQueryDetailsQueryType>(
    GetCustomRecapQuery,
    { uuid: uuid ?? "" },
    {
      // First paint can use a warm store; bumping refreshKey after
      // approve/save forces a network refetch.
      fetchPolicy: refreshKey === 0 ? "store-or-network" : "network-only",
      fetchKey: refreshKey,
    },
  );

  const recap = data?.customRecap;
  // An emailed "Open recaps" link lands here with whatever client the
  // user last had selected. Move the switcher / topbar / sidebar counts to
  // the recap's own client (only if the user can switch to it).
  useAdoptRecordTenant(
    recap?.event?.tenant ?? recap?.customRecapTemplate?.tenant,
    "recap",
  );
  // Prefer the recap's own tenant over the auth-store dashboard tenant
  // (admins can be switched to another brand while viewing Torch).
  const fileCategoryTenantId =
    recap?.customRecapTemplate?.tenant?.id ?? "0";
  const categoriesData = useLazyLoadQuery<FileRecapCategoriesQueryType>(
    FileRecapCategoriesQuery,
    { filters: { tenantId: fileCategoryTenantId } },
    { fetchPolicy: "store-and-network" },
  );
  const fileCategoryOptions = useMemo(
    () =>
      buildFileRecapCategoryOptions(
        categoriesData.fileRecapCategories.edges.map((e) => e?.node),
      ),
    [categoriesData],
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
  const recapFiles = useMemo(() => recap?.customRecapFiles ?? [], [recap]);

  // ----- Field-level inline edit (admin) -----
  // Lets an admin click "Edit values" to turn every custom-field
  // value into an input, fix one or more, then save. The backend
  // updateCustomRecap mutation replaces the entire customFieldValues
  // set when provided — so we always send the FULL list (changed +
  // unchanged) to keep the others intact. Product samples and sales
  // performance are omitted from the input so the resolver leaves
  // them untouched.
  const showAlert = useAlertStore((s) => s.showAlert);
  const [isEditingValues, setIsEditingValues] = useState(false);
  // Working copy of customField values keyed by customField.id. Seeded
  // from the recap on enter-edit so the user starts with what's
  // already there.
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  // Working copy of the recap TITLE — editable inline in edit mode so an
  // admin can rename a recap (e.g. clear the generic "Imported from
  // Connecteam" default) without re-doing it. Seeded from recap.name.
  const [editedName, setEditedName] = useState("");
  // Working copy of per-SKU sampled units, keyed by Product global id.
  // Seeded from the recap's existing CustomRecapProductSample rows on
  // enter-edit; the Product Samples editor writes into it and saveValues
  // turns it into the productSamples payload. This is what lets an admin
  // mark which products were sampled + how many units on a Connecteam-
  // imported recap — imports never create sample rows, so the section was
  // simply absent before.
  const [editedSampleQtys, setEditedSampleQtys] = useState<
    Record<string, string>
  >({});
  // "Corporate Card Used" is a typed boolean on CustomRecap (not a custom
  // field), so it needs its own working-copy state to be editable.
  const [editedUsedCorpoCard, setEditedUsedCorpoCard] = useState(false);
  // "Total Engagements" is a typed int on CustomRecap. It previously had NO
  // editor here, so every edit-values save omitted it and the backend nulled
  // the saved number (that's why a manually-entered total vanished after a
  // later edit/approve). Now editable; raw string for a controlled input,
  // coerced to int on save and ALWAYS sent so an unrelated edit can't drop it.
  const [editedTotalEngagements, setEditedTotalEngagements] = useState("");
  const [engagementsTouched, setEngagementsTouched] = useState(false);
  // Optional note stored on the edit-history rows for this save.
  const [editReason, setEditReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  // ----- Ambassador / "filling for BA" inline edit -----
  // Mirrors SparkRecapCreate's filling-for flow. editedAmbassadorId holds
  // the picked/inline-created Ambassador's Relay global id (sent as
  // ambassadorId); editedAmbassadorName is its display label for the
  // picker chip; editedExternalBaName is the free-text write-in;
  // editedFillingForAmbassador is the typed boolean. All seeded from the
  // recap on enter-edit.
  const [editedAmbassadorId, setEditedAmbassadorId] = useState("");
  const [editedAmbassadorName, setEditedAmbassadorName] = useState("");
  const [editedExternalBaName, setEditedExternalBaName] = useState("");
  const [editedFillingForAmbassador, setEditedFillingForAmbassador] =
    useState(false);
  // The recap's own tenant scopes the BA roster picker and product catalog
  // so an admin switched to another brand still edits this brand's SKUs.
  const dashboardTenantId = useAuthStore((s) => s.tenantId);
  const tenantId =
    fileCategoryTenantId !== "0" ? fileCategoryTenantId : dashboardTenantId;
  const [commitUpdateCustomRecap, isSavingValues] =
    useMutation<UpdateCustomRecapMutationType>(UpdateCustomRecapMutation);
  const [commitGeneratePdf, isGeneratingPdf] =
    useMutation<GenerateCustomRecapPdfMutationType>(
      GenerateCustomRecapPdfMutation,
    );
  const [commitApprove, isApproving] =
    useMutation<ApproveCustomRecapMutationType>(ApproveCustomRecapMutation);
  const [approvePhase, setApprovePhase] = useState<ActionPhase>("idle");
  const [commitArchive, isArchiving] =
    useMutation<ArchiveCustomRecapMutationType>(ArchiveCustomRecapMutation);
  const [commitUnarchive, isUnarchiving] =
    useMutation<UnarchiveCustomRecapMutationType>(UnarchiveCustomRecapMutation);
  const [commitSignoff, isSigningOff] =
    useMutation<RecapClientSignoffMutationType>(RecapClientSignoffMutation);
  const [commitAddFile] = useMutation<AddCustomRecapFileMutationType>(
    AddCustomRecapFileMutation,
  );
  const [commitDelete, isDeleting] =
    useMutation<DeleteCustomRecapMutationType>(DeleteCustomRecapMutation);
  const [commitDeleteFile, isDeletingFile] =
    useMutation<DeleteCustomRecapFileMutationType>(
      DeleteCustomRecapFileMutation,
    );
  const [commitSetFileCategory, isSettingCategory] =
    useMutation<SetCustomRecapFileCategoryMutationType>(
      SetCustomRecapFileCategoryMutation,
    );

  const enterEditMode = useCallback(() => {
    const seed: Record<string, string> = {};
    (recap?.customField ?? []).forEach((field) => {
      if (!field) return;
      // customField.id is the template field id (stable). value may
      // be null if the BA didn't fill the field at submit time.
      seed[String(field.id)] = field.value ?? "";
    });
    setEditedValues(seed);
    setEditedName(recap?.name ?? "");
    // Seed sampled-units from existing samples (product global id → qty).
    const sampleSeed: Record<string, string> = {};
    (recap?.customRecapProductSample ?? []).forEach((s) => {
      if (s?.product?.id != null && s?.quantity != null) {
        sampleSeed[String(s.product.id)] = String(s.quantity);
      }
    });
    setEditedSampleQtys(sampleSeed);
    setEditedUsedCorpoCard(!!recap?.usedCorpoCard);
    setEditedTotalEngagements(
      recap?.totalEngagements != null ? String(recap.totalEngagements) : "",
    );
    setEngagementsTouched(false);
    setEditReason("");
    // Seed the ambassador controls from the recap. A linked Ambassador
    // (FK) seeds the picked id + display name; otherwise seed the
    // free-text write-in. fillingForAmbassador is the typed boolean.
    setEditedAmbassadorId(recap?.ambassador?.id ? String(recap.ambassador.id) : "");
    setEditedAmbassadorName(
      [recap?.ambassador?.user?.firstName, recap?.ambassador?.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
    );
    setEditedExternalBaName(recap?.externalBaName ?? "");
    setEditedFillingForAmbassador(!!recap?.fillingForAmbassador);
    setIsEditingValues(true);
  }, [
    recap?.customField,
    recap?.name,
    recap?.customRecapProductSample,
    recap?.usedCorpoCard,
    recap?.totalEngagements,
    recap?.ambassador?.id,
    recap?.ambassador?.user?.firstName,
    recap?.ambassador?.user?.lastName,
    recap?.externalBaName,
    recap?.fillingForAmbassador,
  ]);

  const exitEditMode = useCallback(() => {
    setIsEditingValues(false);
    setEditedValues({});
    setEditedName("");
    setEditedSampleQtys({});
    setEditedAmbassadorId("");
    setEditedAmbassadorName("");
    setEditedExternalBaName("");
    setEditedFillingForAmbassador(false);
    setEditReason("");
  }, []);

  // Template fields grouped by section. This is the canonical, COMPLETE
  // field list — the backend's customField resolver returns every field
  // on the template (each enriched with this recap's value, or null when
  // unfilled), so this covers blank fields too. Both the render below and
  // saveValues read from it, so what the admin edits is exactly what gets
  // saved (the dropped-image fix depends on these being the same source).
  const customFieldsBySection = useMemo(() => {
    if (!recap?.customField) return [];
    type CustomFieldItem = NonNullable<typeof recap.customField>[number];
    const sections = new Map<string, CustomFieldItem[]>();

    recap.customField.forEach((field) => {
      const sectionName = field.recapSection?.name ?? "Other Details";
      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }
      sections.get(sectionName)!.push(field);
    });

    return Array.from(sections.entries()).map(([name, fields]) => ({
      name,
      fields,
    }));
  }, [recap?.customField]);

  const saveValues = useCallback(() => {
    if (!recap?.id) return;
    const eventId = recap.event?.id;
    const templateId = recap.customRecapTemplate?.id;
    if (!eventId || !templateId) {
      showAlert(
        "Can't save: this recap is missing event or template links. Use Move to event first, or ping engineering.",
        "error",
      );
      return;
    }
    // Build the full customFieldValues list from the SAME complete field
    // list the render/edit controls use (every template field, grouped
    // into sections), NOT just the rows that already have a value. This
    // is the fix for the dropped-image bug: a previously-blank field
    // (image / text / number / longtext) is editable in the UI, but if
    // we only walked rows that already existed we'd never include the
    // newly-set value and the backend would drop it. Walking the full
    // template list guarantees a blank-then-filled field is sent.
    //
    // For fields that already have a CustomFieldValue row we pass its
    // customFieldValueId so the backend updates in place; for fields with
    // no row yet we send customFieldValueId: null so the backend upserts
    // (creates) one — update_custom_recap takes the create path when the
    // value id is null and customFieldId is provided. The value is read
    // from the working-copy map (seeded from the recap on enter-edit, so
    // it's always present), falling back to the stored value.
    const allFields = customFieldsBySection.flatMap(
      (section) => section.fields,
    );
    const badNumber = invalidNumberFieldEdit(allFields, editedValues);
    if (badNumber) {
      showAlert(
        `${badNumber.name}: "${badNumber.value}" isn't a number. Enter 0 or more.`,
        "warning",
      );
      return;
    }
    const spendValues = { ...editedValues };
    for (const field of allFields) {
      if (
        !field ||
        !isSpendAmountField({
          name: field.name,
          type: field.customFieldType?.name,
        })
      ) {
        continue;
      }
      const fieldId = String(field.id);
      const raw = spendValues[fieldId] ?? field.value ?? "";
      const spendErr = spendAmountSubmitError(raw, field.value);
      if (spendErr) {
        showAlert(`${field.name}: ${spendErr}`, "warning");
        return;
      }
      const stored = spendAmountStored(raw);
      if (stored != null) spendValues[fieldId] = stored;
    }
    const customFieldValues = buildCustomFieldValuesPayload(
      allFields,
      spendValues,
    );

    // Ambassador to persist: prefer the picked / inline-created BA's id;
    // otherwise fall back to the free-text write-in. UpdateCustomRecapInput
    // accepts both (a resolved ambassador FK wins over a write-in
    // server-side; passing null for both clears the link).
    const ambassadorId = editedAmbassadorId || null;
    const externalBaName = ambassadorId
      ? null
      : editedExternalBaName.trim() || null;

    // Sampled products → one ProductSampleInput per SKU with a positive
    // quantity. Seeded from the recap's current samples on enter-edit so an
    // untouched save round-trips; the resolver replaces the whole set when
    // productSamples is provided (delete-then-recreate). A current sample
    // whose product isn't on the editor's page still survives — its seeded
    // qty stays in editedSampleQtys and is re-sent here.
    const fromDropOffs = (() => {
      const totals = new Map<string, number>();
      for (const field of allFields) {
        if (!isDropOffLocationsField(field)) continue;
        const fieldId = String(field.id);
        const raw = editedValues[fieldId] ?? field.value ?? "";
        for (const row of productSamplesFromDropOffs(
          parseDropOffLocations(raw),
        )) {
          totals.set(
            row.productId,
            (totals.get(row.productId) ?? 0) + row.quantity,
          );
        }
      }
      return [...totals.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    })();
    const fromEditor = Object.entries(editedSampleQtys)
      .map(([productId, raw]) => {
        const n = parseLocaleNumber(raw ?? "");
        return n != null && Number.isFinite(n) && Math.round(n) > 0
          ? { productId, quantity: Math.round(n) }
          : null;
      })
      .filter(
        (s): s is { productId: string; quantity: number } => s !== null,
      );
    // Drop-off Locations own SKU+cases for Product Seeding; otherwise keep
    // the Product Samples editor map.
    const productSamples =
      fromDropOffs.length > 0 ? fromDropOffs : fromEditor;

    // Never persist a blank title — fall back to the existing name.
    const nextName = editedName.trim() || recap.name || "Recap";

    commitUpdateCustomRecap({
      variables: {
        input: {
          id: recap.id as string,
          name: nextName,
          eventId: eventId as string,
          customRecapTemplateId: templateId as string,
          customFieldValues,
          // Full sampled-products set — the resolver replaces all existing
          // CustomRecapProductSample rows with this list (delete-recreate).
          productSamples,
          // Typed boolean on CustomRecap — now editable from the view.
          usedCorpoCard: editedUsedCorpoCard,
          totalEngagements: totalEngagementsToSend({
            edited: editedTotalEngagements,
            touched: engagementsTouched,
            storedTotal: recap.totalEngagements,
            storedConsumersSampled: recap.consumersSampled,
          }),
          editReason: editReason.trim() || null,
          // Adding/clearing the BA on an existing recap. A resolved
          // ambassador FK wins over any write-in server-side; passing null
          // for both clears the link.
          ambassadorId,
          externalBaName,
          fillingForAmbassador: editedFillingForAmbassador,
        },
      },
      // Insights, the Recaps list strip, Master Tracker etc. read
      // store-or-network; mark everything stale so they refetch the
      // corrected aggregates on next visit instead of painting old totals.
      updater: (store, res) => {
        if (res?.updateCustomRecap?.success) store.invalidateStore();
      },
      onCompleted: (res) => {
        const payload = res.updateCustomRecap;
        if (payload?.success) {
          showAlert(
            "Recap saved. Insights, Recaps and client views now use these values.",
            "success",
          );
          exitEditMode();
          // Mutation selection updates the store; network-only refetch is
          // the safety net so every editable field (title, Metrics, custom
          // fields, samples, BA) paints from the saved DB row.
          onRefresh();
        } else {
          showAlert(payload?.message ?? "Save failed.", "error");
        }
      },
      onError: (err) =>
        showAlert(`Save failed: ${err.message}`, "error"),
    });
  }, [
    recap?.id,
    recap?.name,
    recap?.event?.id,
    recap?.customRecapTemplate?.id,
    recap?.totalEngagements,
    recap?.consumersSampled,
    customFieldsBySection,
    editedValues,
    editedName,
    editedSampleQtys,
    editedUsedCorpoCard,
    editedTotalEngagements,
    engagementsTouched,
    editReason,
    editedAmbassadorId,
    editedExternalBaName,
    editedFillingForAmbassador,
    commitUpdateCustomRecap,
    showAlert,
    exitEditMode,
    onRefresh,
  ]);

  // Generate (or regenerate) the recap PDF, then open the returned file in
  // a new tab. Mirrors the legacy SparkRecapView PDF button. CustomRecapFile
  // exposes url / displayUrl (no `file` field), so we open url ?? displayUrl.
  const existingPdf = useMemo(() => {
    return (recap?.customRecapFiles ?? []).find((f) => {
      const name = (f?.name ?? "").toLowerCase();
      const typeName = (f?.fileType?.name ?? "").toLowerCase();
      const url = (f?.url || f?.displayUrl || "").toLowerCase();
      if (name.includes("connecteam source")) return false;
      return (
        typeName === "pdf" ||
        name.endsWith(".pdf") ||
        name.includes(" recap.pdf") ||
        url.split("?")[0]?.endsWith(".pdf")
      );
    });
  }, [recap?.customRecapFiles]);
  const existingPdfUrl =
    existingPdf?.url || existingPdf?.displayUrl || "";

  // Always generate-on-demand. Backend reuses a Spark PDF only when the
  // GCS blob still exists and matches the approval badge; otherwise it
  // rebuilds. Opening a cached displayUrl alone used to NoSuchKey when
  // the object had been deleted after the DB row was written.
  const handleGeneratePdf = useCallback(() => {
    if (!recap?.id) return;
    commitGeneratePdf({
      variables: { input: { id: recap.id as string } },
      onCompleted: (res) => {
        const payload = res.generateCustomRecapPdf;
        if (payload?.success) {
          const fileUrl =
            payload.customRecapFile?.url ??
            payload.customRecapFile?.displayUrl ??
            "";
          if (fileUrl) {
            window.open(fileUrl, "_blank", "noopener,noreferrer");
            showAlert(
              existingPdfUrl ? "PDF ready." : "PDF generated.",
              "success",
            );
          } else {
            showAlert("PDF generated, but no file URL was returned.", "warning");
          }
        } else {
          showAlert(payload?.message ?? "PDF generation failed.", "error");
        }
      },
      onError: (err) => {
        console.error("Recap PDF failed", err);
        showAlert(
          "We couldn't build the PDF. Please try again in a moment.",
          "error",
        );
      },
    });
  }, [recap?.id, existingPdfUrl, commitGeneratePdf, showAlert]);

  const queueInfo = useMemo(() => getRecapQueueNeighbors(uuid), [uuid]);
  const [queueNavPending, startQueueNav] = useTransition();
  const goToQueueRecap = useCallback(
    (href: string) => {
      startQueueNav(() => {
        navigate(href);
      });
    },
    [navigate],
  );
  useEffect(() => {
    markRecapOpenedInQueue(uuid);
    prefetchRecapDetails(environment, recapQueueWarmTargets(uuid));
  }, [uuid, environment]);

  // Approve the custom recap → backend emails the requestor + mapped RMM
  // (with the PDF). Then return to the list with a forced network refetch
  // so Needs review drops the row (connection cache stays stale otherwise),
  // or advance to the next unapproved recap in the review queue.
  // Spark's suggested store, when the event has none. null = follow the
  // default for this suggestion (ticked unless it is only a guess).
  const retailerProposal = recap?.retailerProposal ?? null;
  const [acceptStoreChoice, setAcceptStoreChoice] = useState<boolean | null>(null);
  const acceptStoreOnApprove = retailerProposal
    ? (acceptStoreChoice ?? tickedByDefault(retailerProposal))
    : false;

  const handleApprove = useCallback(
    (advanceToNext = false) => {
      if (!recap?.id || approvePhase !== "idle") return;
      setApprovePhase("pending");
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
        variables: {
          input: {
            id: recap.id as string,
            approved: true,
            acceptRetailerProposal: acceptStoreOnApprove || null,
          },
        },
        onCompleted: (res) => {
          const payload = res.approveCustomRecap;
          if (payload?.success) {
            markRecapReviewedInQueue(uuid, { approved: true });
            void refreshSidebarCounts(environment, tenantId);
            showAlert(
              "Recap approved — the requestor and mapped RMM have been emailed.",
              "success",
            );
            setApprovePhase("success");
            void holdActionSuccess(nextItemHref ? 180 : undefined).then(() => {
              markRecapsListNeedsRefresh();
              if (nextItemHref) {
                goToQueueRecap(nextItemHref);
                return;
              }
              navigate(
                recapsListHrefFromReturn({
                  searchParams,
                  fallbackStatus: "approved",
                }),
                { state: recapsListNavState(true) },
              );
            });
          } else {
            setApprovePhase("idle");
            showAlert(payload?.message ?? "Approve failed.", "error");
          }
        },
        onError: (err) => {
          setApprovePhase("idle");
          showAlert(`Approve failed: ${err.message}`, "error");
        },
      });
    },
    [
      recap?.id,
      commitApprove,
      showAlert,
      approvePhase,
      acceptStoreOnApprove,
      goToQueueRecap,
      navigate,
      searchParams,
      queueInfo?.nextUnapproved,
      uuid,
      environment,
      tenantId,
    ],
  );

  const handleArchive = useCallback(() => {
    if (!recap?.id || isArchiving || isUnarchiving) return;
    commitArchive({
      variables: { input: { id: recap.id as string, reason: null } },
      onCompleted: (res) => {
        if (res.archiveCustomRecap?.success) {
          markRecapReviewedInQueue(uuid, { archived: true });
          void refreshSidebarCounts(environment, tenantId);
          showAlert(
            "Recap archived — kept as proof, hidden from client.",
            "success",
          );
          onRefresh();
        } else {
          showAlert(
            res.archiveCustomRecap?.message ?? "Couldn't archive.",
            "warning",
          );
        }
      },
      onError: (err) =>
        showAlert(`Archive failed: ${err.message}`, "error"),
    });
  }, [
    recap?.id,
    commitArchive,
    showAlert,
    onRefresh,
    isArchiving,
    isUnarchiving,
    uuid,
    environment,
    tenantId,
  ]);

  const handleUnarchive = useCallback(() => {
    if (!recap?.id || isArchiving || isUnarchiving) return;
    commitUnarchive({
      variables: { input: { id: recap.id as string } },
      onCompleted: (res) => {
        if (res.unarchiveCustomRecap?.success) {
          markRecapReviewedInQueue(uuid, { archived: false });
          void refreshSidebarCounts(environment, tenantId);
          showAlert("Recap restored to Needs review.", "success");
          onRefresh();
        } else {
          showAlert(
            res.unarchiveCustomRecap?.message ?? "Couldn't unarchive.",
            "warning",
          );
        }
      },
      onError: (err) =>
        showAlert(`Unarchive failed: ${err.message}`, "error"),
    });
  }, [
    recap?.id,
    commitUnarchive,
    showAlert,
    onRefresh,
    isArchiving,
    isUnarchiving,
    uuid,
    environment,
    tenantId,
  ]);

  // Attach an uploaded blob to this custom recap. RecapUploader fires
  // this once per selected file; addCustomRecapFile returns the FULL
  // customRecapFiles list, so Relay merges it into the store by recap id
  // and the Evidence grid re-renders with the new photo immediately — no
  // page reload (mirrors the legacy addRecapFile photo flow).
  const handlePhotoUploaded = useCallback(
    (blobName: string) => {
      if (!recap?.id) return;
      commitAddFile({
        variables: {
          input: {
            customRecapId: recap.id as string,
            file: blobName,
            fileRecapCategoryId: uploadCategory || null,
          },
        },
        onCompleted: (res) => {
          const payload = res.addCustomRecapFile;
          if (!payload?.success) {
            showAlert(payload?.message ?? "Couldn't attach photo.", "error");
          }
        },
        onError: (err) =>
          showAlert(`Couldn't attach photo: ${err.message}`, "error"),
      });
    },
    [recap?.id, commitAddFile, showAlert, uploadCategory],
  );

  // Delete a single file from the Evidences & Attachments gallery (e.g. a
  // misfiled receipt that landed under "Table setup"). Confirms first,
  // then calls deleteCustomRecapFile — which hard-deletes the
  // CustomRecapFile row (leaving the GCS blob) and returns the FULL
  // refreshed customRecapFiles list, so Relay merges it by recap id and
  // the gallery re-renders without the removed file (no reload). Admin-
  // only + tenant-scoped server-side.
  const handleDeleteFile = useCallback(
    (fileId: string, fileName: string | null | undefined) => {
      const ok = window.confirm(
        `Remove "${fileName || "this file"}" from this recap? ` +
          "It will no longer appear in the Evidences gallery. " +
          "This cannot be undone.",
      );
      if (!ok) return;
      setDeletingFileId(fileId);
      commitDeleteFile({
        variables: { input: { id: fileId } },
        onCompleted: (res) => {
          setDeletingFileId(null);
          const payload = res.deleteCustomRecapFile;
          if (payload?.success) {
            showAlert("File removed.", "success");
            // Force a refetch so the removed file disappears from the
            // gallery immediately — without this the card lingers until a
            // manual reload (same refreshKey pattern the approve flow uses).
            onRefresh();
          } else {
            showAlert(payload?.message ?? "Couldn't remove file.", "error");
          }
        },
        onError: (err) => {
          setDeletingFileId(null);
          showAlert(`Couldn't remove file: ${err.message}`, "error");
        },
      });
    },
    [commitDeleteFile, showAlert],
  );

  // Move a file into a different section (FileRecapCategory) so receipts
  // don't clump in with the sampling photos. Send the category NAME (not
  // "1"/"2") so a real PK never wins. "" → null = Uncategorized.
  const handleSetFileCategory = useCallback(
    (fileId: string, sentinel: string) => {
      commitSetFileCategory({
        variables: {
          input: { id: fileId, fileRecapCategoryId: sentinel || null },
        },
        onCompleted: (res) => {
          const payload = res.setCustomRecapFileCategory;
          if (payload?.success) {
            showAlert("File moved.", "success");
            onRefresh();
          } else {
            showAlert(payload?.message ?? "Couldn't move file.", "error");
          }
        },
        onError: (err) =>
          showAlert(`Couldn't move file: ${err.message}`, "error"),
      });
    },
    [commitSetFileCategory, showAlert],
  );

  // Delete this custom recap (admin-only on the backend; tenant-scoped).
  // Confirms first, then navigates back to the recaps list on success —
  // freeing the event for a fresh recap. window.confirm keeps this a
  // one-file change; the recaps list refetches on mount (store-or-network)
  // so the deleted row is gone when we land there.
  const backToListUrl = useMemo(
    () =>
      recapsListHrefFromReturn({
        searchParams,
        // Deep links / Jump-to without fromStatus: land on the tab that
        // matches this recap instead of always Needs review.
        fallbackStatus: recap?.approved ? "approved" : "needs_review",
      }),
    [searchParams, recap?.approved],
  );

  const handleDelete = useCallback(() => {
    if (!recap?.id) return;
    const ok = window.confirm(
      "Delete this recap? This permanently removes it and frees the event " +
        "for a new recap. This cannot be undone.",
    );
    if (!ok) return;
    commitDelete({
      variables: { input: { id: recap.id as string } },
      onCompleted: (res) => {
        const payload = res.deleteCustomRecap;
        if (payload?.success) {
          markRecapReviewedInQueue(uuid, { removed: true });
          void refreshSidebarCounts(environment, tenantId);
          showAlert("Recap deleted.", "success");
          navigate(backToListUrl);
        } else {
          showAlert(payload?.message ?? "Delete failed.", "error");
        }
      },
      onError: (err) => showAlert(`Delete failed: ${err.message}`, "error"),
    });
  }, [recap?.id, commitDelete, showAlert, navigate, backToListUrl, uuid, environment, tenantId]);

  const gallerySlot = useCallback(
    (file: (typeof recapFiles)[number]) =>
      recapGallerySlot({
        url: file.url,
        displayUrl: file.displayUrl,
        fileTypeName: file.fileType?.name,
        categoryName: file.fileRecapCategory?.name,
      }),
    [],
  );

  const isPdfFile = useCallback(
    (file: (typeof recapFiles)[number]) => gallerySlot(file) === "pdf",
    [gallerySlot],
  );

  const isVideoFile = useCallback(
    (file: (typeof recapFiles)[number]) => gallerySlot(file) === "video",
    [gallerySlot],
  );

  // Prefer the backend `displayUrl` everywhere: for HEIC uploads it's the
  // server-converted .jpg sibling, so the gallery renders a plain <img>
  // with no in-browser HEIC decode / bucket-CORS dependency. Falls back to
  // `url` for older query results. Videos keep the original path — the
  // thumb endpoint 404s them, and <img> paints the alt text.
  const displaySrc = useCallback(
    (file: (typeof recapFiles)[number]) =>
      recapDisplayUrl(file.displayUrl || file.url || ""),
    [],
  );

  const videoSrc = useCallback(
    (file: (typeof recapFiles)[number]) =>
      recapFileUrl(file.url || file.displayUrl || ""),
    [],
  );

  const openVideo = useCallback((file: (typeof recapFiles)[number]) => {
    const fileUrl = recapFileUrl(file.url || file.displayUrl || "");
    if (!fileUrl) return;
    setPlayingVideo({
      playSrc: recapVideoPlayUrl(file.url || file.displayUrl || ""),
      fileUrl,
      name: file.name || "Video",
    });
  }, []);

  const isImageFile = useCallback(
    (file: (typeof recapFiles)[number]) => gallerySlot(file) === "image",
    [gallerySlot],
  );

  const categories = useMemo(() => {
    if (recapFiles.length === 0) return [];
    const categoryMap = new Map<
      string,
      { name: string; files: (typeof recapFiles)[number][] }
    >();

    recapFiles.forEach((file) => {
      const categoryName = file.fileRecapCategory?.name ?? "Uncategorized";
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { name: categoryName, files: [] });
      }
      categoryMap.get(categoryName)!.files.push(file);
    });

    return Array.from(categoryMap.values());
  }, [recapFiles]);

  const categoriesWithImages = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        imageFiles: category.files.filter(isImageFile),
        pdfFiles: category.files.filter(isPdfFile),
      })),
    [categories, isImageFile, isPdfFile],
  );

  const flatImages = useMemo(
    () => categoriesWithImages.flatMap((category) => category.imageFiles),
    [categoriesWithImages],
  );

  const flatVideos = useMemo(
    () => categories.flatMap((category) => category.files.filter(isVideoFile)),
    [categories, isVideoFile],
  );

  const firstEmptyImageFieldId = useMemo(() => {
    for (const section of customFieldsBySection) {
      for (const field of section.fields) {
        if (customFieldKind(field.customFieldType?.name) !== "image") continue;
        const val = field.value ?? "";
        if (!val) return String(field.id);
      }
    }
    return null;
  }, [customFieldsBySection]);

  // Download every photo in this recap as a ZIP (mirrors the legacy
  // SparkRecapView "Download photos" button). Uses displaySrc so HEIC
  // uploads come down as their server-converted JPG (viewable anywhere),
  // not an unopenable .heic.
  const [isZipping, setIsZipping] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<RecapDetailTab>("overview");
  const handleDownloadPhotos = useCallback(async () => {
    if (flatImages.length === 0) {
      showAlert("No photos to download.", "warning");
      return;
    }
    setIsZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      // Cap at 200 for sanity; larger sets can be mass-exported backend-side.
      let added = 0;
      for (const f of flatImages.slice(0, 200)) {
        const src = displaySrc(f);
        if (!src) continue;
        try {
          const resp = await fetch(src);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const base = src.split("?")[0]?.split("/").pop() || `photo-${added}`;
          const filename = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.jpg`;
          zip.file(filename, blob);
          added += 1;
        } catch {
          /* skip individual failures */
        }
      }
      if (added === 0) {
        showAlert("No downloadable photos.", "warning");
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
      a.download = `recap-${(uuid ?? "").slice(-6) || "photos"}-photos.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      showAlert(
        `Downloaded ${added} photo${added === 1 ? "" : "s"}.`,
        "success",
      );
    } catch (e) {
      showAlert(`Download failed: ${(e as Error).message}`, "error");
    } finally {
      setIsZipping(false);
    }
  }, [flatImages, displaySrc, showAlert, uuid]);

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  // Keyboard (Esc / ← / → / zoom) lives on PhotoLightbox.

  const currentPreview =
    flatImages && previewIndex !== null ? flatImages[previewIndex] : null;
  const currentPreviewSrc = currentPreview ? displaySrc(currentPreview) : "";

  const qtyLabels = useMemo(
    () => sampleQtyLabels(recap?.customRecapTemplate?.layout),
    [recap?.customRecapTemplate?.layout],
  );
  const unitsSampled = useMemo(
    () =>
      (recap?.customRecapProductSample ?? []).reduce(
        (sum, s) => sum + (s.quantity ?? 0),
        0,
      ),
    [recap?.customRecapProductSample],
  );
  const reviewKpis = useMemo(
    () =>
      clientRecapKpis({
        engagements: recap?.totalEngagements,
        consumersSampled: recap?.consumersSampled,
        soldUnits: recap?.soldUnits,
        unitsSampled,
        photoCount: flatImages.length,
        activationType: recap?.customRecapTemplate?.name ?? null,
        isDryDemo: recap?.isDryDemo,
        peopleEngaged: recap?.peopleEngaged,
        unitsSampledLabel: qtyLabels.total || undefined,
      }),
    [
      recap?.totalEngagements,
      recap?.consumersSampled,
      recap?.isDryDemo,
      recap?.peopleEngaged,
      recap?.soldUnits,
      unitsSampled,
      flatImages.length,
      recap?.customRecapTemplate?.name,
      qtyLabels.total,
    ],
  );

  const lastEditedNote = useMemo(
    () => editedNote(recap?.metricEdits),
    [recap?.metricEdits],
  );

  const crumbTitle = useMemo(() => {
    if (!recap) return null;
    const venue =
      recap.name ||
      recap.eventRetailer ||
      recap.retailer?.name ||
      recap.eventVenue ||
      "Recap";
    const date = formatDate(recap.event?.date ?? recap.eventDate ?? null);
    return date && date !== "—" && date !== "-" ? `${venue} · ${date}` : venue;
  }, [recap]);
  useRecapPageCrumb(crumbTitle);

  if (!recap) {
    return (
      <div
        className="spark-card p-8 text-sm"
        style={{ color: "rgba(var(--spark-ink-rgb),0.7)" }}
      >
        Recap not found.
      </div>
    );
  }

  const statusLabel = recapReviewStatus(Boolean(recap.approved));
  const place = [
    recap.eventRetailer ?? recap.retailer?.name,
    recap.eventVenue ?? recap.location?.name,
    recap.eventCity,
    recap.eventState ?? recap.state?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const openShare = useCallback(() => {
    if (!recap.shareToken) {
      showAlert("Share link isn't ready yet.", "warning");
      return;
    }
    setShareOpen(true);
  }, [recap.shareToken, showAlert]);

  const videoModal = playingVideo ? (
    <RecapVideoPlayer
      src={playingVideo.playSrc}
      fileUrl={playingVideo.fileUrl}
      name={playingVideo.name}
      onClose={() => setPlayingVideo(null)}
    />
  ) : null;

  const inner = (
    <>
      <div className="space-y-6 max-w-7xl recap-sticky-ops-pad recap-min-type">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <RecapDetailBackLink to={backToListUrl}>
              ← Recaps
              {recap.name ? ` / ${recap.name}` : ""}
              {place ? ` / ${place}` : ""}
              {` / ${formatDate(recap.event?.date ?? recap.eventDate ?? null)}`}
            </RecapDetailBackLink>
            {/* Edit-values toolbar. Toggles every custom-field value
                in the sections below into an editable input, with
                Save / Cancel pair here at the top. Re-renders the
                view in read mode after a successful save (relay store
                updated from the mutation's selection set). */}
            {!isEditingValues ? (
              <div className="flex items-center gap-2 flex-wrap">
                {!isClient && tenantId ? (
                  <AskAiButton
                    tenantId={tenantId}
                    variant="ghost"
                    scope="recap"
                    recapId={String(recap.id)}
                    subjectLabel={recap.name ?? undefined}
                  />
                ) : null}
                {recap.approved ? (
                  <>
                    <span className="chip chip-lime">
                      <StatusMorph value="Approved" />
                    </span>
                    {approvalMeta ? (
                      <span
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.1em",
                          color: "rgba(var(--spark-ink-rgb),0.55)",
                        }}
                      >
                        {approvalMeta}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="chip chip-orange">
                    <StatusMorph value="Needs review" />
                  </span>
                )}
                {recap.archivedAt ? (
                  <span className="chip chip-orange">
                    <StatusMorph value="Archived" />
                  </span>
                ) : null}
                <button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                  style={{ ...ghostBtn, opacity: isGeneratingPdf ? 0.5 : 1 }}
                  title={
                    existingPdfUrl
                      ? "Download the ready PDF (regenerates if missing)"
                      : "Generate and download this recap as a PDF"
                  }
                >
                  {isGeneratingPdf
                    ? "Generating…"
                    : existingPdfUrl
                      ? "⬇ Download PDF"
                      : "⬇ PDF"}
                </button>
                {!isClient && (
                <button
                  onClick={handleDownloadPhotos}
                  disabled={isZipping || flatImages.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                  style={{
                    ...ghostBtn,
                    opacity: isZipping || flatImages.length === 0 ? 0.5 : 1,
                  }}
                  title="Download all photos in this recap as a ZIP"
                >
                  {isZipping
                    ? `Zipping ${flatImages.length}…`
                    : `⬇ Photos (${flatImages.length})`}
                </button>
                )}
                {isClient && (
                  <button
                    onClick={openShare}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                    style={ghostBtn}
                  >
                    ↗ Share
                  </button>
                )}
                {!isClient && (
                  <PushToPlanButton
                    recapId={recap.id}
                    kind="custom"
                    recapName={recap.name}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                    style={ghostBtn}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for edit (optional)"
                  aria-label="Reason for edit"
                  maxLength={500}
                  className="spark-input text-sm w-64"
                />
                <button
                  onClick={exitEditMode}
                  disabled={isSavingValues}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                  style={ghostBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={saveValues}
                  disabled={isSavingValues}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                  style={{ ...limeBtn, opacity: isSavingValues ? 0.5 : 1 }}
                >
                  {isSavingValues ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          {isClient && recap.approved ? (
            <Suspense fallback={null}>
              <RecapPhotoTrust recapId={recap.id} isCustom={true} />
            </Suspense>
          ) : null}

          {!isClient && (
            <Suspense fallback={null}>
              <RecapReviewChecks
                recapId={recap.id}
                isCustom={true}
                conversion={{
                  requestType: null,
                  recapType: recapTypeForRow(
                    recap.recapType,
                    recap.customRecapTemplate?.name,
                  ),
                  engagements: recap.totalEngagements,
                  consumersSampled: recap.consumersSampled,
                  productsSold: recap.soldUnits,
                  isDryDemo: recap.isDryDemo,
                  peopleEngaged: recap.peopleEngaged,
                }}
              />
            </Suspense>
          )}

          <RecapDocument status={recap.approved ? "APPROVED" : "DRAFT"}>
          <div className="space-y-6">
          <div className="spark-card p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className={`chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
                  >
                    <StatusMorph value={statusLabel} />
                  </span>
                  {recap.customRecapTemplate?.name && (
                    <span
                      className="chip recap-program-chip is-selected"
                      aria-current="true"
                    >
                      {recap.customRecapTemplate.name}
                    </span>
                  )}
                  {recap.late && <span className="chip chip-orange">LATE</span>}
                  {recap.incomplete && (
                    <span className="chip chip-orange">INCOMPLETE</span>
                  )}
                  {recap.isThirdParty ? <ThirdPartyRecapBadge notInTotals={recap.excludeFromAggregates} /> : null}
                  <RecapSourceBadge label={recap.sourceLabel} />
                  <RecapSourceBadge label={coActivationLabel(recap.coActivation?.brandNames)} />
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
                {isEditingValues ? (
                  <input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Recap title"
                    aria-label="Recap title"
                    className="spark-input w-full max-w-xl text-2xl font-bold"
                  />
                ) : (
                  <h1
                    className="display text-3xl font-bold"
                    style={{ letterSpacing: "-0.03em" }}
                  >
                    {recap.name}
                  </h1>
                )}
                <p className="mt-1 recap-doc-kicker">
                  Field recap
                  {" · "}
                  {place || "—"}
                  {" · "}
                  {formatDate(recap.event?.date ?? recap.eventDate ?? null)}
                </p>
              </div>
            </div>
          </div>

          {/* Photos first: the recap leads with what the activation looked
              like. Up to five photos; any tile opens the full-size viewer,
              the last one jumps to the Photos tab when there are more. */}
          {!isEditingValues && flatImages.length > 0 ? (
            <div
              className="grid gap-2"
              data-no-print=""
              style={{
                // 1 photo: full width. 2: side by side. 3: one large + two
                // stacked. 4+: one large + a 2×2 block (the 4th spans the
                // bottom row when there are exactly four).
                gridTemplateColumns:
                  flatImages.length === 1
                    ? "1fr"
                    : flatImages.length === 2
                      ? "repeat(2, minmax(0, 1fr))"
                      : flatImages.length === 3
                        ? "repeat(3, minmax(0, 1fr))"
                        : "repeat(4, minmax(0, 1fr))",
                gridAutoRows:
                  flatImages.length <= 2
                    ? "minmax(220px, 42vh)"
                    : "minmax(110px, 19vh)",
              }}
            >
              {flatImages.slice(0, 5).map((file, i) => {
                const src = displaySrc(file);
                const more = i === 4 ? flatImages.length - 5 : 0;
                const lead = i === 0 && flatImages.length > 2;
                const wide = flatImages.length === 4 && i === 3;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() =>
                      more > 0 ? setDetailTab("photos") : setPreviewIndex(i)
                    }
                    aria-label={
                      more > 0
                        ? `See all ${flatImages.length} photos`
                        : `Open photo ${i + 1} of ${flatImages.length}`
                    }
                    className="relative overflow-hidden rounded-xl"
                    style={{
                      gridColumn: lead || wide ? "span 2" : undefined,
                      gridRow: lead ? "span 2" : undefined,
                      background: "rgba(20, 22, 15, 0.06)",
                      padding: 0,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={thumbUrl(src, 800) || src}
                      alt=""
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        const img = event.currentTarget;
                        if (src && img.src !== src) img.src = src;
                      }}
                    />
                    {more > 0 ? (
                      <span
                        className="absolute inset-0 grid place-items-center text-base font-semibold"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                      >
                        +{more} more
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <RecapDetailChrome>
            <RecapDetailTabs
              value={detailTab}
              onChange={setDetailTab}
              photoCount={flatImages.length}
            />

            {!isEditingValues && (
              <RecapKpiStrip
                items={[
                  {
                    label: "Engagements",
                    value:
                      typeof recap.totalEngagements === "number"
                        ? recap.totalEngagements.toLocaleString()
                        : "—",
                    glow: true,
                  },
                  ...(recap.customRecapProductSample &&
                  recap.customRecapProductSample.length > 0
                    ? [
                        {
                          label: qtyLabels.total || "Units sampled",
                          value: recap.customRecapProductSample
                            .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
                            .toLocaleString(),
                        },
                      ]
                    : []),
                  {
                    label: "Photos",
                    value: String(flatImages.length),
                  },
                ]}
              />
            )}
          </RecapDetailChrome>

          <RecapDetailPanel
            active={isRecapBodyTab(detailTab) || isEditingValues}
          >
          {/* ======================================================
          QUALITY CHECK — server-computed review aid for the approver.
          Custom recap → isCustom={true}. Self-degrades to nothing on
          failure; wrapped in Suspense for the initial load.
          ====================================================== */}
          {!isClient && (
          <Suspense fallback={null}>
            <RecapQualityPanel recapId={recap.id} isCustom={true} />
          </Suspense>
          )}
          {!isClient && <RecapPhotoReusePanel recapId={recap.id} isCustom />}
          {/* Which photos lead client-facing views. Staff only (the server
              refuses anyone else); approved recaps are the ones scored. */}
          {!isClient && <RecapBestPhotosPanel recapId={recap.id} />}

          {!isClient && retailerProposal && !recap.isThirdParty ? (
            <RetailerSuggestion
              key={retailerProposal.id}
              recapId={recap.id}
              proposal={retailerProposal}
              acceptOnApprove={acceptStoreOnApprove}
              onAcceptOnApproveChange={setAcceptStoreChoice}
              approved={Boolean(recap.approved)}
            />
          ) : null}

          {!isClient && recap.isThirdParty ? (
            <Suspense fallback={null}>
              <ThirdPartyStoreMap
                recapId={recap.id}
                typedName={recap.typedStoreName || recap.eventRetailer || ""}
                typedAddress={recap.typedStoreAddress || recap.eventAddress || ""}
                status={recap.storeMappingStatus || ""}
                suggestions={recap.storeSuggestions}
                mappedRetailerName={recap.retailer?.name ?? null}
              />
            </Suspense>
          ) : null}
          {/* ======================================================
          KPI GRID + FIELD BODY (full Overview read)
          ====================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <KpiCardContainer
              title="Information"
              icon={<Users className="w-3.5 h-3.5" style={lime} />}
            >
              <div className="space-y-4">
                {/* Ambassador editor (edit mode) — reuses the same
                    AmbassadorPicker the create form uses: pick a roster BA,
                    write in an external name, or inline-create a new BA.
                    Seeded from the recap on enter-edit; the picked id is
                    saved as ambassadorId in saveValues. */}
                {isEditingValues ? (
                  <div className="space-y-3 rounded-xl p-3" style={inset}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editedFillingForAmbassador}
                        onChange={(e) => {
                          setEditedFillingForAmbassador(e.target.checked);
                          // Toggling off clears any half-picked selection so
                          // the save doesn't carry a stale BA.
                          if (!e.target.checked) {
                            setEditedAmbassadorId("");
                            setEditedAmbassadorName("");
                            setEditedExternalBaName("");
                          }
                        }}
                      />
                      <span className="text-sm font-medium">
                        Ambassador / Filling for BA
                      </span>
                    </label>
                    {editedFillingForAmbassador && (
                      /* Local boundary so a picker query error (a permission/
                         network hiccup loading the roster) shows a contained
                         message instead of unmounting the whole edit form and
                         losing the admin's in-progress edits. The route also
                         has a boundary; this keeps the rest of the edit
                         intact. */
                      <ErrorBoundary>
                        <Suspense
                        fallback={
                          <div className="text-sm" style={muted}>
                            Loading ambassadors…
                          </div>
                        }
                      >
                        <AmbassadorPicker
                          tenantId={tenantId || null}
                          selectedId={editedAmbassadorId}
                          selectedName={editedAmbassadorName}
                          externalName={editedExternalBaName}
                          onSelect={(id, name) => {
                            setEditedAmbassadorId(id);
                            setEditedAmbassadorName(name);
                            setEditedExternalBaName("");
                          }}
                          onUseExternal={(name) => {
                            setEditedExternalBaName(name);
                            setEditedAmbassadorId("");
                            setEditedAmbassadorName("");
                          }}
                          onClear={() => {
                            setEditedAmbassadorId("");
                            setEditedAmbassadorName("");
                            setEditedExternalBaName("");
                          }}
                        />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </div>
                ) : (
                <div className="flex items-center gap-3">
                  {/* Ambassador if linked, else the free-text external BA
                      name (sub-contractor / not-yet-onboarded worker). A
                      linked Ambassador always wins (set server-side), so we
                      only fall back to externalBaName when there's no FK. */}
                  {recap.ambassador ? (
                    <>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-medium uppercase"
                        style={inset}
                      >
                        {recap.ambassador?.user?.firstName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {baLabel(
                            [
                              recap.ambassador?.user?.firstName,
                              recap.ambassador?.user?.lastName,
                            ]
                              .filter(Boolean)
                              .join(" "),
                          )}
                        </p>
                        <p className="text-sm" style={muted}>
                          {recap.isThirdParty
                            ? "3rd-party agency"
                            : "Ambassador"}
                        </p>
                      </div>
                    </>
                  ) : recap.externalBaName ? (
                    <>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-medium uppercase"
                        style={inset}
                      >
                        {recap.externalBaName[0]}
                      </div>
                      <div>
                        <p className="font-medium">{baLabel(recap.externalBaName)}</p>
                        <p className="text-sm" style={muted}>
                          {recap.isThirdParty
                            ? "3rd-party agency"
                            : "Ambassador (external)"}
                        </p>
                      </div>
                    </>
                  ) : isEditingValues ? (
                    <>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-medium uppercase"
                        style={inset}
                      >
                        —
                      </div>
                      <div>
                        <p className="font-medium">—</p>
                        <p className="text-sm" style={muted}>
                          Ambassador
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
                )}
                {(
                  [
                    ["Job", recap.job?.name],
                    ["Retailer", recap.eventRetailer ?? recap.retailer?.name],
                    ["Venue", recap.eventVenue],
                    ["Address", recap.eventAddress],
                    [
                      "City / State",
                      recap.eventCity || recap.eventState
                        ? [recap.eventCity, recap.eventState]
                            .filter(Boolean)
                            .join(", ")
                        : "",
                    ],
                    [
                      "Event Date",
                      formatDate(recap.eventDate ?? recap.event?.date ?? null),
                    ],
                    [
                      "Submitted At",
                      // An instant, not a calendar day: convert, don't slice.
                      formatInstantDate(recap.submittedAt ?? recap.createdAt ?? null),
                    ],
                  ] as [string, string | null | undefined][]
                )
                  .filter(([, value]) => isEditingValues || Boolean(value && value !== "—"))
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center py-2"
                      style={hairline}
                    >
                      <span className="text-sm" style={muted}>
                        {label === "Address" ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 opacity-60" />
                            Address
                          </span>
                        ) : label === "Event Date" ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 opacity-60" />
                            Event Date
                          </span>
                        ) : (
                          label
                        )}
                      </span>
                      <span className="font-medium text-right">
                        {value || "—"}
                      </span>
                    </div>
                  ))}
              </div>
            </KpiCardContainer>

            <KpiCardContainer
              title="Metrics"
              icon={<Goal className="w-3.5 h-3.5" style={lime} />}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center rounded-lg p-3" style={inset}>
                  <span className="text-sm">Total Engagements</span>
                  {isEditingValues ? (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="spark-input w-24 text-right text-sm"
                      value={editedTotalEngagements}
                      onChange={(e) => {
                        setEditedTotalEngagements(e.target.value);
                        setEngagementsTouched(true);
                      }}
                      aria-label="Total engagements"
                    />
                  ) : (
                    <span className="text-xl font-bold" style={lime}>
                      {recap.totalEngagements ?? "—"}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={inset}>
                  <span className="text-sm">Corporate Card Used</span>
                  {isEditingValues ? (
                    <input
                      type="checkbox"
                      checked={editedUsedCorpoCard}
                      onChange={(e) => setEditedUsedCorpoCard(e.target.checked)}
                      aria-label="Corporate card used"
                    />
                  ) : (
                    <span
                      className={`chip ${recap.usedCorpoCard ? "chip-lime" : "chip-muted"}`}
                    >
                      {recap.usedCorpoCard ? "Yes" : "No"}
                    </span>
                  )}
                </div>
                {/* Read-only mirror of the typed boolean. In edit mode the
                    Ambassador / Filling-for editor in the Information card
                    owns this, so we hide the stale badge to avoid showing two
                    competing values. */}
                {!isEditingValues && (
                  <div className="flex justify-between items-center p-3 rounded-lg" style={inset}>
                    <span className="text-sm">Filling for Ambassador</span>
                    <span
                      className={`chip ${recap.fillingForAmbassador ? "chip-lime" : "chip-muted"}`}
                    >
                      {recap.fillingForAmbassador ? "Yes" : "No"}
                    </span>
                  </div>
                )}
              </div>
            </KpiCardContainer>

            {recap.customRecapSalePerformance &&
              recap.customRecapSalePerformance.length > 0 && (
                <KpiCardContainer
                  title="Sales Performance"
                  className="md:col-span-2"
                  icon={<ShoppingCart className="w-3.5 h-3.5" style={lime} />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recap.customRecapSalePerformance.map((sale) => (
                      <div
                        key={sale.id}
                        className="rounded-xl p-4 space-y-2"
                        style={inset}
                      >
                        <div className="flex items-center gap-3">
                          {sale.product?.image && (
                            <div className="w-12 h-12 bg-white rounded-lg p-1">
                              <img
                                src={sale.product.image}
                                alt={sale.product.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <p className="font-semibold">
                            {formatRecapProductName(sale.product?.name ?? "—")}
                          </p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={muted}>
                            Type: {sale.typeOfGood?.name ?? "—"}
                          </span>
                          <span className="font-bold" style={lime}>
                            ${sale.price?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </KpiCardContainer>
              )}

            {isEditingValues ? (
              <KpiCardContainer
                title="Product Samples"
                className="md:col-span-2"
                icon={<Package className="w-3.5 h-3.5" style={lime} />}
              >
                <p className="text-sm mb-3" style={muted}>
                  Mark which products were sampled and how many units went
                  out. Leave a product at 0 if none did. Saved when you hit
                  “Save changes”.
                </p>
                <Suspense
                  fallback={
                    <p className="text-sm italic" style={faint}>
                      Loading products…
                    </p>
                  }
                >
                  <ProductSamplesEditor
                    tenantId={tenantId}
                    quantities={editedSampleQtys}
                    onChange={(productId, v) =>
                      setEditedSampleQtys((prev) => ({
                        ...prev,
                        [productId]: v,
                      }))
                    }
                  />
                </Suspense>
              </KpiCardContainer>
            ) : (
              recap.customRecapProductSample &&
              recap.customRecapProductSample.length > 0 && (
                <KpiCardContainer
                  title="Product Samples"
                  className="md:col-span-2"
                  icon={<Package className="w-3.5 h-3.5" style={lime} />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recap.customRecapProductSample.map((sample) => (
                      <div
                        key={sample.id}
                        className="rounded-xl p-4 space-y-2"
                        style={inset}
                      >
                        <div className="flex items-center gap-3">
                          {sample.product?.image && (
                            <div className="w-12 h-12 bg-white rounded-lg p-1">
                              <img
                                src={sample.product.image}
                                alt={sample.product.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <p className="font-semibold">
                            {formatRecapProductName(sample.product?.name ?? "—")}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2">
                          <span style={muted}>
                            {qtyLabels.perSku || "Quantity Distributed"}
                          </span>
                          <span className="mono" style={lime}>
                            {sample.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </KpiCardContainer>
              )
            )}

            {customFieldsBySection.map((section) => {
              const visibleFields = isEditingValues
                ? section.fields
                : section.fields.filter(customFieldHasDisplayValue);
              if (visibleFields.length === 0) return null;
              return (
              <KpiCardContainer
                key={section.name}
                title={section.name}
                className="md:col-span-2"
                icon={<List className="w-3.5 h-3.5" style={lime} />}
              >
                {(() => {
                  const metricFields = visibleFields.filter((field) => {
                    const kind = customFieldKind(field.customFieldType?.name);
                    if (
                      kind === "image" ||
                      kind === "select" ||
                      kind === "multiselect" ||
                      isDropOffLocationsField(field)
                    ) {
                      return false;
                    }
                    const fieldId = String(field.id);
                    const displayValue = isEditingValues
                      ? (editedValues[fieldId] ?? field.value ?? "")
                      : (field.value ?? "");
                    return displayValue.length <= 50;
                  });
                  const blockFields = visibleFields.filter(
                    (field) => !metricFields.includes(field),
                  );
                  return (
                    <>
                      {metricFields.length > 0 && (
                        <RecapFieldStack>
                          {metricFields.map((field) => {
                            const fieldId = String(field.id);
                            return (
                              <RecapFieldRow key={field.id} label={field.name}>
                                {isEditingValues ? (
                                  isSpendAmountField({
                                    name: field.name,
                                    type: field.customFieldType?.name,
                                  }) ? (
                                    <SpendAmountInput
                                      value={editedValues[fieldId] ?? ""}
                                      onChange={(v) =>
                                        setEditedValues((prev) => ({
                                          ...prev,
                                          [fieldId]: v,
                                        }))
                                      }
                                      inputClassName="spark-input w-28 text-right text-sm"
                                      ariaLabel={field.name ?? "Spend amount"}
                                      hint={false}
                                    />
                                  ) : (
                                  <input
                                    type="text"
                                    value={editedValues[fieldId] ?? ""}
                                    onChange={(e) =>
                                      setEditedValues((prev) => ({
                                        ...prev,
                                        [fieldId]: e.target.value,
                                      }))
                                    }
                                    className="spark-input w-28 text-right text-sm"
                                  />
                                  )
                                ) : (
                                  field.value || "—"
                                )}
                              </RecapFieldRow>
                            );
                          })}
                        </RecapFieldStack>
                      )}
                      {blockFields.length > 0 && (
                        <div
                          className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${
                            metricFields.length > 0 ? "mt-4" : ""
                          }`}
                        >
                          {blockFields.map((field) => {
                    const fieldId = String(field.id);
                    const displayValue = isEditingValues
                      ? (editedValues[fieldId] ?? field.value ?? "")
                      : (field.value ?? "");
                    const kind = customFieldKind(
                      field.customFieldType?.name,
                    );

                    // ── DROP-OFF LOCATIONS (Product Seeding repeater) ─
                    if (isDropOffLocationsField(field)) {
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl p-4 space-y-2 xl:col-span-2"
                          style={inset}
                        >
                          {!recapLabelsMatch(field.name, section.name) && (
                            <RecapFieldBlockLabel label={field.name} />
                          )}
                          {isEditingValues ? (
                            <Suspense
                              fallback={
                                <p className="text-sm" style={faint}>
                                  Loading products…
                                </p>
                              }
                            >
                              <DropOffLocationsEditBridge
                                value={displayValue}
                                onChange={(v) =>
                                  setEditedValues((prev) => ({
                                    ...prev,
                                    [fieldId]: v,
                                  }))
                                }
                                tenantId={tenantId || null}
                                label={field.name ?? "Drop-off Locations"}
                              />
                            </Suspense>
                          ) : (
                            <DropOffLocationsReadout value={displayValue} />
                          )}
                        </div>
                      );
                    }

                    // ── IMAGE field ────────────────────────────────
                    // The field's value is a GCS blob path (or full URL);
                    // recapFileUrl() resolves it to something <img src>
                    // can load. In read mode show the image (or a dash);
                    // in edit mode show it plus an upload/replace + clear
                    // control. Uploading writes the new blob path into
                    // editedValues so the existing saveValues mutation
                    // persists it as this field's CustomFieldValue —
                    // exactly mirroring how SparkRecapCreate captures
                    // image fields via the GCS upload flow.
                    if (kind === "image") {
                      const imgSrc = displayValue
                        ? recapDisplayUrl(displayValue)
                        : "";
                      // One photo surface: empty IMAGE fields stay out of
                      // read mode when the Photos gallery already has files
                      // (or when the field is blank).
                      if (!isEditingValues && !imgSrc) return null;
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl p-4 space-y-3 xl:col-span-2"
                          style={inset}
                        >
                          {!recapLabelsMatch(field.name, section.name) && (
                            <RecapFieldBlockLabel label={field.name} />
                          )}
                          {imgSrc ? (
                            <img
                              src={thumbUrl(imgSrc, 400) || imgSrc}
                              alt={field.name ?? "Field image"}
                              loading="lazy"
                              decoding="async"
                              className="max-h-64 w-auto rounded-lg object-contain"
                              style={inset}
                              onError={(event) => {
                                const img = event.currentTarget;
                                const fallback = recapFileUrl(displayValue);
                                if (fallback && img.src !== fallback)
                                  img.src = fallback;
                              }}
                            />
                          ) : fieldId === firstEmptyImageFieldId &&
                            flatImages.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {flatImages.slice(0, 8).map((f) => {
                                const src = displaySrc(f);
                                if (!src) return null;
                                return (
                                  <img
                                    key={f.id}
                                    src={thumbUrl(src, 400) || src}
                                    alt={f.name ?? "Recap photo"}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-40 w-auto rounded-lg object-contain"
                                    style={inset}
                                    onError={(event) => {
                                      const img = event.currentTarget;
                                      if (src && img.src !== src) img.src = src;
                                    }}
                                  />
                                );
                              })}
                            </div>
                          ) : isEditingValues ? (
                            <p className="text-sm italic" style={faint}>
                              No image yet
                            </p>
                          ) : null}
                          {isEditingValues && recap.uuid && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {/* Generic image-field uploader. Use the
                                  "photo" category (NOT "receipt") so the
                                  blob isn't tagged/labeled as a receipt on
                                  non-receipt fields, and label it from the
                                  field name ("Table setup pictures",
                                  "Sampling pictures (photos)", …) so every
                                  image field no longer reads "Upload
                                  receipt". */}
                              <RecapUploader
                                recapUuid={recap.uuid}
                                category="photo"
                                label={`📷 Upload ${field.name ?? "photo"}`}
                                onUploaded={(blobName) =>
                                  setEditedValues((prev) => ({
                                    ...prev,
                                    [fieldId]: blobName,
                                  }))
                                }
                              />
                              {displayValue && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditedValues((prev) => ({
                                      ...prev,
                                      [fieldId]: "",
                                    }))
                                  }
                                  className="px-3 py-1.5 rounded-xl text-sm font-semibold transition"
                                  style={dangerBtn}
                                  title="Remove the image from this field"
                                >
                                  <XIcon className="w-4 h-4" />
                                  Clear
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ── SELECT / MULTISELECT (choice) field ────────
                    // Options live on field.options (admin-defined). A
                    // single-select stores the chosen option string; a
                    // multiselect stores a JSON array of strings. Read mode
                    // shows the choice(s) as chips; edit mode offers the same
                    // control as the fill form (native <select> / toggle
                    // chips) so the value round-trips through saveValues.
                    if (kind === "select" || kind === "multiselect") {
                      const options = field.options ?? [];
                      const selected = parseChoiceList(displayValue);
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl p-4 space-y-2"
                          style={inset}
                        >
                          {!recapLabelsMatch(field.name, section.name) && (
                            <RecapFieldBlockLabel label={field.name} />
                          )}
                          {isEditingValues ? (
                            kind === "select" ? (
                              <select
                                value={selected[0] ?? ""}
                                onChange={(e) =>
                                  setEditedValues((prev) => ({
                                    ...prev,
                                    [fieldId]: e.target.value,
                                  }))
                                }
                                className="spark-input w-full text-sm md:text-base"
                              >
                                <option value="">— Select —</option>
                                {options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt) => {
                                  const isOn = selected.includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      aria-pressed={isOn}
                                      onClick={() => {
                                        const next = isOn
                                          ? selected.filter((s) => s !== opt)
                                          : [...selected, opt];
                                        setEditedValues((prev) => ({
                                          ...prev,
                                          [fieldId]: JSON.stringify(next),
                                        }));
                                      }}
                                      className={`recap-option-chip${isOn ? " is-selected" : ""}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          ) : selected.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selected.map((v) => (
                                <RecapChoiceChip key={v} label={v} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm md:text-base" style={faint}>
                              —
                            </p>
                          )}
                        </div>
                      );
                    }

                    // ── TEXT / NUMBER / LONGTEXT field ─────────────
                    const isLongText =
                      displayValue && displayValue.length > 50;
                    // Render a multiline textarea for long values
                    // (notes / observations) and a single-line input
                    // for short ones (numbers / labels). Both bound
                    // to the same edited-values map.
                    const useTextarea = isLongText || displayValue.length > 50;
                    return (
                      <div
                        key={field.id}
                        className={`rounded-xl p-4 space-y-2 ${isLongText ? "xl:col-span-2" : ""}`}
                        style={inset}
                      >
                        {!recapLabelsMatch(field.name, section.name) && (
                          <RecapFieldBlockLabel label={field.name} />
                        )}
                        {isEditingValues ? (
                          useTextarea ? (
                            <textarea
                              value={editedValues[fieldId] ?? ""}
                              onChange={(e) =>
                                setEditedValues((prev) => ({
                                  ...prev,
                                  [fieldId]: e.target.value,
                                }))
                              }
                              rows={Math.min(
                                10,
                                Math.max(
                                  2,
                                  Math.ceil(
                                    Math.max(
                                      displayValue.length,
                                      ((field as { placeholder?: string | null }).placeholder || "").length,
                                    ) / 60,
                                  ),
                                ),
                              )}
                              placeholder={
                                (field as { placeholder?: string | null }).placeholder ||
                                undefined
                              }
                              className="spark-input w-full text-sm md:text-base min-h-[6rem]"
                            />
                          ) : (
                            <input
                              type="text"
                              value={editedValues[fieldId] ?? ""}
                              onChange={(e) =>
                                setEditedValues((prev) => ({
                                  ...prev,
                                  [fieldId]: e.target.value,
                                }))
                              }
                              placeholder={
                                (field as { placeholder?: string | null }).placeholder ||
                                undefined
                              }
                              className="spark-input w-full text-sm md:text-base"
                            />
                          )
                        ) : (
                          <p
                            className="text-sm md:text-base leading-relaxed font-medium whitespace-pre-wrap"
                            style={{ color: "var(--recap-text, #14160f)" }}
                          >
                            {field.value || "—"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </KpiCardContainer>
              );
            })}
          </div>
          </RecapDetailPanel>

          <RecapDetailPanel active={detailTab === "photos"}>
          {/* Photos gallery */}
          <div ref={evidenceRef} className="spark-card p-6 scroll-mt-24">
            {showPhotoPrompt && !isClient && (
              <div
                className="mb-6 rounded-2xl p-4 flex items-start gap-3"
                style={{
                  border: "1px solid rgba(255,196,0,0.4)",
                  background: "rgba(255,196,0,0.10)",
                }}
              >
                <div
                  className="p-2 rounded-lg shrink-0"
                  style={{ background: "rgba(255,196,0,0.18)" }}
                >
                  <ImageIcon className="h-5 w-5" style={{ color: "var(--spark-gold)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    No photos came through from the PDF
                  </p>
                  <p className="text-xs mt-0.5" style={muted}>
                    The imported Connecteam PDF didn't include any usable event
                    photos. Upload them here before approving — use the{" "}
                    <b>Upload</b> button on the right (pick the right section
                    first — any of this brand's photo sections).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoPromptDismissed(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0"
                  style={ghostBtn}
                >
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ background: "rgba(var(--spark-accent-rgb),0.10)" }}
                >
                  <ImageIcon className="h-6 w-6" style={lime} />
                </div>
                <div>
                  <h2 className="display text-xl font-bold">
                    Photos
                  </h2>
                  <p className="text-xs mt-0.5" style={muted}>
                    {recapFiles?.filter(
                      (f) => f?.fileRecapCategory?.name != null,
                    ).length ?? 0}{" "}
                    file(s) across {categories.length} categor
                    {categories.length === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>
              {recap.uuid && !isClient && (
                <div className="flex items-center gap-2">
                  {/* Pick the section a new upload lands in, so receipts go
                      straight into the right tenant section. */}
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
                    <option value="">Uncategorized</option>
                  </select>
                  <RecapUploader
                    recapUuid={recap.uuid}
                    category={
                      isReceiptLikeCategory(uploadCategory)
                        ? "receipt"
                        : "photo"
                    }
                    onUploaded={handlePhotoUploaded}
                  />
                </div>
              )}
            </div>

            {categories.length > 0 ? (
              <div className="flex flex-col gap-4">
                {categories.map((category) => {
                  const files = category.files;
                  const imageCount = files.filter(isImageFile).length;
                  const videoCount = files.filter(isVideoFile).length;
                  const pdfCount = files.filter(isPdfFile).length;

                  return (
                    <details
                      key={category.name}
                      className="group rounded-2xl overflow-hidden"
                      style={inset}
                      open
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 select-none">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: "rgba(var(--spark-accent-rgb),0.10)",
                            color: "var(--spark-lime)",
                          }}
                        >
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {category.name}
                          </span>
                          <span className="text-[11px] font-medium" style={muted}>
                            {` · ${imageCount} image${imageCount !== 1 ? "s" : ""}`}
                            {videoCount > 0
                              ? ` · ${videoCount} video${videoCount !== 1 ? "s" : ""}`
                              : ""}
                            {pdfCount > 0
                              ? ` · ${pdfCount} PDF${pdfCount !== 1 ? "s" : ""}`
                              : ""}
                          </span>
                        </div>
                        {/* Chevron indicator */}
                        <svg
                          className="ml-auto h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-180"
                          style={faint}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </summary>

                      <div className="p-4" style={{ borderTop: "1px solid var(--spark-border)" }}>
                        <div
                          className="grid gap-3"
                          style={{
                            gridTemplateColumns: isClient
                              ? "repeat(auto-fill, minmax(220px, 1fr))"
                              : "repeat(auto-fill, minmax(160px, 1fr))",
                            maxHeight: files.length > 20 ? "520px" : undefined,
                            overflowY: files.length > 20 ? "auto" : undefined,
                          }}
                        >
                          {files.map((file) => {
                            const isImage = isImageFile(file);
                            const isVideo = isVideoFile(file);
                            const isPdf = isPdfFile(file);
                            const playable = isVideo ? videoSrc(file) : "";

                            return (
                              <div
                                key={file.id}
                                className="group flex flex-col gap-1.5 rounded-xl p-2 cursor-pointer"
                                style={inset}
                                onClick={() => {
                                  if (isVideo) {
                                    openVideo(file);
                                    return;
                                  }
                                  if (isImage) {
                                    const idx = flatImages.findIndex(
                                      (img) => img.id === file.id,
                                    );
                                    if (idx >= 0) setPreviewIndex(idx);
                                  } else {
                                    window.open(
                                      recapFileUrl(file.url || "") || "#",
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }
                                }}
                              >
                                <div
                                  className="relative aspect-square w-full overflow-hidden rounded-lg"
                                  style={{ background: "rgba(20, 22, 15, 0.04)" }}
                                >
                                  {/* Per-file delete (admin). Hard-removes
                                      this file from the recap's Evidences
                                      gallery — for pulling a misfiled image
                                      (e.g. a receipt that landed under the
                                      wrong category). stopPropagation so the
                                      click doesn't also open the preview /
                                      a new tab. */}
                                  {!isClient && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteFile(file.id, file.name);
                                    }}
                                    disabled={
                                      isDeletingFile &&
                                      deletingFileId === file.id
                                    }
                                    title="Remove this file from the recap"
                                    aria-label="Remove this file from the recap"
                                    className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full opacity-0 shadow transition focus:opacity-100 group-hover:opacity-100 disabled:opacity-60"
                                    style={{
                                      background: "rgba(var(--spark-bg-rgb),0.85)",
                                      color: "var(--spark-orange)",
                                      border: "1px solid rgba(239,90,42,0.5)",
                                    }}
                                  >
                                    {isDeletingFile &&
                                    deletingFileId === file.id ? (
                                      <span className="text-[10px]">…</span>
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  )}
                                  {isVideo ? (
                                    <RecapVideoThumb src={playable} />
                                  ) : isImage ? (
                                      <img
                                        src={
                                          thumbUrl(displaySrc(file), 400) ||
                                          displaySrc(file)
                                        }
                                        alt={file.name || "Evidence"}
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        onError={(event) => {
                                          const img = event.currentTarget;
                                          const full = displaySrc(file);
                                          if (full && img.src !== full) {
                                            img.src = full;
                                            return;
                                          }
                                          if (file.url && img.src !== file.url) {
                                            img.src = file.url;
                                          }
                                        }}
                                      />
                                  ) : (
                                    <div
                                      className="flex h-full w-full flex-col items-center justify-center gap-1"
                                      style={faint}
                                    >
                                      {isPdf ? (
                                        <FileText className="h-8 w-8" />
                                      ) : (
                                        <FolderOpen className="h-8 w-8" />
                                      )}
                                      <span className="text-[10px] font-black uppercase tracking-wider">
                                        {(
                                          file.fileType?.name || "FILE"
                                        ).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  {/* Hover overlay badge */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
                                    <span
                                      className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider shadow"
                                      style={{
                                        background: "var(--spark-lime)",
                                        color: "var(--spark-on-accent)",
                                      }}
                                    >
                                      {isVideo ? "Play" : isImage ? "View" : "Open"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5 px-0.5">
                                  <span
                                    className="truncate text-xs font-semibold leading-tight"
                                    title={file.name || ""}
                                  >
                                    {file.name || "Unnamed File"}
                                  </span>
                                  <span
                                    className={`chip ${
                                      recap.approved ? "chip-lime" : "chip-orange"
                                    }`}
                                  >
                                    {statusLabel}
                                  </span>
                                  {/* Move this file to a section so receipts
                                      don't clump in with sampling photos.
                                      Sentinels resolve server-side to this
                                      tenant's own categories; stopPropagation
                                      keeps the click off the preview opener. */}
                                  {!isClient && (
                                  <select
                                    value=""
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const v = e.target.value;
                                      if (!v) return;
                                      handleSetFileCategory(
                                        file.id,
                                        v === "__none__" ? "" : v,
                                      );
                                    }}
                                    disabled={isSettingCategory}
                                    title="Move this file to a section"
                                    className="spark-input mt-0.5 w-full px-1 py-0.5 text-[10px]"
                                  >
                                    <option value="">Move to…</option>
                                    {fileCategoryOptions.map((opt) => (
                                      <option key={opt.id} value={opt.name}>
                                        {opt.name}
                                      </option>
                                    ))}
                                    <option value="__none__">
                                      Uncategorized
                                    </option>
                                  </select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center p-16 rounded-2xl"
                style={{
                  border: "1px dashed var(--spark-border)",
                  background: "rgba(20, 22, 15, 0.02)",
                }}
              >
                <ImageIcon className="h-14 w-14 mb-3" style={faint} />
                <p className="font-semibold" style={muted}>
                  No files or evidences attached.
                </p>
              </div>
            )}
          </div>
          </RecapDetailPanel>

          <RecapDetailPanel active={isRecapBodyTab(detailTab)}>
          {isClient && (
            <RecapClientSignoff
              existingStatus={recap.clientSignoffStatus}
              existingComment={recap.clientSignoffComment}
              existingAt={recap.clientSignoffAt}
              busy={isSigningOff}
              approved={recap.approved}
              onApprove={handleApprove}
              approving={isApproving || approvePhase !== "idle"}
              onSubmit={(status, comment) => {
                commitSignoff({
                  variables: {
                    input: {
                      customRecapId: recap.id,
                      status,
                      comment,
                    },
                  },
                  onCompleted: (res) => {
                    if (res.submitRecapClientSignoff?.success) {
                      showAlert("Sign-off saved.", "success");
                      onRefresh();
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
          </div>
          </RecapDocument>
      </div>

      {!isEditingValues && !isClient && (
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
                      ? () => handleApprove(true)
                      : null,
                }
              : null
          }
          actions={[
            ...(!recap.approved && !recap.archivedAt && queueInfo?.nextUnapproved
              ? [
                  {
                    key: "approve-next",
                    label: "Approve & next →",
                    onClick: () => handleApprove(true),
                    disabled: isApproving,
                    title:
                      "Approve recap and advance to the next unapproved recap in the queue (a)",
                    phoneOnly: true,
                  },
                ]
              : []),
            { key: "share", label: "↗ Share", onClick: openShare },
            {
              key: "edit",
              label: "✎ Edit recap",
              onClick: enterEditMode,
              title:
                "Correct metrics, field values, sampled products and title. Changes are logged in edit history.",
            },
            recap.archivedAt
              ? {
                  key: "unarchive",
                  label: isUnarchiving ? "Restoring…" : "Unarchive",
                  onClick: handleUnarchive,
                  disabled: isUnarchiving,
                  title: "Restore this recap to Needs review",
                }
              : {
                  key: "archive",
                  label: isArchiving ? "Archiving…" : "Archive",
                  onClick: handleArchive,
                  disabled: isArchiving,
                  title: "Park this recap — keep proof, hide from client",
                },
            {
              key: "delete",
              label: isDeleting ? "Deleting…" : "Delete",
              onClick: handleDelete,
              disabled: isDeleting,
              title: "Delete this recap and free the event for a new one",
              tone: "danger",
            },
          ]}
        >
          {recap.approved ? (
            <span className="chip chip-lime">
              <StatusMorph value="Approved" />
            </span>
          ) : (
            <>
              <ActionMorphButton
                onClick={() => handleApprove(false)}
                disabled={isApproving || Boolean(recap.archivedAt)}
                phase={approvePhase}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                style={
                  queueInfo?.nextUnapproved
                    ? {
                        background: "transparent",
                        color: "var(--spark-lime)",
                        border: "1px solid rgba(var(--spark-accent-rgb),0.45)",
                        opacity: isApproving ? 0.5 : 1,
                      }
                    : { ...limeBtn, opacity: isApproving ? 0.5 : 1 }
                }
                title={
                  recap.archivedAt
                    ? "Unarchive before approving"
                    : "Approve recap and email the requestor + mapped RMM"
                }
                pendingLabel="Approving…"
                successLabel="Approved"
              >
                Approve recap
              </ActionMorphButton>
              {queueInfo?.nextUnapproved && !recap.archivedAt && (
                // Phones have room for one primary button; there this
                // action is the first item in the More menu instead.
                <span className="recap-sticky-ops-from-sm">
                  <ActionMorphButton
                    onClick={() => handleApprove(true)}
                    disabled={isApproving}
                    phase={approvePhase}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                    style={{ ...limeBtn, opacity: isApproving ? 0.5 : 1 }}
                    title="Approve recap and advance to the next unapproved recap in the queue (a)"
                    pendingLabel="Approving…"
                    successLabel="Approved →"
                  >
                    Approve & next →
                  </ActionMorphButton>
                </span>
              )}
            </>
          )}
        </RecapStickyOpsBar>
      )}

      {currentPreview && (
        <ImagePreviewModal
          image={{
            name: currentPreview.name ?? "Evidence",
            file: currentPreviewSrc,
          }}
          images={flatImages.map((file) => ({
            name: file.name ?? "Evidence",
            file: displaySrc(file),
          }))}
          index={previewIndex ?? 0}
          onClose={closePreview}
          onIndex={setPreviewIndex}
        />
      )}
      {videoModal}

      {shareOpen && recap.shareToken && (
        <ShareRecapModal
          recapId={recap.id}
          kind="custom"
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
    </>
  );

  if (isClient) {
    const clientInner = (
      <>
        <div className="space-y-6 max-w-5xl">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              to={backToListUrl}
              className="mono text-[11px] transition"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(var(--spark-ink-rgb),0.45)",
              }}
            >
              ← Recaps
              {recap.name ? ` / ${recap.name}` : ""}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                style={{ ...ghostBtn, opacity: isGeneratingPdf ? 0.5 : 1 }}
                title={
                  existingPdfUrl
                    ? "Download the ready PDF (regenerates if missing)"
                    : "Generate and download this recap as a PDF"
                }
              >
                {isGeneratingPdf
                  ? "Generating…"
                  : existingPdfUrl
                    ? "Download PDF"
                    : "PDF"}
              </button>
              <button
                onClick={() => {
                  if (!recap.shareToken) {
                    showAlert("Share link isn't ready yet.", "warning");
                    return;
                  }
                  setShareOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap"
                style={ghostBtn}
              >
                Share
              </button>
            </div>
          </div>

          <RecapDocument status={recap.approved ? "APPROVED" : "DRAFT"}>
          <div className="space-y-6">
          <div className="spark-card p-6">
            {recap.isThirdParty ? (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <ThirdPartyRecapBadge notInTotals={recap.excludeFromAggregates} />
              </div>
            ) : recap.sourceLabel || recap.coActivation?.brandNames?.length ? (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <RecapSourceBadge label={recap.sourceLabel} />
                <RecapSourceBadge label={coActivationLabel(recap.coActivation?.brandNames)} />
              </div>
            ) : null}
            <h1
              className="display text-3xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              {recap.name}
            </h1>
            <p className="mt-1 recap-doc-kicker">
              {recap.isThirdParty ? "3rd Party Recap" : "Field recap"}
              {" · "}
              {place || "—"}
              {" · "}
              {formatDate(recap.event?.date ?? recap.eventDate ?? null)}
            </p>
          </div>

          <div ref={evidenceRef} className="spark-card p-6">
            <p
              className="mono text-[10px] mb-4"
              style={{ letterSpacing: "0.18em", color: "var(--recap-muted, #5c6154)" }}
            >
              PHOTOS · {flatImages.length + flatVideos.length}
            </p>
            {flatImages.length + flatVideos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories
                  .flatMap((category) => category.files)
                  .filter((file) => isImageFile(file) || isVideoFile(file))
                  .map((file) => {
                    if (isVideoFile(file)) {
                      const src = videoSrc(file);
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => openVideo(file)}
                          className="relative block h-40 overflow-hidden rounded-xl text-left"
                          style={{ border: "1px solid var(--spark-border)" }}
                        >
                          <RecapVideoThumb src={src} />
                        </button>
                      );
                    }
                    const src = displaySrc(file);
                    const idx = flatImages.findIndex((img) => img.id === file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          if (idx >= 0) setPreviewIndex(idx);
                        }}
                        className="block overflow-hidden rounded-xl text-left"
                        style={{ border: "1px solid var(--spark-border)" }}
                      >
                        <img
                          src={thumbUrl(src, 400) || src}
                          alt={file.name || "Recap photo"}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-40 object-cover"
                          onError={(event) => {
                            const img = event.currentTarget;
                            if (src && img.src !== src) img.src = src;
                          }}
                        />
                      </button>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm" style={muted}>
                No photos on this recap yet.
              </p>
            )}
          </div>

          <RecapShareFieldSections
            sections={customFieldsBySection.map((section) => ({
              name: section.name,
              fields: section.fields
                .filter(customFieldHasDisplayValue)
                .map((field) => ({
                  name: field.name,
                  value: field.value,
                })),
            }))}
          />

          {reviewKpis.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {reviewKpis.map((k, i) => (
                <div
                  key={k.label}
                  className="kpi"
                  style={
                    i === 0
                      ? {
                          boxShadow:
                            "0 0 28px color-mix(in srgb, var(--recap-brand, #f2f3ee) 25%, transparent)",
                        }
                      : undefined
                  }
                >
                  <p
                    className="kpi-value"
                    style={{ color: "var(--recap-brand, var(--spark-lime))" }}
                  >
                    {k.value}
                  </p>
                  <p className="kpi-label">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          <RecapClientSignoff
            existingStatus={recap.clientSignoffStatus}
            existingComment={recap.clientSignoffComment}
            existingAt={recap.clientSignoffAt}
            busy={isSigningOff}
            approved={recap.approved}
            onApprove={handleApprove}
            approving={isApproving || approvePhase !== "idle"}
            onSubmit={(status, comment) => {
              commitSignoff({
                variables: {
                  input: {
                    customRecapId: recap.id,
                    status,
                    comment,
                  },
                },
                onCompleted: (res) => {
                  if (res.submitRecapClientSignoff?.success) {
                    showAlert("Sign-off saved.", "success");
                    onRefresh();
                  } else {
                    showAlert(
                      res.submitRecapClientSignoff?.message ??
                        "Couldn't save sign-off.",
                      "error",
                    );
                  }
                },
                onError: (err) => showAlert(err.message, "error"),
              });
            }}
          />
          </div>
          </RecapDocument>
        </div>

        {currentPreview && (
          <ImagePreviewModal
            image={{
              name: currentPreview.name ?? "Evidence",
              file: currentPreviewSrc,
            }}
            images={flatImages.map((file) => ({
              name: file.name ?? "Evidence",
              file: displaySrc(file),
            }))}
            index={previewIndex ?? 0}
            onClose={closePreview}
            onIndex={setPreviewIndex}
          />
        )}
        {videoModal}

        {shareOpen && recap.shareToken && (
          <ShareRecapModal
            recapId={recap.id}
            kind="custom"
            shareToken={recap.shareToken}
            recapName={recap.name}
            onClose={() => setShareOpen(false)}
          />
        )}
      </>
    );
    return <ClientTenantRecapBrand>{clientInner}</ClientTenantRecapBrand>;
  }
  return inner;
};

export default function RecapCustomView() {
  // Keep refreshKey above Suspense so a suspending refetch can't remount
  // the inner tree and reset the key back to 0 (stale store).
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <Layout>
      <Suspense fallback={<RecapDetailSkeleton />}>
        <RecapCustomViewInner
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      </Suspense>
    </Layout>
  );
}
