import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useParams, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/utils";
import { MapPinHouse } from "lucide-react";

const KpiCardContainer = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="card bg-base-100 border border-base-300">
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
    <figure className="w-full h-80 overflow-hidden rounded-2xl bg-base-200">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
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

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">Recap id is missing.</div>
      </Layout>
    );
  }

  const recap = recapData.recap;
  if (!recap) {
    return (
      <Layout>
        <div className="alert alert-error">Recap not found.</div>
      </Layout>
    );
  }

  const storeManagers = recap.requestStoreManagers ?? [];
  const ambassadors = recap.ambassadors ?? [];

  const imageFiles = useMemo(
    () =>
      recap.recapFiles.filter(
        (f) => f.file && !/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(f.file)
      ),
    [recap.recapFiles]
  );

  // ======================================================
  // PREVIEW CONTROLS
  // ======================================================
  const openPreview = (idx: number) => setPreviewIndex(idx);
  const closePreview = () => setPreviewIndex(null);
  const goNext = () =>
    setPreviewIndex((i) => (i === null ? null : (i + 1) % imageFiles.length));
  const goPrev = () =>
    setPreviewIndex((i) =>
      i === null ? null : (i - 1 + imageFiles.length) % imageFiles.length
    );

  useEffect(() => {
    if (previewIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewIndex]);

  // ======================================================
  // MOCK KPI DATA (igual que antes)
  // ======================================================
  const hotData = {
    sales: 6,
    totalConsumers: 25,
    triedBefore: 15,
    competitor: "Long drink",
    feedback:
      "Grape was stated taste like dimetapp. Cranberry was liked a lot. Overall rating: 4/5.",
    account: [
      { label: "Anything you'd do differently", value: "Approach parking lot" },
      {
        label: "Account feedback",
        value: "Owner was very happy with Zero’s appearance.",
      },
      { label: "Corporate card used", value: "Yes" },
    ],
  };

  const currentPreview =
    previewIndex !== null ? imageFiles[previewIndex] : null;

  return (
    <Layout>
      {/* ======================================================
          HEADER
      ====================================================== */}
      <div className="card bg-base-100 border border-base-300 mb-8">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6  mb-8">
        <KpiCardContainer
          title="Performance Metrics"
          icon={<span className="i-lucide-award text-primary" />}
        >
          <div className="space-y-3">
            <p className="text-sm text-base-content/60">Overall Rating</p>

            <div className="flex items-center gap-2">
              <div className="flex text-warning">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <span className="text-xl font-bold">5.0</span>
            </div>

            <div className="divider my-2" />

            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">Event Type</span>
              <span className="font-medium">Activation</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">Scope</span>
              <span className="flex items-center gap-1 font-medium">
                <span className="i-lucide-globe" />
                National
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
                    <p className="text-sm text-base-content/60">{m.phone}</p>
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
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
              <span className="flex items-center gap-2 text-sm">
                <span className="i-lucide-box" />
                Products Sold
              </span>
              <span className="text-xl font-bold">{hotData.sales}</span>
            </div>

            <div className="flex justify-between text-sm border rounded-lg p-3">
              <span className="flex items-center gap-2">
                <span className="i-lucide-dollar-sign" />
                Case Price
              </span>
              <span className="font-medium">$24.00</span>
            </div>

            <div className="flex justify-between text-sm border rounded-lg p-3">
              <span className="flex items-center gap-2">
                <span className="i-lucide-dollar-sign" />
                Can Price
              </span>
              <span className="font-medium">$3.50</span>
            </div>
          </div>
        </KpiCardContainer>

        <KpiCardContainer
          title="Consumer Engagement"
          icon={<span className="i-lucide-user-check text-primary" />}
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-base-200 rounded-lg p-3">
              <span className="flex items-center gap-2 text-sm">
                <span className="i-lucide-users" />
                Total Consumers
              </span>
              <span className="text-xl font-bold">
                {hotData.totalConsumers}
              </span>
            </div>

            <div className="flex justify-between text-sm border rounded-lg p-3">
              <span className="flex items-center gap-2">
                <span className="i-lucide-user-plus" />
                Tried Before
              </span>
              <span className="font-medium">
                {hotData.triedBefore}{" "}
                <span className="text-base-content/60">
                  (
                  {Math.round(
                    (hotData.triedBefore / hotData.totalConsumers) * 100
                  )}
                  %)
                </span>
              </span>
            </div>

            <div className="flex justify-between text-sm border rounded-lg p-3">
              <span className="flex items-center gap-2">
                <span className="i-lucide-trending-up" />
                Competition
              </span>
              <span className="font-medium">{hotData.competitor}</span>
            </div>
          </div>
        </KpiCardContainer>
      </div>

      {/* ======================================================
          GALLERY
      ====================================================== */}
      <div className="card bg-base-100 border border-base-300 mb-8">
        <div className="card-body">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Event Gallery</h2>
            <span className="text-sm text-base-content/60">
              {imageFiles.length} photos
            </span>
          </div>

          {/* CONTENT */}
          {imageFiles.length === 0 ? (
            <div className="alert alert-info">
              No images uploaded for this recap.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {imageFiles.map((file, idx) => (
                <Gallery3DCard
                  key={file.id}
                  src={file.file ?? ""}
                  alt={file.name}
                  onClick={() => openPreview(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          FEEDBACK
      ====================================================== */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300 mb-6">
          <div className="card-body space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <span className="i-lucide-message-square text-primary" />
              Consumer Feedback
            </h3>

            <p className="text-sm leading-relaxed text-base-content/80">
              {hotData.feedback}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 mb-12">
          <div className="card-body space-y-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <span className="i-lucide-clipboard-list text-primary" />
              Account Learning
            </h3>

            {/* Anything you'd do differently */}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Anything you'd do differently?
              </p>
              <div className="border-l-2 border-primary pl-4 text-sm text-base-content/80">
                Set up approach customers in parking lot
              </div>
            </div>

            {/* Feedback from the account */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Feedback from the account</p>
              <div className="border-l-2 border-primary pl-4 text-sm text-base-content/80">
                The owner and company rep was very happy about Zero&apos;s
                appearance.
              </div>
            </div>

            {/* Corporate card */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Corporate card used</p>
              <div className="border-l-2 border-primary pl-4 text-sm text-base-content/80">
                Yes
              </div>
            </div>
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
    </Layout>
  );
};

export default RecapView;
