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
//

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
  onClick,
}: {
  src: string;
  alt: string;
  onClick?: () => void;
}) => (
  <div className="hover-3d cursor-pointer" onClick={onClick}>
    {/* content */}
    <figure className="w-full aspect-4/3 overflow-hidden rounded-2xl bg-base-200">
      <img src={src} alt={alt} className="w-full h-full object-contain" />
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
    const page = Number.isFinite(pageRaw) && pageRaw > 0
      ? Math.floor(pageRaw)
      : 1;
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

  // ======================================================
  // CATEGORIES
  // ======================================================

  type RecapFile = (typeof recapFiles)[number];

  const categories = useMemo(() => {
    if (recapFiles.length === 0) return [];

    const categoryMap = new Map<string, { name: string; files: RecapFile[] }>();

    recapFiles.forEach((file) => {
      const categoryName = file.fileRecapCategory?.name ?? "Uncategorized";

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { name: categoryName, files: [] });
      }

      categoryMap.get(categoryName)!.files.push(file);
    });

    return Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
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

  if (!recap) {
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

            <KpiCardContainer
              title="Ammbassadors"
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

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm border rounded-lg p-3">
                      <span>First-time Consumers</span>
                      <span className="font-medium">{firstTimeConsumers}</span>
                    </div>
                    <div className="flex justify-between text-sm border rounded-lg p-3">
                      <span>Brand Aware Consumers</span>
                      <span className="font-medium">{brandAwareConsumers}</span>
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
                </>
              )}
            </KpiCardContainer>

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
                      className="border border-base-200 rounded-xl p-4 space-y-1"
                    >
                      {/* PRODUCT NAME */}
                      <p className="font-semibold">
                        {item.product?.name ?? "—"}
                      </p>

                      {/* TYPE */}
                      <p className="text-sm text-base-content/60">
                        Type: {item.typeOfGood?.name ?? "—"}
                      </p>

                      {/* PRICE */}
                      <p className="text-sm">
                        Price:{" "}
                        <span className="font-medium">
                          ${Number(item.price ?? 0).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </KpiCardContainer>

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
                      className="border border-base-200 rounded-xl p-4 space-y-1"
                    >
                      {/* PRODUCT NAME */}
                      <p className="font-semibold">
                        {item.product?.name ?? "—"}
                      </p>

                      {/* QUANTITY */}
                      <p className="text-sm text-base-content/60">
                        Quantity:{" "}
                        <span className="font-medium">
                          {item.quantity ?? 0}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </KpiCardContainer>
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
                              src={file.file ?? ""}
                              alt={file.name}
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
                    const hasCorpoCard = !!item.corpoCard;

                    if (!hasFeedback && !hasDoDifferently && !hasCorpoCard) {
                      return null;
                    }

                    return (
                      <div
                        key={item.id}
                        className="border border-base-200 rounded-xl p-4 space-y-3"
                      >
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

                        {hasDoDifferently && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Do differently next time
                            </p>
                            <p className="text-sm text-base-content/80">
                              {item.doDifferentlyFeedback}
                            </p>
                          </div>
                        )}

                        {hasCorpoCard && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Corporate card used
                            </p>
                            <p className="text-sm text-base-content/80">
                              {item.corpoCard}
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
          </div>

          {/* ======================================================
          IMAGE PREVIEW MODAL
      ====================================================== */}
          {currentPreview && (
            <ImagePreviewModal
              image={{
                name: currentPreview.name,
                file: currentPreview.file ?? "",
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
