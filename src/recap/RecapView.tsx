import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import { GenerateRecapPdfMutation } from "@api/mutations/GenerateRecapPdfMutation";
import type { GenerateRecapPdfMutation as GenerateRecapPdfMutationType } from "@api/mutations/__generated__/GenerateRecapPdfMutation.graphql";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useParams, Link, useSearchParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, formatLocalDateTime } from "@/utils";
import {
  ArrowLeftIcon,
  Calendar,
  ClipboardList,
  Clock,
  Goal,
  MapPin,
  MapPinHouse,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Store,
  UserCheck,
  Users,
} from "lucide-react";
import { useAlertStore } from "@store/alertStore";
import { ImagePreviewModal } from "./components/ImagePreviewModal";

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

const Gallery3DCard = ({
  src,
  alt,
  debugName,
  isLoading,
  onClick,
}: {
  src: string;
  alt: string;
  debugName?: string;
  isLoading?: boolean;
  onClick?: () => void;
}) => (
  <div className="hover-3d cursor-pointer" onClick={onClick}>
    {/* content */}
    <figure className="w-full aspect-4/3 overflow-hidden rounded-2xl bg-base-200">
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-base-300/40">
          <div className="flex flex-col items-center gap-3 text-base-content/60">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Loading image...</span>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={(event) => {
            console.error("Gallery image failed to render", {
              debugName,
              src,
              currentSrc: event.currentTarget.currentSrc,
              naturalWidth: event.currentTarget.naturalWidth,
              naturalHeight: event.currentTarget.naturalHeight,
            });
          }}
        />
      )}
    </figure>

    {/* 8 empty divs required for DaisyUI 3D */}
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
);

// ======================================================
// PAGE
// ======================================================
const RecapView = () => {
  // ======================================================
  // PARAMS & STATE
  // ======================================================

  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const showAlert = useAlertStore((state) => state.showAlert);

  const [commitGeneratePdf, isExporting] =
    useMutation<GenerateRecapPdfMutationType>(GenerateRecapPdfMutation);

  // ======================================================
  // DATA FETCH
  // ======================================================

  const recapData = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" },
  );

  const recap = recapData?.recap ?? null;
  const recapFiles = useMemo(() => recap?.recapFiles ?? [], [recap]);

  const backToListUrl = useMemo(() => {
    const pageRaw = Number(searchParams.get("fromPage") ?? "1");
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const after = searchParams.get("fromAfter");

    const params = new URLSearchParams();
    params.set("page", String(page));
    if (after) params.set("after", after);

    return `/recap/list?${params.toString()}`;
  }, [searchParams]);

  // ======================================================
  // FILE HELPERS
  // ======================================================

  const getFileLabel = useCallback(
    (file: (typeof recapFiles)[number]) =>
      `${file.file ?? ""} ${file.name ?? ""}`,
    [],
  );

  const isPdfFile = useCallback(
    (file: (typeof recapFiles)[number]) => {
      if (!file.file) return false;
      const extension = file.fileType?.extension?.toLowerCase() ?? "";
      if (extension) return extension === "pdf";
      return /\.pdf$/i.test(getFileLabel(file));
    },
    [getFileLabel],
  );

  const isImageFile = useCallback(
    (file: (typeof recapFiles)[number]) => {
      if (!file.file) return false;
      const extension = file.fileType?.extension?.toLowerCase() ?? "";
      if (extension) return extension === "img";
      return !/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(getFileLabel(file));
    },
    [getFileLabel],
  );

  const isHeicFile = useCallback(
    (file: (typeof recapFiles)[number]) => {
      if (!file.file) return false;
      const extension = file.fileType?.extension?.toLowerCase() ?? "";
      const label = getFileLabel(file);

      if (extension === "heic" || extension === "heif") return true;
      if (/\.(heic|heif)(?:$|[?#])/i.test(label)) return true;

      return false;
    },
    [getFileLabel],
  );

  // ======================================================
  // CATEGORIES
  // ======================================================

  type RecapFile = (typeof recapFiles)[number];

  const categories = useMemo(() => {
    if (recapFiles.length === 0) return [];

    const categoryMap = new Map<string, { name: string; files: RecapFile[] }>();
    const preferredOrder = [
      "sampling photos",
      "table setup",
      "retailer photos",
    ];
    const preferredOrderIndex = new Map(
      preferredOrder.map((name, index) => [name, index]),
    );

    recapFiles.forEach((file) => {
      const categoryName = file.fileRecapCategory?.name ?? "Uncategorized";

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { name: categoryName, files: [] });
      }

      categoryMap.get(categoryName)!.files.push(file);
    });

    return Array.from(categoryMap.values()).sort((a, b) => {
      const aName = a.name.trim().toLowerCase();
      const bName = b.name.trim().toLowerCase();

      if (aName === "receipts" && bName !== "receipts") return 1;
      if (bName === "receipts" && aName !== "receipts") return -1;

      const aPreferredIndex = preferredOrderIndex.get(aName);
      const bPreferredIndex = preferredOrderIndex.get(bName);

      if (aPreferredIndex !== undefined && bPreferredIndex !== undefined) {
        return aPreferredIndex - bPreferredIndex;
      }

      if (aPreferredIndex !== undefined) return -1;
      if (bPreferredIndex !== undefined) return 1;

      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
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
  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const [convertingImageIds, setConvertingImageIds] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    const resolveImageSources = async () => {
      const heicImageIds = flatImages
        .filter((file) => isHeicFile(file))
        .map((file) => file.id);

      setConvertingImageIds(heicImageIds);

      const nextSources = await Promise.all(
        flatImages.map(async (file) => {
          const fallbackSrc = file.file ?? "";
          const heicDetected = isHeicFile(file);

          console.info("Recap image resolution started", {
            fileId: file.id,
            fileName: file.name,
            fileUrl: fallbackSrc,
            fileTypeExtension: file.fileType?.extension ?? null,
            heicDetected,
          });

          if (!fallbackSrc || !heicDetected) {
            return [file.id, fallbackSrc] as const;
          }

          try {
            const response = await fetch(fallbackSrc);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch HEIC image: ${response.status} ${response.statusText}`,
              );
            }

            const blob = await response.blob();
            const module = (await import("libheif-js/wasm-bundle")) as
              | LibHeifModule
              | { default: LibHeifModule };
            const libheif =
              "default" in module ? module.default : module;

            const buffer = await blob.arrayBuffer();
            const decoder = new libheif.HeifDecoder();
            const images = decoder.decode(new Uint8Array(buffer));
            const image = images[0];
            if (!image) throw new Error("No HEIC image frames decoded");

            const width = image.get_width();
            const height = image.get_height();
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas 2D context unavailable");

            const imageData = context.createImageData(width, height);
            await new Promise<void>((resolve, reject) => {
              image.display(imageData, (displayData) => {
                if (!displayData) {
                  reject(new Error("HEIF processing error"));
                  return;
                }

                context.putImageData(displayData, 0, 0);
                resolve();
              });
            });

            const convertedBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((canvasBlob) => {
                if (!canvasBlob) {
                  reject(new Error("Failed to create JPEG blob"));
                  return;
                }
                resolve(canvasBlob);
              }, "image/jpeg");
            });
            image.free?.();

            const objectUrl = URL.createObjectURL(convertedBlob);
            objectUrls.push(objectUrl);

            console.info("HEIC image converted successfully", {
              fileId: file.id,
              fileName: file.name,
              originalUrl: fallbackSrc,
              convertedType: convertedBlob.type,
              convertedSize: convertedBlob.size,
              objectUrl,
            });

            return [file.id, objectUrl] as const;
          } catch (error) {
            const normalizedError =
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : error;

            console.error("Failed to convert HEIC image", {
              fileId: file.id,
              fileName: file.name,
              fileUrl: fallbackSrc,
              fileTypeExtension: file.fileType?.extension ?? null,
              error: normalizedError,
            });
            return [file.id, fallbackSrc] as const;
          }
        }),
      );

      if (isCancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setImageSources(Object.fromEntries(nextSources));
      setConvertingImageIds([]);
    };

    void resolveImageSources();

    return () => {
      isCancelled = true;
      setConvertingImageIds([]);
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [flatImages, isHeicFile]);

  // ======================================================
  // IMAGE CONTROLS
  // ======================================================

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

  // ======================================================
  // EXPORT PDF
  // ======================================================

  const handleExportPdf = useCallback(() => {
    if (!recap?.id) return;

    commitGeneratePdf({
      variables: { input: { id: recap.id } },
      onCompleted: (response) => {
        const payload = response.generateRecapPdf;

        if (payload.success) {
          const fileUrl = payload.recapFile?.file;

          if (fileUrl) {
            const newTab = window.open(
              fileUrl,
              "_blank",
              "noopener,noreferrer",
            );

            if (!newTab) {
              window.location.assign(fileUrl);
              showAlert("Popup blocked. Opened PDF in this tab.", "warning");
            } else {
              showAlert(
                payload.message ?? "PDF generated successfully",
                "success",
              );
            }
          } else {
            showAlert("PDF generated but file URL is missing", "warning");
          }
        } else {
          showAlert(payload.message ?? "Failed to generate PDF", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  }, [commitGeneratePdf, recap?.id, showAlert]);

  // ======================================================
  // EARLY RETURNS
  // ======================================================

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">Recap id is missing.</div>
      </Layout>
    );
  }

  if (!recap || !recap.approved) {
    return (
      <Layout>
        <div className="alert alert-error">Recap not found.</div>
      </Layout>
    );
  }

  // ======================================================
  // DATA NORMALIZATION
  // ======================================================

  const storeManagers = recap.requestStoreManagers ?? [];
  const ambassadors = recap.ambassadors ?? [];

  const engagement = recap.consumerEngagements?.[0] ?? null;
  const totalConsumers = engagement?.totalConsumer ?? 0;
  const firstTimeConsumers = engagement?.firstTimeConsumers ?? 0;
  const brandAwareConsumers = engagement?.brandAwareConsumers ?? 0;
  const willingToPurchase = engagement?.willingToPurchaseConsumers ?? 0;
  const notWillingToPurchase = engagement?.notWillingConsumers ?? 0;

  const totalEngagements = recap.totalEngagements ?? 0;
  const accountSpend = recap.accountSpendAmount;
  const statusLabel = recap.approved ? "Approved" : "Pending";
  const tenantSlug = recap.event?.tenant?.slug?.toLowerCase() ?? "";
  const isTotalWirelessTenant = tenantSlug === "total-wireless";
  const canViewMarketContext =
    tenantSlug === "begoat" || tenantSlug === "zeroes";
  const hasMarketContext =
    !!recap.trafficDescription || !!recap.competitivePresence;

  const productsSold = recap.productsSold ?? 0;
  const totalCansSold = recap.totalCansSold ?? 0;
  const totalPacksSold = recap.totalPacksSold ?? 0;
  // const totalEarnings = recap.totalEarnings ?? 0;

  const hasSalesData =
    recap.productsSold !== null ||
    recap.totalCansSold !== null ||
    recap.totalPacksSold !== null;
  // recap.totalEarnings !== null;

  const currentPreview =
    flatImages && previewIndex !== null ? flatImages[previewIndex] : null;
  const currentPreviewSrc = currentPreview
    ? (imageSources[currentPreview.id] ?? currentPreview.file ?? "")
    : "";

  return (
    <Layout>
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-4 md:p-10 space-y-8">
          <div>
            <Link
              to={backToListUrl}
              className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to list
            </Link>
          </div>
          {/* ======================================================
          HEADER
      ====================================================== */}
          <div className="card bg-base-300/50 border border-base-300 mb-8">
            <div className="card-body">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                {/* LEFT */}
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">{recap.name}</h1>

                  <p className="text-sm text-base-content/60">
                    Event Recap Summary
                  </p>

                  {/* META INFO */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/70">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(
                        recap.event?.date ?? recap.event?.request?.date ?? null,
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatLocalDateTime(recap.event?.startTime ?? null, {
                        hour12: true,
                      })}{" "}
                      –{" "}
                      {formatLocalDateTime(recap.event?.endTime ?? null, {
                        hour12: true,
                      })}
                    </div>

                    {recap.event?.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {recap.event.address}
                      </div>
                    )}
                  </div>

                  {/* BADGES */}
                  <div className="flex items-center gap-2 pt-2">
                    {recap.event?.eventType?.name && (
                      <span className="badge badge-outline">
                        {recap.event.eventType.name}
                      </span>
                    )}

                    {recap.event?.isNational ? (
                      <span className="badge badge-soft badge-info">
                        <MapPinHouse className="w-4 h-4 mr-1" />
                        National Event
                      </span>
                    ) : (
                      <span className="badge badge-soft badge-info">
                        <MapPin className="w-4 h-4 mr-1" />
                        No National Event
                      </span>
                    )}

                    {/* Status */}
                    <div className="badge badge-soft badge-success">
                      {statusLabel}
                    </div>
                  </div>
                </div>

                {/* RIGHT – CTA */}
                <div className="flex items-center gap-3">
                  <button
                    className="btn btn-outline btn-sm rounded-full px-6"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <span className="loading loading-spinner loading-xs mr-2" />
                        Exporting...
                      </>
                    ) : (
                      "Export PDF"
                    )}
                  </button>

                  {/* <button
                    className="btn btn-primary btn-sm rounded-full px-6"
                  onClick={() => navigate(`/recap/edit/${recap.uuid}`)}
                  disabled={isExporting}
                  >
                    Activation
                  </button> */}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================
            KPI GRID
        ====================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {!isTotalWirelessTenant && (
              <KpiCardContainer
                title="Store Managers"
                icon={<Store className="text-primary" />}
              >
                <div>
                  {storeManagers.length === 0 ? (
                    <p className="text-sm text-base-content/60">
                      No store managers linked to this recap.
                    </p>
                  ) : (
                    storeManagers.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-medium">
                          {m.name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-sm text-base-content/60">
                            {m.phone}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </KpiCardContainer>
            )}

            <KpiCardContainer
              title="Ambassadors"
              icon={<Users className="text-primary" />}
            >
              <div>
                {ambassadors.length === 0 ? (
                  <p className="text-sm text-base-content/60">
                    No ambassadors linked to this recap.
                  </p>
                ) : (
                  ambassadors.map((a) => {
                    const fullName =
                      `${a.user?.firstName ?? ""} ${a.user?.lastName ?? ""}`.trim() ||
                      "Ambassador";

                    const rating = a.rating ?? 0;

                    return (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-3 mb-3"
                      >
                        {/* LEFT */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{fullName}</p>

                          {a.address && (
                            <p className="text-sm text-base-content/60 whitespace-pre-line">
                              {a.address}
                            </p>
                          )}
                        </div>

                        {/* RIGHT – RATING */}
                        {rating > 0 && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: rating }).map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 fill-warning text-warning"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </KpiCardContainer>

            {!isTotalWirelessTenant && (
              <KpiCardContainer
                title="KPIs "
                icon={<Goal className="text-primary" />}
              >
                {!hasSalesData ? (
                  <p className="text-sm text-base-content/60">
                    No sales data recorded for this event.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
                      <span className="text-sm">Total Engagements</span>
                      <span className="text-xl font-bold">
                        {totalEngagements}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Products Sold</span>
                        <span className="font-medium">{productsSold}</span>
                      </div>
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Total Cans Sold</span>
                        <span className="font-medium">{totalCansSold}</span>
                      </div>
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Total Packs Sold</span>
                        <span className="font-medium">{totalPacksSold}</span>
                      </div>
                      {/* <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Total Earnings</span>
                        <span className="font-medium">
                          ${totalEarnings.toFixed(2)}
                        </span>
                      </div> */}
                      {accountSpend !== null ? (
                        <div className="flex justify-between text-sm border rounded-lg p-3">
                          <span>Account Spend</span>
                          <span className="font-medium">
                            ${accountSpend?.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm border rounded-lg p-3">
                          <span>Account Spend</span>
                          <span className="font-medium">
                            <em className="text-base-content/60">N/A</em>
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </KpiCardContainer>
            )}

            <KpiCardContainer
              title="Consumer Engagement"
              icon={<UserCheck className="text-primary" />}
            >
              {totalConsumers === 0 ? (
                <p className="text-sm text-base-content/60">
                  No consumer engagements recorded.
                </p>
              ) : (
                <>
                  <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
                    <span className="text-sm">Total Consumers</span>
                    <span className="text-xl font-bold">{totalConsumers}</span>
                  </div>

                  {!isTotalWirelessTenant && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>First-time Consumers</span>
                        <span className="font-medium">
                          {firstTimeConsumers}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Brand Aware Consumers</span>
                        <span className="font-medium">
                          {brandAwareConsumers}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Willing to Purchase</span>
                        <span className="font-medium">{willingToPurchase}</span>
                      </div>
                      <div className="flex justify-between text-sm border rounded-lg p-3">
                        <span>Not Willing to Purchase</span>
                        <span className="font-medium">
                          {notWillingToPurchase}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </KpiCardContainer>

            {!isTotalWirelessTenant && (
              <KpiCardContainer
                title="Sales Performance"
                className="col-span-2"
                icon={<ShoppingCart className="text-primary" />}
              >
                {(recap.salesPerformance?.length ?? 0) === 0 ? (
                  <p className="text-sm text-base-content/60">
                    No sales performance recorded for this event.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recap.salesPerformance.map((item) => (
                      <div
                        key={item.id}
                        className="border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {item.product?.image && (
                            <div className="w-12 h-12 bg-white rounded-lg p-1">
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <p className="font-semibold">
                            {item.product?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-base-content/60">
                            Type: {item.typeOfGood?.name ?? "—"}
                          </span>
                          <span className="font-bold text-primary">
                            ${item.price?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </KpiCardContainer>
            )}

            {!isTotalWirelessTenant && (
              <KpiCardContainer
                title="Product Samples"
                className="col-span-2"
                icon={<Package className="text-primary" />}
              >
                {(recap.productSamples?.length ?? 0) === 0 ? (
                  <p className="text-sm text-base-content/60">
                    No product samples recorded for this event.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recap.productSamples.map((item) => (
                      <div
                        key={item.id}
                        className="border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm transition hover:border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          {item.product?.image && (
                            <div className="w-12 h-12 bg-white rounded-lg p-1">
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <p className="font-semibold">
                            {item.product?.name ?? "—"}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2">
                          <span className="text-base-content/60">
                            Quantity Distributed
                          </span>
                          <span className="badge badge-primary badge-sm font-bold">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </KpiCardContainer>
            )}
          </div>

          {/* ======================================================
          FEEDBACK
      ====================================================== */}
          <div className="grid lg:grid-cols-2 gap-6">
            <KpiCardContainer
              title="Account Feedback"
              icon={<ClipboardList className="text-primary" />}
            >
              {(recap.accountFeedback?.length ?? 0) === 0 ? (
                <p className="text-sm text-base-content/60">
                  No account feedback recorded for this event.
                </p>
              ) : (
                <div className="space-y-4">
                  {recap.accountFeedback.map((item) => {
                    const hasFeedback = !!item.feedback;
                    const hasDoDifferently = !!item.doDifferentlyFeedback;
                    const hasCorpoCard = !!item.wasCorpoCardUsed;

                    if (!hasFeedback && !hasDoDifferently && !hasCorpoCard) {
                      return null;
                    }

                    return (
                      <div
                        key={item.id}
                        className="border border-base-200 rounded-xl p-4 space-y-3"
                      >
                        {hasDoDifferently && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              What would have been done differently?
                            </p>
                            <p className="text-sm text-base-content/80">
                              {item.doDifferentlyFeedback}
                            </p>
                          </div>
                        )}

                        {hasCorpoCard && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Was Corporate Card Used?
                            </p>
                            <p className="text-sm text-base-content/80">
                              {item.wasCorpoCardUsed ? "Yes" : "No"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </KpiCardContainer>

            <KpiCardContainer
              title="Consumer Feedback"
              icon={<MessageSquare className="text-primary" />}
            >
              {(recap.consumerFeedback?.length ?? 0) === 0 ? (
                <p className="text-sm text-base-content/60">
                  No consumer feedback recorded for this event.
                </p>
              ) : (
                <div className="space-y-4">
                  {recap.consumerFeedback.map((item) => {
                    const hasFeedback = !!item.feedback;
                    const hasQuotes = !!item.quotes;

                    if (!hasFeedback && !hasQuotes) {
                      return null;
                    }

                    return (
                      <div
                        key={item.id}
                        className="border border-base-200 rounded-xl p-4 space-y-2"
                      >
                        {/* FEEDBACK */}
                        {hasFeedback && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Feedback
                            </p>
                            <p className="text-sm text-base-content/80">
                              {item.feedback}
                            </p>
                          </div>
                        )}

                        {/* QUOTES */}
                        {hasQuotes && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Quotes
                            </p>
                            <div className="border-l-2 border-primary pl-4 text-sm text-base-content/80 italic">
                              {item.quotes}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </KpiCardContainer>

            {canViewMarketContext && (
              <KpiCardContainer
                title="Market Context"
                icon={<MapPinHouse className="text-primary" />}
              >
                {!hasMarketContext ? (
                  <p className="text-sm text-base-content/60">
                    No market context recorded for this event.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recap.trafficDescription && (
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-base-content/60">
                          Traffic Description
                        </p>
                        <p className="text-sm text-base-content/80">
                          {recap.trafficDescription}
                        </p>
                      </div>
                    )}

                    {recap.competitivePresence && (
                      <div className="space-y-1">
                        <p className="text-xs uppercase text-base-content/60">
                          Competitive Presence
                        </p>
                        <p className="text-sm text-base-content/80">
                          {recap.competitivePresence}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </KpiCardContainer>
            )}
          </div>

          {/* ======================================================
          GALLERY
      ====================================================== */}

          <div className="card bg-base-300/50 mb-8">
            <div className="card-body space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Event Gallery</h2>
                <span className="text-sm text-base-content/60">
                  {flatImages.length} photos
                </span>
              </div>

              {categoriesWithImages.length === 0 ? (
                <div className="alert alert-info">
                  No images uploaded for this recap.
                </div>
              ) : (
                categoriesWithImages.map((category) => (
                  <div key={category.name} className="space-y-4">
                    {/* CATEGORY HEADER */}
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                      <span className="badge badge-outline">
                        {category.imageFiles.length}
                      </span>
                    </div>

                    {category.imageFiles.length === 0 ? (
                      <p className="text-sm text-base-content/60">
                        No images in this category.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {category.imageFiles.map((file) => {
                          const globalIndex = flatImages.findIndex(
                            (f) => f.id === file.id,
                          );

                          return (
                            <Gallery3DCard
                              key={file.id}
                              src={imageSources[file.id] ?? file.file ?? ""}
                              alt={file.name}
                              debugName={file.name}
                              isLoading={
                                isHeicFile(file) &&
                                !imageSources[file.id] &&
                                convertingImageIds.includes(file.id)
                              }
                              onClick={() => setPreviewIndex(globalIndex)}
                            />
                          );
                        })}
                      </div>
                    )}

                    {category.pdfFiles.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-base font-semibold">PDFs</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {category.pdfFiles.map((file) => (
                            <div
                              key={file.id}
                              className="border border-base-200 rounded-xl p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium">
                                  {file.name || "PDF"}
                                </p>
                                <a
                                  className="btn btn-outline btn-xs rounded-full"
                                  href={file.file ?? ""}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </a>
                              </div>
                              <div className="w-full aspect-4/3 rounded-lg overflow-hidden border border-base-300 bg-base-100">
                                <iframe
                                  src={file.file ?? ""}
                                  title={file.name || "PDF preview"}
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ======================================================
          IMAGE PREVIEW MODAL
      ====================================================== */}
          {currentPreview && (
            <ImagePreviewModal
              image={{
                name: currentPreview.name,
                file: currentPreviewSrc,
              }}
              onClose={closePreview}
              onNext={goNext}
              onPrev={goPrev}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RecapView;
