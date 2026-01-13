import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useParams, useNavigate, Link } from "react-router";
import { useMemo, useState } from "react";
import { formatDate, formatTime } from "@/utils";
import { ArrowLeftIcon, MapPinHouse } from "lucide-react";

const KpiCardContainer = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="card bg-base-300/50">
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
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const recapData = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const recap = recapData?.recap ?? null;

  const imageFiles = useMemo(
    () =>
      recap?.recapFiles.filter(
        (f) => f.file && !/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(f.file)
      ),
    [recap?.recapFiles]
  );

  // images by category
  const imagesByCategory = useMemo(() => {
    if (!imageFiles) return {};

    return imageFiles.reduce<Record<string, typeof imageFiles>>((acc, file) => {
      const categoryName = file.fileRecapCategory?.name ?? "Uncategorized";

      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }

      acc[categoryName].push(file);
      return acc;
    }, {});
  }, [imageFiles]);

  const flatImages = useMemo(
    () => Object.values(imagesByCategory).flat(),
    [imagesByCategory]
  );

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

  const storeManagers = recap.requestStoreManagers ?? [];
  const ambassadors = recap.ambassadors ?? [];

  // ======================================================
  // CONTROLS
  // ======================================================
  const closePreview = () => setPreviewIndex(null);

  // ======================================================
  // DATA NORMALIZATION FROM API
  // ======================================================

  // Consumers
  const totalConsumers = recap.consumerEngagements?.length ?? 0;

  // Sales
  const productsSold = recap.productsSold ?? 0;
  const totalEarnings = recap.totalEarnings ?? 0;

  // Feedback
  const hasConsumerFeedback = (recap.consumerFeedback?.length ?? 0) > 0;

  const hasAccountFeedback = (recap.accountFeedback?.length ?? 0) > 0;

  // Flags
  const hasSalesData =
    recap.productsSold !== null || recap.totalEarnings !== null;

  const currentPreview =
    flatImages && previewIndex !== null && flatImages[previewIndex];

  return (
    <Layout>
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-4 md:p-10 space-y-8">
          <div>
            <Link
              to="/recap/list"
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
                      <span className="i-lucide-calendar text-base-content/60" />
                      {formatDate(recap.event?.request?.date ?? null)}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="i-lucide-clock text-base-content/60" />
                      {formatTime(recap.event?.startTime ?? null)} –{" "}
                      {formatTime(recap.event?.endTime ?? null)}
                    </div>

                    {recap.event?.address && (
                      <div className="flex items-center gap-1">
                        <span className="i-lucide-map-pin text-base-content/60" />
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

                    {recap.event?.isNational && (
                      <span className="badge badge-soft badge-info">
                        <MapPinHouse className="w-4 h-4 mr-1" />
                        National Event
                      </span>
                    )}
                  </div>
                </div>

                {/* RIGHT – CTA */}
                <div className="flex items-start">
                  <button
                    className="btn btn-primary btn-sm rounded-full px-6"
                    onClick={() => navigate(`/recap/edit/${recap.uuid}`)}
                  >
                    Activation
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================
            KPI GRID
        ====================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <KpiCardContainer
              title="Performance Metrics"
              icon={<span className="i-lucide-award text-primary" />}
            >
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Event Type</span>
                  <span className="font-medium">
                    {recap.event?.eventType?.name ?? "—"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Scope</span>
                  <span className="font-medium">
                    {recap.event?.isNational ? "National" : "Local"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Approved</span>
                  <span className="font-medium">
                    {recap.approved ? "Yes" : "Pending"}
                  </span>
                </div>
              </div>
            </KpiCardContainer>

            <KpiCardContainer
              title="Event Team"
              icon={<span className="i-lucide-users text-primary" />}
            >
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-base-content/60 mb-2">
                    Store Manager
                  </p>
                  {storeManagers.map((m) => (
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
                  ))}
                </div>

                <div className="divider my-1" />

                <div>
                  <p className="text-xs uppercase text-base-content/60 mb-2">
                    Brand Ambassadors
                  </p>
                  {ambassadors.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <div>
                        {a.address && (
                          <p className="text-sm text-base-content/60">
                            {a.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </KpiCardContainer>

            <KpiCardContainer
              title="Sales Performance"
              icon={<span className="i-lucide-shopping-cart text-primary" />}
            >
              {!hasSalesData ? (
                <p className="text-sm text-base-content/60">
                  No sales data recorded for this event.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
                    <span className="text-sm">Products Sold</span>
                    <span className="text-xl font-bold">{productsSold}</span>
                  </div>

                  <div className="flex justify-between text-sm border rounded-lg p-3">
                    <span>Total Earnings</span>
                    <span className="font-medium">
                      ${totalEarnings.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </KpiCardContainer>

            <KpiCardContainer
              title="Consumer Engagement"
              icon={<span className="i-lucide-user-check text-primary" />}
            >
              {totalConsumers === 0 ? (
                <p className="text-sm text-base-content/60">
                  No consumer engagements recorded.
                </p>
              ) : (
                <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
                  <span className="text-sm">Total Consumers</span>
                  <span className="text-xl font-bold">{totalConsumers}</span>
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

              {Object.keys(imagesByCategory).length === 0 ? (
                <div className="alert alert-info">
                  No images uploaded for this recap.
                </div>
              ) : (
                Object.entries(imagesByCategory).map(
                  ([categoryName, files]) => (
                    <div key={categoryName} className="space-y-4">
                      {/* CATEGORY HEADER */}
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">
                          {categoryName}
                        </h3>
                        <span className="badge badge-outline">
                          {files.length}
                        </span>
                      </div>

                      {/* CATEGORY GRID */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {files.map((file) => {
                          const globalIndex = flatImages.findIndex(
                            (f) => f.id === file.id
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
                    </div>
                  )
                )
              )}
            </div>
          </div>

          {/* ======================================================
          FEEDBACK
      ====================================================== */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card bg-base-300/50 mb-6">
              <div className="card-body space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="i-lucide-message-square text-primary" />
                  Consumer Feedback
                </h3>

                {!hasConsumerFeedback ? (
                  <p className="text-sm text-base-content/60">
                    No consumer feedback recorded.
                  </p>
                ) : (
                  recap.consumerFeedback.map((f) => (
                    <p
                      key={f.id}
                      className="text-sm leading-relaxed text-base-content/80"
                    >
                      {f.feedback}
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className="card bg-base-300/50 mb-6">
              <div className="card-body space-y-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="i-lucide-clipboard-list text-primary" />
                  Account Learning
                </h3>

                {!hasAccountFeedback ? (
                  <p className="text-sm text-base-content/60">
                    No account feedback recorded.
                  </p>
                ) : (
                  recap.accountFeedback.map((item) => {
                    const hasFeedback = !!item.feedback;
                    const hasDoDifferently = !!item.doDifferentlyFeedback;
                    const hasCorpoCard = !!item.corpoCard;

                    if (!hasFeedback && !hasDoDifferently && !hasCorpoCard) {
                      return null;
                    }

                    return (
                      <div key={item.id} className="space-y-3">
                        {hasFeedback && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Feedback
                            </p>
                            <div className="border-l-2 border-primary pl-4 text-sm text-base-content/80">
                              {item.feedback}
                            </div>
                          </div>
                        )}

                        {hasDoDifferently && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Do differently next time
                            </p>
                            <div className="border-l-2 border-warning pl-4 text-sm text-base-content/80">
                              {item.doDifferentlyFeedback}
                            </div>
                          </div>
                        )}

                        {hasCorpoCard && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-base-content/60">
                              Corpo card
                            </p>
                            <div className="border-l-2 border-info pl-4 text-sm text-base-content/80">
                              {item.corpoCard}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ======================================================
          IMAGE PREVIEW MODAL
      ====================================================== */}
          {currentPreview && (
            <div className="modal modal-open">
              <div className="modal-box max-w-5xl">
                <div className="flex justify-between mb-3">
                  <h3 className="font-bold">{currentPreview.name}</h3>
                  <button className="btn btn-sm" onClick={closePreview}>
                    Close
                  </button>
                </div>
                <img
                  src={currentPreview.file ?? ""}
                  className="max-h-[70vh] mx-auto rounded-lg"
                />
              </div>
              <div className="modal-backdrop" onClick={closePreview} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RecapView;
