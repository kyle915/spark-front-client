import Layout from "@/layout/Layout";
import { GetCustomRecapQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQueryDetailsQuery as CustomRecapsQueryDetailsQueryType } from "@/api/queries/__generated__/CustomRecapsQueryDetailsQuery.graphql";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@/api/queries/__generated__/ProductsQuery.graphql";
import { UpdateCustomRecapMutation } from "@/api/mutations/UpdateCustomRecapMutation";
import type { UpdateCustomRecapMutation as UpdateCustomRecapMutationType } from "@/api/mutations/__generated__/UpdateCustomRecapMutation.graphql";
import { ApproveCustomRecapMutation } from "@/api/mutations/ApproveCustomRecapMutation";
import type { ApproveCustomRecapMutation as ApproveCustomRecapMutationType } from "@/api/mutations/__generated__/ApproveCustomRecapMutation.graphql";
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
import ErrorBoundary from "@/components/ErrorBoundary";
import { AmbassadorPicker } from "./AmbassadorPicker";
import { RecapDetailSkeleton } from "@/layout/PageSkeletons";
import { buildCustomFieldValuesPayload } from "./customRecapSave";
import { useAuthStore } from "@/store/authStore";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import {
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { formatDate, parseLocaleNumber } from "@/utils";
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
  X as XIcon,
} from "lucide-react";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { useAlertStore } from "@/store/alertStore";
import { recapFileUrl } from "@/utils/recapFileUrl";
import { shareRecapLink } from "@/utils/recapShare";
import useSparkRole from "@/hooks/useSparkRole";
import { RecapClientSignoff } from "@/recap/RecapClientSignoff";
import { ClientTenantRecapBrand } from "@/recap/TenantBrandedRecap";
import { RecapClientSignoffMutation } from "@/api/mutations/RecapClientSignoffMutation";
import type { RecapClientSignoffMutation as RecapClientSignoffMutationType } from "@/api/mutations/__generated__/RecapClientSignoffMutation.graphql";

const RecapQualityPanel = lazy(() => import("./RecapQualityPanel"));

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

const FILE_CATEGORY_PHOTOS = "Sampling photos";
const FILE_CATEGORY_RECEIPTS = "Receipts";

// A multiselect answer is persisted as a JSON array of the chosen option
// strings; a single-select answer is the plain option string. Parse either
// shape into a string[] for rendering (and tolerate a legacy plain string
// landing in a multiselect field).
function customFieldHasDisplayValue(
  field: {
    value?: string | null;
    customFieldType?: { name?: string | null } | null;
  },
): boolean {
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
  color: "#0a0d09",
  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
};
const dangerBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-orange)",
  border: "1px solid rgba(239,90,42,0.4)",
};
const muted: React.CSSProperties = { color: "rgba(255,255,255,0.55)" };
const faint: React.CSSProperties = { color: "rgba(255,255,255,0.4)" };
const lime: React.CSSProperties = { color: "var(--spark-lime)" };
const hairline: React.CSSProperties = {
  borderBottom: "1px solid var(--spark-border)",
};
const inset: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  background: "rgba(255,255,255,0.03)",
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
      className="mono text-[10px] mb-4 flex items-center gap-2"
      style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)" }}
    >
      {icon}
      {title.toUpperCase()}
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
    { first: 100, filters: tenantId ? { tenantId } : null },
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

const RecapCustomViewInner = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const [searchParams] = useSearchParams();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // Id of the Evidences file currently being deleted, so only that card's
  // ×-button shows the in-flight state (the useMutation `isDeletingFile`
  // flag is global to the gallery).
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  // Bumped after a mutation that doesn't reliably re-render off its payload
  // (approve) so the query refetches and the view reflects the new state —
  // mirrors the legacy SparkRecapView refreshKey pattern.
  const [refreshKey, setRefreshKey] = useState(0);
  // Section a new Evidences upload lands in. Send the category NAME so
  // it never collides with a real FileRecapCategory PK (LD "Table Set
  // Up" is PK 2). "" = Uncategorized.
  const [uploadCategory, setUploadCategory] = useState(FILE_CATEGORY_PHOTOS);

  // A Connecteam import routes here with ?needPhotos=1 when the PDF carried
  // no usable photos — so the admin lands directly in the photo-upload
  // workflow instead of discovering the gap later. We surface a prompt in
  // the Evidences section and scroll it into view. Dismissible per-view.
  const needPhotos = searchParams.get("needPhotos") === "1";
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
  // Active dashboard tenant — scopes the BA roster picker to this client
  // (same as SparkRecapCreate), so the dropdown can't leak another
  // tenant's ambassadors.
  const tenantId = useAuthStore((s) => s.tenantId);
  const [commitUpdateCustomRecap, isSavingValues] =
    useMutation<UpdateCustomRecapMutationType>(UpdateCustomRecapMutation);
  const [commitGeneratePdf, isGeneratingPdf] =
    useMutation<GenerateCustomRecapPdfMutationType>(
      GenerateCustomRecapPdfMutation,
    );
  const [commitApprove, isApproving] =
    useMutation<ApproveCustomRecapMutationType>(ApproveCustomRecapMutation);
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
    const customFieldValues = buildCustomFieldValuesPayload(
      allFields,
      editedValues,
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
    const productSamples = Object.entries(editedSampleQtys)
      .map(([productId, raw]) => {
        const n = parseLocaleNumber(raw ?? "");
        return n != null && Number.isFinite(n) && Math.round(n) > 0
          ? { productId, quantity: Math.round(n) }
          : null;
      })
      .filter(
        (s): s is { productId: string; quantity: number } => s !== null,
      );

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
          // Typed int on CustomRecap — now editable, and ALWAYS sent so an
          // unrelated edit can't drop it. Blank → null, and the resolver keeps
          // the existing value on null, so blanking is a safe no-op.
          totalEngagements: (() => {
            const t = editedTotalEngagements.trim();
            if (!t) return null;
            const n = Number(t);
            return Number.isFinite(n) ? Math.round(n) : null;
          })(),
          // Adding/clearing the BA on an existing recap. A resolved
          // ambassador FK wins over any write-in server-side; passing null
          // for both clears the link.
          ambassadorId,
          externalBaName,
          fillingForAmbassador: editedFillingForAmbassador,
        },
      },
      onCompleted: (res) => {
        const payload = res.updateCustomRecap;
        if (payload?.success) {
          showAlert("Recap values saved.", "success");
          exitEditMode();
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
    customFieldsBySection,
    editedValues,
    editedName,
    editedSampleQtys,
    editedUsedCorpoCard,
    editedTotalEngagements,
    editedAmbassadorId,
    editedExternalBaName,
    editedFillingForAmbassador,
    commitUpdateCustomRecap,
    showAlert,
    exitEditMode,
  ]);

  // Generate (or regenerate) the recap PDF, then open the returned file in
  // a new tab. Mirrors the legacy SparkRecapView PDF button. CustomRecapFile
  // exposes url / displayUrl (no `file` field), so we open url ?? displayUrl.
  const existingPdf = useMemo(() => {
    return (recap?.customRecapFiles ?? []).find((f) => {
      const name = (f?.name ?? "").toLowerCase();
      const typeName = (f?.fileType?.name ?? "").toLowerCase();
      const url = (f?.url ?? "").toLowerCase();
      if (name.includes("connecteam source")) return false;
      return typeName === "pdf" || url.split("?")[0]?.endsWith(".pdf");
    });
  }, [recap?.customRecapFiles]);
  const existingPdfUrl =
    existingPdf?.url || existingPdf?.displayUrl || "";

  const handleGeneratePdf = useCallback(() => {
    if (!recap?.id) return;
    if (existingPdfUrl) {
      window.open(existingPdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
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
            showAlert("PDF generated.", "success");
          } else {
            showAlert("PDF generated, but no file URL was returned.", "warning");
          }
        } else {
          showAlert(payload?.message ?? "PDF generation failed.", "error");
        }
      },
      onError: (err) => showAlert(`PDF failed: ${err.message}`, "error"),
    });
  }, [recap?.id, existingPdfUrl, commitGeneratePdf, showAlert]);

  // Approve the custom recap → backend emails the requestor + mapped RMM
  // (with the PDF). Returns `approved` so the view flips in-place.
  const handleApprove = useCallback(() => {
    if (!recap?.id) return;
    commitApprove({
      variables: { input: { id: recap.id as string, approved: true } },
      onCompleted: (res) => {
        const payload = res.approveCustomRecap;
        if (payload?.success) {
          showAlert(
            "Recap approved — the requestor and mapped RMM have been emailed.",
            "success",
          );
          // Refetch so the status flips to Approved in-place. Relay's
          // auto-normalization of the mutation payload wasn't reliably
          // re-rendering this view, so bump the query's fetchKey to force
          // a fresh read (same fix the legacy SparkRecapView uses).
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(payload?.message ?? "Approve failed.", "error");
        }
      },
      onError: (err) => showAlert(`Approve failed: ${err.message}`, "error"),
    });
  }, [recap?.id, commitApprove, showAlert]);

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
            setRefreshKey((k) => k + 1);
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
            setRefreshKey((k) => k + 1);
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
          showAlert("Recap deleted.", "success");
          navigate("/recaps/list");
        } else {
          showAlert(payload?.message ?? "Delete failed.", "error");
        }
      },
      onError: (err) => showAlert(`Delete failed: ${err.message}`, "error"),
    });
  }, [recap?.id, commitDelete, showAlert, navigate]);

  const backToListUrl = useMemo(() => {
    const pageRaw = Number(searchParams.get("fromPage") ?? "1");
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const after = searchParams.get("fromAfter");

    const params = new URLSearchParams();
    params.set("page", String(page));
    if (after) params.set("after", after);

    // Point at the workspace Recaps list (SparkRecapsList). The old
    // /recaps/custom-list page is gone in new Spark, so "Back to list"
    // dead-ended there. The page/after params are kept (harmless).
    return `/recaps/list?${params.toString()}`;
  }, [searchParams]);

  const isPdfFile = useCallback((file: (typeof recapFiles)[number]) => {
    const typeName = file.fileType?.name?.toLowerCase() ?? "";
    const url = file.url?.toLowerCase() ?? "";
    const cleanUrl = url.split("?")[0]?.split("#")[0] ?? "";
    return typeName === "pdf" || cleanUrl.endsWith(".pdf");
  }, []);

  // Prefer the backend `displayUrl` everywhere: for HEIC uploads it's the
  // server-converted .jpg sibling, so the gallery renders a plain <img>
  // with no in-browser HEIC decode / bucket-CORS dependency. Falls back to
  // `url` for older query results.
  const displaySrc = useCallback(
    (file: (typeof recapFiles)[number]) => file.displayUrl ?? file.url ?? "",
    [],
  );

  const isImageFile = useCallback(
    (file: (typeof recapFiles)[number]) => {
      const typeName = file.fileType?.name?.toLowerCase() ?? "";
      const url = displaySrc(file).toLowerCase();
      if (typeName === "image" || typeName === "img") return true;
      if (typeName === "pdf" || url.endsWith(".pdf")) return false;
      return /\.(jpg|jpeg|png|gif|heic|heif|webp)/i.test(url);
    },
    [displaySrc],
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

  const goNext = useCallback(() => {
    if (!flatImages.length) return;

    setPreviewIndex((current) => {
      if (current === null) return 0;
      return (current + 1) % flatImages.length;
    });
  }, [flatImages.length]);

  const goPrev = useCallback(() => {
    if (!flatImages.length) return;

    setPreviewIndex((current) => {
      if (current === null) return flatImages.length - 1;
      return (current - 1 + flatImages.length) % flatImages.length;
    });
  }, [flatImages.length]);

  useEffect(() => {
    if (previewIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreview, goNext, goPrev, previewIndex]);

  const currentPreview =
    flatImages && previewIndex !== null ? flatImages[previewIndex] : null;
  const currentPreviewSrc = currentPreview ? displaySrc(currentPreview) : "";

  if (!recap) {
    return (
      <div
        className="spark-card p-8 text-sm"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        Recap not found.
      </div>
    );
  }

  const statusLabel = recap.approved ? "APPROVED" : "DRAFT";
  const place = [
    recap.eventRetailer ?? recap.retailer?.name,
    recap.eventVenue ?? recap.location?.name,
    recap.eventCity,
    recap.eventState ?? recap.state?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <>
      <div className="space-y-6 max-w-7xl">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              to={backToListUrl}
              className="mono text-[11px] transition"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              ← Recaps
              {recap.name ? ` / ${recap.name}` : ""}
              {place ? ` / ${place}` : ""}
              {` / ${formatDate(recap.event?.date ?? recap.eventDate ?? null)}`}
            </Link>
            {/* Edit-values toolbar. Toggles every custom-field value
                in the sections below into an editable input, with
                Save / Cancel pair here at the top. Re-renders the
                view in read mode after a successful save (relay store
                updated from the mutation's selection set). */}
            {!isEditingValues ? (
              <div className="flex items-center gap-2 flex-wrap">
                {recap.approved ? (
                  <span className="chip chip-lime">✓ APPROVED</span>
                ) : !isClient ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{ ...limeBtn, opacity: isApproving ? 0.5 : 1 }}
                    title="Approve recap and email the requestor + mapped RMM"
                  >
                    {isApproving ? "Approving…" : "✓ Approve recap"}
                  </button>
                ) : (
                  <span className="chip chip-orange">DRAFT</span>
                )}
                <button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{ ...ghostBtn, opacity: isGeneratingPdf ? 0.5 : 1 }}
                  title={
                    existingPdfUrl
                      ? "Download the ready PDF"
                      : "Generate and download this recap as a PDF"
                  }
                >
                  {existingPdfUrl
                    ? "⬇ Download PDF"
                    : isGeneratingPdf
                      ? "Generating…"
                      : recap.approved
                        ? "Generating…"
                        : "⬇ PDF"}
                </button>
                {!isClient && (
                <button
                  onClick={handleDownloadPhotos}
                  disabled={isZipping || flatImages.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
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
                <button
                  onClick={async () => {
                    if (!recap.shareToken) {
                      showAlert("Share link isn't ready yet.", "warning");
                      return;
                    }
                    const result = await shareRecapLink({
                      token: recap.shareToken,
                      title: recap.name ?? "Spark recap",
                    });
                    if (result === "copied")
                      showAlert("Link copied.", "success");
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={ghostBtn}
                >
                  ↗ Share
                </button>
                {!isClient && (
                  <button
                    onClick={enterEditMode}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={ghostBtn}
                    title="Edit the recap title, field values, and sampled products"
                  >
                    ✎ Edit recap
                  </button>
                )}
                {!isClient && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{ ...dangerBtn, opacity: isDeleting ? 0.5 : 1 }}
                    title="Delete this recap and free the event for a new one"
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={exitEditMode}
                  disabled={isSavingValues}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={ghostBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={saveValues}
                  disabled={isSavingValues}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{ ...limeBtn, opacity: isSavingValues ? 0.5 : 1 }}
                >
                  {isSavingValues ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          <div
            className="spark-card p-6 sticky top-0 z-20"
            style={{
              background: "rgba(10,13,9,0.92)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className={`chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
                  >
                    {statusLabel}
                  </span>
                  {recap.customRecapTemplate?.name && (
                    <span className="chip chip-muted">
                      {recap.customRecapTemplate.name}
                    </span>
                  )}
                  {recap.late && <span className="chip chip-orange">LATE</span>}
                  {recap.incomplete && (
                    <span className="chip chip-orange">INCOMPLETE</span>
                  )}
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
                <p className="mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {place || "—"}
                  {" · "}
                  {formatDate(recap.event?.date ?? recap.eventDate ?? null)}
                </p>
              </div>
            </div>
          </div>

          {!isEditingValues && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="kpi kpi-glow">
                <p className="kpi-value">
                  {typeof recap.totalEngagements === "number"
                    ? recap.totalEngagements.toLocaleString()
                    : "—"}
                </p>
                <p className="kpi-label">Engagements</p>
              </div>
              {recap.customRecapProductSample &&
                recap.customRecapProductSample.length > 0 && (
                  <div className="kpi">
                    <p className="kpi-value">
                      {recap.customRecapProductSample
                        .reduce((sum, s) => sum + (s.quantity ?? 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="kpi-label">Units sampled</p>
                  </div>
                )}
              <div className="kpi">
                <p className="kpi-value">{flatImages.length}</p>
                <p className="kpi-label">Photos</p>
              </div>
            </div>
          )}

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

          {/* ======================================================
          KPI GRID
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
                          {recap.ambassador?.user?.firstName}{" "}
                          {recap.ambassador?.user?.lastName}
                        </p>
                        <p className="text-sm" style={muted}>
                          Ambassador
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
                        <p className="font-medium">{recap.externalBaName}</p>
                        <p className="text-sm" style={muted}>
                          Ambassador (external)
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
                      formatDate(recap.submittedAt ?? recap.createdAt ?? null),
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
                      onChange={(e) =>
                        setEditedTotalEngagements(e.target.value)
                      }
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
                            {sale.product?.name ?? "—"}
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
                            {sample.product?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2">
                          <span style={muted}>
                            Quantity Distributed
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
                icon={<List className="w-3.5 h-3.5" style={lime} />}
              >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {visibleFields.map((field) => {
                    const fieldId = String(field.id);
                    const displayValue = isEditingValues
                      ? (editedValues[fieldId] ?? field.value ?? "")
                      : (field.value ?? "");
                    const kind = customFieldKind(
                      field.customFieldType?.name,
                    );

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
                        ? recapFileUrl(displayValue)
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
                          <p
                            className="mono text-[10px]"
                            style={{ letterSpacing: "0.14em", ...muted }}
                          >
                            {field.name}
                          </p>
                          {imgSrc ? (
                            <img
                              src={thumbUrl(imgSrc, 800) || imgSrc}
                              alt={field.name ?? "Field image"}
                              loading="lazy"
                              decoding="async"
                              className="max-h-64 w-auto rounded-lg object-contain"
                              style={inset}
                              onError={(event) => {
                                const img = event.currentTarget;
                                if (imgSrc && img.src !== imgSrc) img.src = imgSrc;
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
                          <p
                            className="mono text-[10px]"
                            style={{ letterSpacing: "0.14em", ...muted }}
                          >
                            {field.name}
                          </p>
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
                                      onClick={() => {
                                        const next = isOn
                                          ? selected.filter((s) => s !== opt)
                                          : [...selected, opt];
                                        setEditedValues((prev) => ({
                                          ...prev,
                                          [fieldId]: JSON.stringify(next),
                                        }));
                                      }}
                                      className="px-3 py-1.5 rounded-xl text-sm font-semibold transition"
                                      style={isOn ? limeBtn : ghostBtn}
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
                                <span key={v} className="chip chip-lime">
                                  {v}
                                </span>
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
                        <p
                          className="mono text-[10px]"
                          style={{ letterSpacing: "0.14em", ...muted }}
                        >
                          {field.name}
                        </p>
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
                                Math.max(2, Math.ceil(displayValue.length / 60)),
                              )}
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
                              className="spark-input w-full text-sm md:text-base"
                            />
                          )
                        ) : (
                          <p
                            className="text-sm md:text-base leading-relaxed font-medium whitespace-pre-wrap"
                            style={{ color: "rgba(255,255,255,0.85)" }}
                          >
                            {field.value || "—"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </KpiCardContainer>
              );
            })}
          </div>

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
                    first: Sampling photos or Receipts).
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
                  style={{ background: "rgba(197,245,70,0.10)" }}
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
                      straight to Receipts instead of clumping with photos. */}
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    title="Section for new uploads"
                    className="spark-input text-sm rounded-full"
                  >
                    <option value={FILE_CATEGORY_PHOTOS}>Sampling photos</option>
                    <option value={FILE_CATEGORY_RECEIPTS}>Receipts</option>
                    <option value="">Uncategorized</option>
                  </select>
                  <RecapUploader
                    recapUuid={recap.uuid}
                    category={
                      uploadCategory === FILE_CATEGORY_RECEIPTS
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
                            background: "rgba(197,245,70,0.10)",
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
                            const isPdf = isPdfFile(file);

                            return (
                              <div
                                key={file.id}
                                className="group flex flex-col gap-1.5 rounded-xl p-2 cursor-pointer"
                                style={inset}
                                onClick={() => {
                                  if (isImage) {
                                    const idx = flatImages.findIndex(
                                      (img) => img.id === file.id,
                                    );
                                    if (idx >= 0) setPreviewIndex(idx);
                                  } else {
                                    window.open(file.url || "#", "_blank");
                                  }
                                }}
                              >
                                <div
                                  className="relative aspect-square w-full overflow-hidden rounded-lg"
                                  style={{ background: "rgba(255,255,255,0.04)" }}
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
                                      background: "rgba(10,13,9,0.85)",
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
                                  {isImage ? (
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
                                        color: "#0a0d09",
                                      }}
                                    >
                                      {isImage ? "View" : "Open"}
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
                                    <option value={FILE_CATEGORY_RECEIPTS}>
                                      Receipts
                                    </option>
                                    <option value={FILE_CATEGORY_PHOTOS}>
                                      Sampling photos
                                    </option>
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
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <ImageIcon className="h-14 w-14 mb-3" style={faint} />
                <p className="font-semibold" style={muted}>
                  No files or evidences attached.
                </p>
              </div>
            )}
          </div>
          {isClient && (
            <RecapClientSignoff
              existingStatus={recap.clientSignoffStatus}
              existingComment={recap.clientSignoffComment}
              existingAt={recap.clientSignoffAt}
              busy={isSigningOff}
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
                      setRefreshKey((k) => k + 1);
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
      </div>

      {currentPreview && (
        <ImagePreviewModal
          image={{
            name: currentPreview.name ?? "Evidence",
            file: currentPreviewSrc,
          }}
          onClose={closePreview}
          onNext={goNext}
          onPrev={goPrev}
        />
      )}
    </>
  );

  if (isClient) {
    return <ClientTenantRecapBrand>{inner}</ClientTenantRecapBrand>;
  }
  return inner;
};

export default function RecapCustomView() {
  return (
    <Layout>
      <Suspense fallback={<RecapDetailSkeleton />}>
        <RecapCustomViewInner />
      </Suspense>
    </Layout>
  );
}
