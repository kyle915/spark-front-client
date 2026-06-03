import Layout from "@/layout/Layout";
import { GetCustomRecapQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQueryDetailsQuery as CustomRecapsQueryDetailsQueryType } from "@/api/queries/__generated__/CustomRecapsQueryDetailsQuery.graphql";
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
import { GenerateCustomRecapPdfMutation } from "@/api/mutations/GenerateCustomRecapPdfMutation";
import type { GenerateCustomRecapPdfMutation as GenerateCustomRecapPdfMutationType } from "@/api/mutations/__generated__/GenerateCustomRecapPdfMutation.graphql";
import { RecapUploader } from "./RecapUploader";
import RecapQualityPanel from "./RecapQualityPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AmbassadorPicker } from "./SparkRecapCreate";
import { buildCustomFieldValuesPayload } from "./customRecapSave";
import { useAuthStore } from "@/store/authStore";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useParams, Link, useNavigate, useSearchParams } from "react-router";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { formatDate } from "@/utils";
import {
  ArrowLeftIcon,
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
  Pencil,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { useAlertStore } from "@/store/alertStore";
import { recapFileUrl } from "@/utils/recapFileUrl";

// Custom-field type → control kind. Field-type names are lowercase by
// convention (text / number / image / longtext); match case-insensitively
// and treat anything unknown as text. Mirrors SparkRecapCreate.fieldKind so
// the view and the create form agree on what an "image" field is.
function customFieldKind(typeName: string | null | undefined): "image" | "other" {
  const name = (typeName ?? "").toLowerCase();
  if (name.includes("image") || name.includes("photo") || name.includes("img"))
    return "image";
  return "other";
}

type HeifDecodedImage = {
  get_width: () => number;
  get_height: () => number;
  display: (
    imageData: ImageData,
    callback: (displayData: ImageData | null) => void,
  ) => void;
  free?: () => void;
};

type LibHeifModule = {
  HeifDecoder: new () => {
    decode: (data: Uint8Array | ArrayBuffer) => HeifDecodedImage[];
  };
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
  <div className={`card bg-base-300/50 ${className}`}>
    <div className="card-body space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
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

const RecapCustomView = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
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

  const data = useLazyLoadQuery<CustomRecapsQueryDetailsQueryType>(
    GetCustomRecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
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
  // "Corporate Card Used" is a typed boolean on CustomRecap (not a custom
  // field), so it needs its own working-copy state to be editable.
  const [editedUsedCorpoCard, setEditedUsedCorpoCard] = useState(false);
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
  const [commitAddFile] = useMutation<AddCustomRecapFileMutationType>(
    AddCustomRecapFileMutation,
  );
  const [commitDelete, isDeleting] =
    useMutation<DeleteCustomRecapMutationType>(DeleteCustomRecapMutation);
  const [commitDeleteFile, isDeletingFile] =
    useMutation<DeleteCustomRecapFileMutationType>(
      DeleteCustomRecapFileMutation,
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
    setEditedUsedCorpoCard(!!recap?.usedCorpoCard);
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
    recap?.usedCorpoCard,
    recap?.ambassador?.id,
    recap?.ambassador?.user?.firstName,
    recap?.ambassador?.user?.lastName,
    recap?.externalBaName,
    recap?.fillingForAmbassador,
  ]);

  const exitEditMode = useCallback(() => {
    setIsEditingValues(false);
    setEditedValues({});
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

    commitUpdateCustomRecap({
      variables: {
        input: {
          id: recap.id as string,
          name: recap.name ?? "",
          eventId: eventId as string,
          customRecapTemplateId: templateId as string,
          customFieldValues,
          // Typed boolean on CustomRecap — now editable from the view.
          usedCorpoCard: editedUsedCorpoCard,
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
    editedUsedCorpoCard,
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
  }, [recap?.id, commitGeneratePdf, showAlert]);

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
          input: { customRecapId: recap.id as string, file: blobName },
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
    [recap?.id, commitAddFile, showAlert],
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

  // True only for a *still-unconverted* HEIC (no server .jpg sibling yet) —
  // those are the only files that need the in-browser libheif fallback. A
  // converted HEIC has displayUrl ending in .jpg, so it's NOT flagged here.
  const isHeicFile = useCallback(
    (file: (typeof recapFiles)[number]) => {
      const url = displaySrc(file).toLowerCase();
      const cleanUrl = url.split("?")[0]?.split("#")[0] ?? "";
      return cleanUrl.endsWith(".heic") || cleanUrl.endsWith(".heif");
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

  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const [convertingImageIds, setConvertingImageIds] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    const resolveImageSources = async () => {
      const heicFiles = flatImages.filter(isHeicFile);
      if (heicFiles.length === 0) {
        // Common path now that HEIC is converted server-side: every image
        // already has a renderable displayUrl, no in-browser decode needed.
        setImageSources(
          Object.fromEntries(flatImages.map((f) => [f.id, displaySrc(f)])),
        );
        return;
      }

      setConvertingImageIds(heicFiles.map((f) => f.id));

      const nextSources = await Promise.all(
        flatImages.map(async (file) => {
          const fallbackSrc = displaySrc(file);
          if (!fallbackSrc || !isHeicFile(file)) {
            return [file.id, fallbackSrc] as const;
          }

          try {
            console.log("[HEIC] Starting conversion", {
              fileId: file.id,
              url: fallbackSrc,
            });
            const response = await fetch(fallbackSrc);
            console.log("[HEIC] Fetch response", {
              fileId: file.id,
              ok: response.ok,
              status: response.status,
              statusText: response.statusText,
              contentType: response.headers.get("content-type"),
            });
            if (!response.ok) {
              throw new Error(
                `HEIC fetch failed with status ${response.status} ${response.statusText}`,
              );
            }
            const blob = await response.blob();
            console.log("[HEIC] Blob loaded", {
              fileId: file.id,
              size: blob.size,
              type: blob.type,
            });
            const module = (await import("libheif-js/wasm-bundle")) as
              | LibHeifModule
              | { default: LibHeifModule };
            const libheif =
              "default" in module ? module.default : module;
            console.log("[HEIC] libheif module ready", { fileId: file.id });

            const buffer = await blob.arrayBuffer();
            const decoder = new libheif.HeifDecoder();
            const images = decoder.decode(new Uint8Array(buffer));
            console.log("[HEIC] Decode result", {
              fileId: file.id,
              frames: images.length,
            });
            const image = images[0];
            if (!image) throw new Error("No HEIC image frames decoded");

            const width = image.get_width();
            const height = image.get_height();
            console.log("[HEIC] Frame selected", { fileId: file.id, width, height });
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas 2D context unavailable");

            const imageData = context.createImageData(width, height);
            await new Promise<void>((resolve, reject) => {
              image.display(imageData, (displayData) => {
                if (!displayData) {
                  console.error("[HEIC] display returned null", {
                    fileId: file.id,
                  });
                  reject(new Error("HEIF processing error"));
                  return;
                }

                context.putImageData(displayData, 0, 0);
                console.log("[HEIC] Image drawn to canvas", { fileId: file.id });
                resolve();
              });
            });

            const convertedBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((canvasBlob) => {
                if (!canvasBlob) {
                  console.error("[HEIC] canvas.toBlob returned null", {
                    fileId: file.id,
                  });
                  reject(new Error("Failed to create JPEG blob"));
                  return;
                }
                console.log("[HEIC] JPEG blob created", {
                  fileId: file.id,
                  size: canvasBlob.size,
                  type: canvasBlob.type,
                });
                resolve(canvasBlob);
              }, "image/jpeg");
            });
            image.free?.();
            console.log("[HEIC] Converted blob details", {
              fileId: file.id,
              size: convertedBlob.size,
              type: convertedBlob.type,
            });
            const objectUrl = URL.createObjectURL(convertedBlob);
            const objectUrlCheck = await fetch(objectUrl)
              .then((r) => ({
                ok: r.ok,
                status: r.status,
                type: r.headers.get("content-type"),
              }))
              .catch((err) => ({
                ok: false,
                status: -1,
                type: String(err),
              }));
            objectUrls.push(objectUrl);
            console.log("[HEIC] Conversion success", {
              fileId: file.id,
              objectUrl,
              objectUrlCheck,
            });
            return [file.id, objectUrl] as const;
          } catch (error) {
            console.error("[HEIC] Failed to convert", {
              fileId: file.id,
              url: fallbackSrc,
              error,
            });
            return [file.id, fallbackSrc] as const;
          }
        }),
      );

      if (!isCancelled) {
        setImageSources(Object.fromEntries(nextSources));
        setConvertingImageIds([]);
      }
    };

    void resolveImageSources();
    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [flatImages, isHeicFile, displaySrc]);

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
  const currentPreviewSrc = currentPreview
    ? (imageSources[currentPreview.id] ?? displaySrc(currentPreview))
    : "";

  if (!recap) {
    return (
      <Layout>
        <div className="alert alert-error">Recap not found.</div>
      </Layout>
    );
  }

  const statusLabel = recap.approved ? "Approved" : "Pending";

  return (
    <Layout>
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm overflow-hidden">
        <div className="p-4 md:p-10 space-y-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link
              to={backToListUrl}
              className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to list
            </Link>
            {/* Edit-values toolbar. Toggles every custom-field value
                in the sections below into an editable input, with
                Save / Cancel pair here at the top. Re-renders the
                view in read mode after a successful save (relay store
                updated from the mutation's selection set). */}
            {!isEditingValues ? (
              <div className="flex items-center gap-2">
                {recap.approved ? (
                  <span className="badge badge-success gap-1 py-3">
                    ✓ Approved
                  </span>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="btn btn-sm btn-success gap-2"
                    title="Approve recap and email the requestor + mapped RMM"
                  >
                    {isApproving ? "Approving…" : "✓ Approve recap"}
                  </button>
                )}
                <button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="btn btn-sm btn-outline gap-2"
                  title="Generate and download this recap as a PDF"
                >
                  {isGeneratingPdf ? "Generating…" : "⬇ PDF"}
                </button>
                <button
                  onClick={handleDownloadPhotos}
                  disabled={isZipping || flatImages.length === 0}
                  className="btn btn-sm btn-outline gap-2"
                  title="Download all photos in this recap as a ZIP"
                >
                  {isZipping
                    ? `Zipping ${flatImages.length}…`
                    : `⬇ Photos (${flatImages.length})`}
                </button>
                <button
                  onClick={enterEditMode}
                  className="btn btn-sm btn-outline gap-2"
                  title="Edit submitted field values"
                >
                  <Pencil className="w-4 h-4" />
                  Edit values
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn btn-sm btn-outline btn-error gap-2"
                  title="Delete this recap and free the event for a new one"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={exitEditMode}
                  disabled={isSavingValues}
                  className="btn btn-sm btn-ghost gap-2"
                >
                  <XIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={saveValues}
                  disabled={isSavingValues}
                  className="btn btn-sm btn-primary"
                >
                  {isSavingValues ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          {/* ======================================================
          HEADER
          ====================================================== */}
          <div className="card bg-base-300/50 border border-base-300 mb-8">
            <div className="card-body">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">{recap.name}</h1>
                  <p className="text-sm text-base-content/60">
                    Custom Recap Summary
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/70">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(recap.event?.date ?? null)}
                    </div>
                    {recap.location?.name && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {recap.location.name}, {recap.state?.name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="badge badge-outline">
                      {recap.customRecapTemplate?.name ?? "Custom"}
                    </span>
                    <div className="badge badge-soft badge-success">
                      {statusLabel}
                    </div>
                    {recap.late && (
                      <span className="badge badge-soft badge-error">Late</span>
                    )}
                    {recap.incomplete && (
                      <span className="badge badge-soft badge-warning">
                        Incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================
          QUALITY CHECK — server-computed review aid for the approver.
          Custom recap → isCustom={true}. Self-degrades to nothing on
          failure; wrapped in Suspense for the initial load.
          ====================================================== */}
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-sm"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Checking recap quality…
              </div>
            }
          >
            <RecapQualityPanel recapId={recap.id} isCustom={true} />
          </Suspense>

          {/* ======================================================
          KPI GRID
          ====================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <KpiCardContainer
              title="Information"
              icon={<Users className="text-primary" />}
            >
              <div className="space-y-4">
                {/* Ambassador editor (edit mode) — reuses the same
                    AmbassadorPicker the create form uses: pick a roster BA,
                    write in an external name, or inline-create a new BA.
                    Seeded from the recap on enter-edit; the picked id is
                    saved as ambassadorId in saveValues. */}
                {isEditingValues ? (
                  <div className="space-y-3 rounded-xl border border-base-100/30 bg-base-200/30 p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
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
                          <div className="text-sm text-base-content/60">
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
                      <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-medium uppercase">
                        {recap.ambassador?.user?.firstName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {recap.ambassador?.user?.firstName}{" "}
                          {recap.ambassador?.user?.lastName}
                        </p>
                        <p className="text-sm text-base-content/60">
                          Ambassador
                        </p>
                      </div>
                    </>
                  ) : recap.externalBaName ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-medium uppercase">
                        {recap.externalBaName[0]}
                      </div>
                      <div>
                        <p className="font-medium">{recap.externalBaName}</p>
                        <p className="text-sm text-base-content/60">
                          Ambassador (external)
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-medium uppercase">
                        —
                      </div>
                      <div>
                        <p className="font-medium">—</p>
                        <p className="text-sm text-base-content/60">
                          Ambassador
                        </p>
                      </div>
                    </>
                  )}
                </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">Job</span>
                  <span className="font-medium">{recap.job?.name ?? "—"}</span>
                </div>
                {/* Linked-event location. The recap's own retailer/
                    location/state FKs are usually null on custom recaps,
                    so we read the event-derived fields (walked server-
                    side from event -> request/retailer/location/state)
                    and fall back to the recap's own FK where one exists.
                    Together these tell a client exactly where the
                    activation happened. */}
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">Retailer</span>
                  <span className="font-medium text-right">
                    {recap.eventRetailer ?? recap.retailer?.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">Venue</span>
                  <span className="font-medium text-right">
                    {recap.eventVenue ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-base-100/30 gap-4">
                  <span className="text-sm whitespace-nowrap flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 opacity-60" />
                    Address
                  </span>
                  <span className="font-medium text-right">
                    {recap.eventAddress ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">City / State</span>
                  <span className="font-medium text-right">
                    {recap.eventCity || recap.eventState
                      ? [recap.eventCity, recap.eventState]
                          .filter(Boolean)
                          .join(", ")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm whitespace-nowrap flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 opacity-60" />
                    Event Date
                  </span>
                  <span className="font-medium text-right">
                    {formatDate(recap.eventDate ?? recap.event?.date ?? null)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm">Submitted At</span>
                  <span className="font-medium">
                    {formatDate(recap.submittedAt ?? recap.createdAt ?? null)}
                  </span>
                </div>
              </div>
            </KpiCardContainer>

            <KpiCardContainer
              title="Metrics"
              icon={<Goal className="text-primary" />}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
                  <span className="text-sm">Total Engagements</span>
                  <span className="text-xl font-bold">
                    {recap.totalEngagements}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 border border-base-100/30 rounded-lg">
                  <span className="text-sm">Corporate Card Used</span>
                  {isEditingValues ? (
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={editedUsedCorpoCard}
                      onChange={(e) => setEditedUsedCorpoCard(e.target.checked)}
                      aria-label="Corporate card used"
                    />
                  ) : (
                    <span
                      className={`badge badge-soft ${recap.usedCorpoCard ? "badge-success" : "badge-ghost text-base-content/40"}`}
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
                  <div className="flex justify-between items-center p-3 border border-base-100/30 rounded-lg">
                    <span className="text-sm">Filling for Ambassador</span>
                    <span
                      className={`badge badge-soft ${recap.fillingForAmbassador ? "badge-info" : "badge-ghost text-base-content/40"}`}
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
                  icon={<ShoppingCart className="text-primary" />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recap.customRecapSalePerformance.map((sale) => (
                      <div
                        key={sale.id}
                        className="border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm"
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
                          <span className="text-base-content/60">
                            Type: {sale.typeOfGood?.name ?? "—"}
                          </span>
                          <span className="font-bold text-primary">
                            ${sale.price?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </KpiCardContainer>
              )}

            {recap.customRecapProductSample &&
              recap.customRecapProductSample.length > 0 && (
                <KpiCardContainer
                  title="Product Samples"
                  className="md:col-span-2"
                  icon={<Package className="text-primary" />}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recap.customRecapProductSample.map((sample) => (
                      <div
                        key={sample.id}
                        className="border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm transition hover:border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          {sample.product?.image && (
                            <div className="w-12 h-12 bg-white rounded-lg p-1">
                              <img
                                src={sample.product.image}
                                alt={sample.product.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <p className="font-semibold">
                            {sample.product?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2">
                          <span className="text-base-content/60">
                            Quantity Distributed
                          </span>
                          <span className="badge badge-primary badge-sm font-bold">
                            {sample.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </KpiCardContainer>
              )}

            {customFieldsBySection.map((section) => (
              <KpiCardContainer
                key={section.name}
                title={section.name}
                icon={<List className="text-primary" />}
              >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {section.fields.map((field) => {
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
                      return (
                        <div
                          key={field.id}
                          className="border border-base-100/30 rounded-xl p-4 space-y-3 bg-base-200/20 shadow-sm transition hover:border-primary/20 xl:col-span-2"
                        >
                          <p className="text-[11px] uppercase font-bold text-base-content/50 tracking-wider">
                            {field.name}
                          </p>
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={field.name ?? "Field image"}
                              className="max-h-64 w-auto rounded-lg border border-base-100/30 object-contain bg-base-200/40"
                            />
                          ) : (
                            <p className="text-sm text-base-content/40 italic">
                              No image
                            </p>
                          )}
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
                                  className="btn btn-sm btn-ghost btn-error gap-1"
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
                        className={`border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm transition hover:border-primary/20 ${isLongText ? "xl:col-span-2" : ""}`}
                      >
                        <p className="text-[11px] uppercase font-bold text-base-content/50 tracking-wider">
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
                              className="textarea textarea-bordered w-full text-sm md:text-base"
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
                              className="input input-bordered w-full text-sm md:text-base"
                            />
                          )
                        ) : (
                          <p className="text-sm md:text-base leading-relaxed font-medium text-base-content/90 whitespace-pre-wrap">
                            {field.value || "—"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </KpiCardContainer>
            ))}
          </div>

          {/* Evidence & Attachments Section */}
          <div className="mt-8 border-t border-base-200 pt-8">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    Evidences &amp; Attachments
                  </h2>
                  <p className="text-xs text-base-content/50 mt-0.5">
                    {recapFiles?.filter(
                      (f) => f?.fileRecapCategory?.name != null,
                    ).length ?? 0}{" "}
                    file(s) across {categories.length} categor
                    {categories.length === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>
              {recap.uuid && (
                <RecapUploader
                  recapUuid={recap.uuid}
                  category="photo"
                  onUploaded={handlePhotoUploaded}
                />
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
                      className="group rounded-2xl border border-base-200 bg-base-100/50 shadow-sm overflow-hidden"
                      open
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 select-none hover:bg-base-200/40 transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-base-content">
                            {category.name}
                          </span>
                          <span className="text-[11px] text-base-content/50 font-medium">
                            {` · ${imageCount} image${imageCount !== 1 ? "s" : ""}`}
                            {pdfCount > 0
                              ? ` · ${pdfCount} PDF${pdfCount !== 1 ? "s" : ""}`
                              : ""}
                          </span>
                        </div>
                        {/* Chevron indicator */}
                        <svg
                          className="ml-auto h-5 w-5 shrink-0 text-base-content/30 transition-transform duration-300 group-open:rotate-180"
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

                      <div className="border-t border-base-200 p-4">
                        <div
                          className="grid gap-3"
                          style={{
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(160px, 1fr))",
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
                                className="group flex flex-col gap-1.5 rounded-xl border border-base-200 bg-base-100 p-2 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer"
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
                                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-base-200/60">
                                  {/* Per-file delete (admin). Hard-removes
                                      this file from the recap's Evidences
                                      gallery — for pulling a misfiled image
                                      (e.g. a receipt that landed under the
                                      wrong category). stopPropagation so the
                                      click doesn't also open the preview /
                                      a new tab. */}
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
                                    className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow transition hover:bg-error focus:opacity-100 group-hover:opacity-100 disabled:opacity-60"
                                  >
                                    {isDeletingFile &&
                                    deletingFileId === file.id ? (
                                      <span className="loading loading-spinner loading-xs" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  {isImage ? (
                                    convertingImageIds.includes(file.id) ? (
                                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-base-content/60">
                                        <span className="loading loading-spinner loading-md text-primary" />
                                      </div>
                                    ) : (
                                      <img
                                        src={
                                          imageSources[file.id] ||
                                          displaySrc(file)
                                        }
                                        alt={file.name || "Evidence"}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        onError={(event) => {
                                          const img = event.currentTarget;
                                          console.error("[HEIC] <img> failed", {
                                            fileId: file.id,
                                            fileName: file.name,
                                            originalUrl: file.url,
                                            resolvedSrc:
                                              imageSources[file.id] ||
                                              file.url ||
                                              "",
                                            currentSrc: img.currentSrc,
                                            complete: img.complete,
                                            naturalWidth: img.naturalWidth,
                                            naturalHeight: img.naturalHeight,
                                          });
                                        }}
                                      />
                                    )
                                  ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-base-content/30">
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
                                    <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-base-content shadow">
                                      {isImage ? "View" : "Open"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5 px-0.5">
                                  <span
                                    className="truncate text-xs font-semibold text-base-content leading-tight"
                                    title={file.name || ""}
                                  >
                                    {file.name || "Unnamed File"}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider ${
                                      recap.approved
                                        ? "text-success"
                                        : "text-warning"
                                    }`}
                                  >
                                    {statusLabel}
                                  </span>
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
              <div className="flex flex-col items-center justify-center p-16 bg-base-200/30 rounded-2xl border border-dashed border-base-300">
                <ImageIcon className="h-14 w-14 text-base-content/20 mb-3" />
                <p className="text-base-content/50 font-semibold">
                  No files or evidences attached.
                </p>
              </div>
            )}
          </div>
        </div>
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
    </Layout>
  );
};

export default RecapCustomView;
