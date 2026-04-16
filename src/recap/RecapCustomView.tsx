import Layout from "@/layout/Layout";
import { GetCustomRecapQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQueryDetailsQuery as CustomRecapsQueryDetailsQueryType } from "@/api/queries/__generated__/CustomRecapsQueryDetailsQuery.graphql";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useParams, Link, useSearchParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate } from "@/utils";
import {
  ArrowLeftIcon,
  Calendar,
  ClipboardList,
  Goal,
  MapPin,
  Package,
  ShoppingCart,
  UserCheck,
  Users,
  List,
} from "lucide-react";
import { ImagePreviewModal } from "./components/ImagePreviewModal";

type Heic2AnyConverter = (options: {
  blob: Blob;
  toType?: string;
}) => Promise<Blob | Blob[]>;

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
              event,
            });
          }}
        />
      )}
    </figure>
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

const RecapCustomView = () => {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const data = useLazyLoadQuery<CustomRecapsQueryDetailsQueryType>(
    GetCustomRecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" },
  );

  const recap = data?.customRecap;
  const recapFiles = useMemo(() => recap?.customRecapFiles ?? [], [recap]);

  const backToListUrl = useMemo(() => {
    const pageRaw = Number(searchParams.get("fromPage") ?? "1");
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const after = searchParams.get("fromAfter");

    const params = new URLSearchParams();
    params.set("page", String(page));
    if (after) params.set("after", after);

    return `/recaps/custom-list?${params.toString()}`;
  }, [searchParams]);

  const isPdfFile = useCallback((file: (typeof recapFiles)[number]) => {
    const typeName = file.fileType?.name?.toLowerCase() ?? "";
    const url = file.url?.toLowerCase() ?? "";
    return typeName === "pdf" || url.endsWith(".pdf");
  }, []);

  const isImageFile = useCallback((file: (typeof recapFiles)[number]) => {
    const typeName = file.fileType?.name?.toLowerCase() ?? "";
    const url = file.url?.toLowerCase() ?? "";
    if (typeName === "image" || typeName === "img") return true;
    if (typeName === "pdf" || url.endsWith(".pdf")) return false;
    return /\.(jpg|jpeg|png|gif|heic|heif|webp)/i.test(url);
  }, []);

  const isHeicFile = useCallback((file: (typeof recapFiles)[number]) => {
    const url = file.url?.toLowerCase() ?? "";
    return url.endsWith(".heic") || url.endsWith(".heif");
  }, []);

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

  const customFieldsBySection = useMemo(() => {
    if (!recap?.customField) return [];
    const sections = new Map<string, typeof recap.customField>();
    
    recap.customField.forEach((field) => {
      const sectionName = field.recapSection?.name ?? "Other Details";
      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }
      sections.get(sectionName)!.push(field);
    });
    
    return Array.from(sections.entries()).map(([name, fields]) => ({
      name,
      fields
    }));
  }, [recap?.customField]);

  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const [convertingImageIds, setConvertingImageIds] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    const resolveImageSources = async () => {
      const heicFiles = flatImages.filter(isHeicFile);
      if (heicFiles.length === 0) {
        setImageSources(
          Object.fromEntries(flatImages.map((f) => [f.id, f.url ?? ""])),
        );
        return;
      }

      setConvertingImageIds(heicFiles.map((f) => f.id));

      const nextSources = await Promise.all(
        flatImages.map(async (file) => {
          const fallbackSrc = file.url ?? "";
          if (!fallbackSrc || !isHeicFile(file)) {
            return [file.id, fallbackSrc] as const;
          }

          try {
            const response = await fetch(fallbackSrc);
            const blob = await response.blob();
            const module = (await import("heic2any")) as {
              default: Heic2AnyConverter;
            };
            const converted = await module.default({
              blob,
              toType: "image/jpeg",
            });
            const convertedBlob = Array.isArray(converted)
              ? converted[0]
              : converted;
            const objectUrl = URL.createObjectURL(convertedBlob);
            objectUrls.push(objectUrl);
            return [file.id, objectUrl] as const;
          } catch (error) {
            console.error("Failed to convert HEIC", error);
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
  }, [flatImages, isHeicFile]);

  const currentPreview =
    flatImages && previewIndex !== null ? flatImages[previewIndex] : null;
  const currentPreviewSrc = currentPreview
    ? (imageSources[currentPreview.id] ?? currentPreview.url ?? "")
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
          KPI GRID
          ====================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <KpiCardContainer
              title="Information"
              icon={<Users className="text-primary" />}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center font-medium uppercase">
                    {recap.ambassador?.user?.firstName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {recap.ambassador?.user?.firstName}{" "}
                      {recap.ambassador?.user?.lastName}
                    </p>
                    <p className="text-sm text-base-content/60">Ambassador</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">Job</span>
                  <span className="font-medium">{recap.job?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-100/30">
                  <span className="text-sm">Retailer</span>
                  <span className="font-medium">
                    {recap.retailer?.name ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm">Submitted At</span>
                  <span className="font-medium">
                    {formatDate(recap.submittedAt ?? null)}
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
                  <span
                    className={`badge badge-soft ${recap.usedCorpoCard ? "badge-success" : "badge-ghost text-base-content/40"}`}
                  >
                    {recap.usedCorpoCard ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 border border-base-100/30 rounded-lg">
                  <span className="text-sm">Filling for Ambassador</span>
                  <span
                    className={`badge badge-soft ${recap.fillingForAmbassador ? "badge-info" : "badge-ghost text-base-content/40"}`}
                  >
                    {recap.fillingForAmbassador ? "Yes" : "No"}
                  </span>
                </div>
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
                    const isLongText = field.value && field.value.length > 50;
                    return (
                      <div
                        key={field.id}
                        className={`border border-base-100/30 rounded-xl p-4 space-y-2 bg-base-200/20 shadow-sm transition hover:border-primary/20 ${isLongText ? 'xl:col-span-2' : ''}`}
                      >
                        <p className="text-[11px] uppercase font-bold text-base-content/50 tracking-wider">
                          {field.name}
                        </p>
                        <p className="text-sm md:text-base leading-relaxed font-medium text-base-content/90 whitespace-pre-wrap">
                          {field.value || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </KpiCardContainer>
            ))}
          </div>

          <div className="card bg-base-300/50 mb-8">
            <div className="card-body space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xl font-bold">
                  <UserCheck className="w-6 h-6 text-primary" />
                  <h2>Event Gallery</h2>
                </div>
                <span className="text-sm text-base-content/60 font-medium">
                  {flatImages.length} photos
                </span>
              </div>

              {categoriesWithImages.length === 0 ? (
                <div className="alert alert-soft alert-info">
                  No evidence or files uploaded for this recap.
                </div>
              ) : (
                categoriesWithImages.map((category) => (
                  <div key={category.name} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold tracking-wide">
                        {category.name}
                      </h3>
                      <span className="badge badge-soft badge-primary">
                        {category.imageFiles.length} photos
                      </span>
                    </div>

                    {category.imageFiles.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {category.imageFiles.map((file) => {
                          const idxInFlat = flatImages.findIndex(
                            (img) => img.id === file.id,
                          );
                          return (
                            <Gallery3DCard
                              key={file.id}
                              src={imageSources[file.id] || file.url || ""}
                              alt={file.name || "Evidence"}
                              isLoading={convertingImageIds.includes(file.id)}
                              onClick={() => setPreviewIndex(idxInFlat)}
                            />
                          );
                        })}
                      </div>
                    )}

                    {category.pdfFiles.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-base-100/20">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-soft badge-secondary">
                            PDFs
                          </span>
                          <span className="text-xs uppercase text-base-content/40 font-bold">
                            {category.pdfFiles.length} Documents
                          </span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {category.pdfFiles.map((file) => (
                            <div
                              key={file.id}
                              className="border border-base-100/30 rounded-2xl p-4 space-y-3 bg-base-100/30"
                            >
                              <div className="flex items-center justify-between gap-3 px-2">
                                <p className="font-semibold text-sm truncate max-w-[70%]">
                                  {file.name || "PDF Document"}
                                </p>
                                <a
                                  className="btn btn-primary btn-xs rounded-full px-4"
                                  href={file.url ?? ""}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </a>
                              </div>
                              <div className="w-full aspect-4/3 rounded-xl overflow-hidden border border-base-300 bg-black/10">
                                <iframe
                                  src={file.url ?? ""}
                                  title={file.name || "PDF preview"}
                                  className="w-full h-full border-none"
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
        </div>
      </div>

      {currentPreview && (
        <ImagePreviewModal
          image={{
            name: currentPreview.name ?? "Evidence",
            file: currentPreviewSrc,
          }}
          onClose={() => setPreviewIndex(null)}
          onNext={() =>
            setPreviewIndex((prev) =>
              prev !== null ? (prev + 1) % flatImages.length : null,
            )
          }
          onPrev={() =>
            setPreviewIndex((prev) =>
              prev !== null
                ? (prev - 1 + flatImages.length) % flatImages.length
                : null,
            )
          }
        />
      )}
    </Layout>
  );
};

export default RecapCustomView;
