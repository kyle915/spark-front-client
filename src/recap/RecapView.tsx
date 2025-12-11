import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import { FileTypesQuery } from "@/api/queries/FileTypesQuery";
import type { FileTypesQuery as FileTypesQueryType } from "@api/queries/__generated__/FileTypesQuery.graphql";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useParams, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/utils";

type InfoItemProps = {
  label: string;
  value: string | null | undefined;
};

const InfoItem = ({ label, value }: InfoItemProps) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs uppercase tracking-wide text-base-content/60">
      {label}
    </span>
    <span className="text-base font-medium">{value ?? "-"}</span>
  </div>
);

type RecapFileCardProps = {
  name: string;
  file?: string | null;
  createdAt?: string | null;
  onPreview?: () => void;
};

const RecapFileCard = ({
  name,
  file,
  createdAt,
  onPreview,
}: RecapFileCardProps) => {
  const [canPreviewImage, setCanPreviewImage] = useState(true);

  const isLikelyDocument = useMemo(() => {
    if (!file) return false;
    return /\.(pdf|docx?|xlsx?|csv|txt)$/i.test(file);
  }, [file]);

  // Backend already returns a signed URL in the file field.
  const displayUrl = file ?? undefined;
  const showImage = Boolean(displayUrl) && !isLikelyDocument && canPreviewImage;

  const handleCardClick = () => {
    if (showImage && displayUrl && onPreview) {
      onPreview();
    }
  };

  return (
    <div
      className={`card bg-base-200 shadow-md ${
        showImage ? "cursor-pointer hover:shadow-xl transition" : ""
      }`}
      onClick={handleCardClick}
    >
      <div className="card-body space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="card-title text-base">{name}</h3>
        </div>
        {showImage ? (
          <div className="w-full h-48 bg-base-100 rounded-lg border border-base-300 flex items-center justify-center overflow-hidden">
            <img
              src={displayUrl}
              alt={name}
              className="max-h-full max-w-full object-contain"
              onError={() => setCanPreviewImage(false)}
            />
          </div>
        ) : (
          <p className="text-sm text-base-content/70 break-all">
            {displayUrl ?? "Unable to load file URL"}
          </p>
        )}
        <div className="text-sm text-base-content/70 flex flex-wrap gap-3">
          <span>Uploaded: {formatDate(createdAt ?? null)}</span>
        </div>
      </div>
    </div>
  );
};

const RecapView = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const recapData = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );
  const fileTypesData = useLazyLoadQuery<FileTypesQueryType>(
    FileTypesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Recap id is missing.</span>
        </div>
      </Layout>
    );
  }

  const recap = recapData.recap;
  const storeManagers = recap?.requestStoreManagers ?? [];
  const ambassadors = recap?.ambassadors ?? [];
  const fileTypeLabels = useMemo(() => {
    const map = new Map<string, string>();
    fileTypesData.fileTypes.edges.forEach(({ node }) => {
      map.set(node.id, node.name);
    });
    return map;
  }, [fileTypesData.fileTypes.edges]);

  if (!recap) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Recap not found.</span>
        </div>
      </Layout>
    );
  }

  const imageFiles = useMemo(
    () =>
      recap.recapFiles.filter((file) => {
        const url = file.file ?? "";
        return url && !/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(url);
      }),
    [recap.recapFiles]
  );

  const filesByType = useMemo(() => {
    const grouped = new Map<string, typeof recap.recapFiles>();
    recap.recapFiles.forEach((file) => {
      const label = fileTypeLabels.get(file.fileTypeId) ?? "Other";
      const current = grouped.get(label) ?? [];
      grouped.set(label, [...current, file]);
    });

    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fileTypeLabels, recap.recapFiles]);

  const openPreview = useCallback(
    (index: number) => {
      if (index < 0 || index >= imageFiles.length) return;
      setPreviewIndex(index);
    },
    [imageFiles.length]
  );

  const closePreview = useCallback(() => setPreviewIndex(null), []);

  const goNext = useCallback(() => {
    if (previewIndex === null || imageFiles.length === 0) return;
    setPreviewIndex((previewIndex + 1) % imageFiles.length);
  }, [imageFiles.length, previewIndex]);

  const goPrev = useCallback(() => {
    if (previewIndex === null || imageFiles.length === 0) return;
    setPreviewIndex((previewIndex - 1 + imageFiles.length) % imageFiles.length);
  }, [imageFiles.length, previewIndex]);

  useEffect(() => {
    if (previewIndex === null) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewIndex, goNext, goPrev]);

  const currentPreview =
    previewIndex !== null ? imageFiles[previewIndex] : null;

  const hotData = useMemo(
    () => ({
      salesPerformance: {
        productsPurchased: 6,
      },
      productPricing: {
        casePrice: "$24.00",
        canPrice: "$3.50",
      },
      consumerEngagement: {
        total: 25,
        triedBefore: 15,
        competitivePresence: "Long drink",
      },
      feedback: {
        consumer:
          "Grape was stated taste like dimeatapp. Cranberry was liked alot as well as raspberry. Power tasted like a generic red bull. Overall the drink received 4 out of 5 stars",
        account: [
          {
            label: "Anything you'd do differently?",
            value: "Set up approach customers in parking lot",
          },
          {
            label: "Feedback from the account",
            value:
              "The owner and company rep was very happy about Zeros appearance.",
          },
          { label: "Corporate card used", value: "Yes" },
        ],
      },
    }),
    []
  );

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{recap.name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/recap/edit/${recap.uuid}`)}
          >
            Edit
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card recap-card col-span-12">
          <div className="card-body space-y-3">
            <h2 className="card-title text-lg">Recap Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem label="Name" value={recap.name} />
              <InfoItem label="Event" value={recap.event?.name} />
              <InfoItem
                label="Event Date"
                value={formatDate(recap.event?.request?.date ?? null)}
              />
              <InfoItem
                label="Event Start"
                value={formatTime(recap.event?.startTime ?? null)}
              />
              <InfoItem
                label="Event End"
                value={formatTime(recap.event?.endTime ?? null)}
              />
              <InfoItem label="Address" value={recap.event?.address} />
              <InfoItem
                label="National"
                value={recap.event?.isNational ? "Yes" : "No"}
              />
              <InfoItem
                label="Event Type"
                value={recap.event?.eventType?.name}
              />
            </div>
            {recap.event?.notes ? (
              <div className="mt-2">
                <p className="text-xs uppercase tracking-wide text-base-content/60 mb-1">
                  Event Notes
                </p>
                <div className="rounded-lg border border-base-300 bg-base-100 p-3 text-sm text-base-content/80">
                  {recap.event.notes}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card recap-card col-span-12 lg:col-span-6">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">Store Managers</h2>
            </div>
            {storeManagers.length === 0 ? (
              <p className="text-sm text-base-content/70">
                No store managers linked to this recap.
              </p>
            ) : (
              <div className="space-y-3">
                {storeManagers.map((manager) => (
                  <div
                    key={manager.id}
                    className="rounded-lg border border-base-300 bg-base-100 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{manager.name}</p>
                    </div>
                    <p className="text-sm text-base-content/80">
                      Phone:{" "}
                      <a href={`tel:${manager.phone}`} className="link">
                        {manager.phone}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card recap-card col-span-12 lg:col-span-6">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">Ambassadors</h2>
            </div>
            {ambassadors.length === 0 ? (
              <p className="text-sm text-base-content/70">
                No ambassadors added to this recap.
              </p>
            ) : (
              <div className="space-y-3">
                {ambassadors.map((ambassador) => (
                  <div
                    key={ambassador.id}
                    className="rounded-lg border border-base-300 bg-base-100 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Ambassador: Tyler Jenkins</p>
                      <span className="badge badge-primary badge-sm">
                        Rating {ambassador.rating}
                      </span>
                    </div>
                    {ambassador.address ? (
                      <p className="text-sm text-base-content/80">
                        Address: {ambassador.address}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Sales Performance</h2>
          <div className="divider my-0" />
          <div className="space-y-1">
            <p className="text-sm text-base-content/70">Products purchased:</p>
            <p className="text-3xl font-bold text-primary">
              {hotData.salesPerformance.productsPurchased}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Product Information</h2>
          <div className="divider my-0" />
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-base-300 bg-base-200 p-3">
                <p className="text-sm text-base-content/70">Price per case</p>
                <p className="text-2xl font-semibold">
                  {hotData.productPricing.casePrice}
                </p>
              </div>
              <div className="rounded-lg border border-base-300 bg-base-200 p-3">
                <p className="text-sm text-base-content/70">Price per can</p>
                <p className="text-2xl font-semibold">
                  {hotData.productPricing.canPrice}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Consumer Engagement</h2>
          <div className="divider my-0" />
          <div className="grid gap-6 md:grid-cols-3 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Total consumers:</p>
              <p className="text-3xl font-bold text-primary">
                {hotData.consumerEngagement.total}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Consumers who tried brand before:</p>
              <p className="text-3xl font-bold text-purple-500">
                {hotData.consumerEngagement.triedBefore}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Competitive presence:</p>
              <p className="text-2xl font-semibold text-warning">
                {hotData.consumerEngagement.competitivePresence}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">
            Feedback &amp; Account Notes
          </h2>
          <div className="divider my-0" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Consumer feedback &amp; quotes
              </p>
              <div className="rounded-xl border border-base-300 bg-base-200 p-3 text-sm text-base-content/80">
                {hotData.feedback.consumer}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Account feedback</p>
              <div className="rounded-xl border border-base-300 bg-base-200 p-3 space-y-2 text-sm text-base-content/80">
                {hotData.feedback.account.map((item) => (
                  <p key={item.label}>
                    <span className="font-semibold">{item.label}: </span>
                    <span>{item.value}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Files</h2>
          <span className="text-sm text-base-content/70">
            {recap.recapFiles.length} file(s)
          </span>
        </div>

        {recap.recapFiles.length === 0 ? (
          <div className="alert alert-info">
            <span>No files uploaded for this recap.</span>
          </div>
        ) : (
          <div className="space-y-5">
            {filesByType.map(([typeName, files]) => (
              <div key={typeName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{typeName}</h3>
                  <span className="text-xs text-base-content/70">
                    {files.length} file(s)
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {files.map((file) => (
                    <RecapFileCard
                      key={file.id}
                      name={file.name}
                      file={file.file}
                      createdAt={file.createdAt}
                      onPreview={() => {
                        const idx = imageFiles.findIndex(
                          (img) => img.id === file.id
                        );
                        if (idx >= 0) openPreview(idx);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentPreview ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-5xl h-[90vh] p-4 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg truncate">
                {currentPreview.name}
              </h3>
              <button className="btn btn-sm btn-ghost" onClick={closePreview}>
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  className="btn btn-circle btn-sm btn-ghost"
                  onClick={goPrev}
                  aria-label="Previous"
                >
                  ←
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  className="btn btn-circle btn-sm btn-ghost"
                  onClick={goNext}
                  aria-label="Next"
                >
                  →
                </button>
              </div>
              <div className="h-full w-full overflow-auto flex items-center justify-center px-10">
                <img
                  src={currentPreview.file ?? ""}
                  alt={currentPreview.name}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closePreview} />
        </div>
      ) : null}
    </Layout>
  );
};

export default RecapView;
