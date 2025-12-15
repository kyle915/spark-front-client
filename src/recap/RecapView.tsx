import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import { FileTypesQuery } from "@/api/queries/FileTypesQuery";
import type { FileTypesQuery as FileTypesQueryType } from "@api/queries/__generated__/FileTypesQuery.graphql";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useParams, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/utils";

// ======================================================
// SMALL COMPONENTS
// ======================================================
const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-base-content/60">
      {label}
    </p>
    <p className="text-base font-medium">{value ?? "-"}</p>
  </div>
);

const KpiCard = ({
  label,
  value,
  color = "text-base-content",
}: {
  label: string;
  value: string | number;
  color?: string;
}) => (
  <div className="card bg-base-200">
    <div className="card-body">
      <p className="text-sm text-base-content/60">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
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

  const fileTypesData = useLazyLoadQuery<FileTypesQueryType>(
    FileTypesQuery,
    {},
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

  const fileTypeLabels = useMemo(() => {
    const map = new Map<string, string>();
    fileTypesData.fileTypes.edges.forEach(({ node }) =>
      map.set(node.id, node.name)
    );
    return map;
  }, [fileTypesData.fileTypes.edges]);

  const imageFiles = useMemo(
    () =>
      recap.recapFiles.filter(
        (f) => f.file && !/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(f.file)
      ),
    [recap.recapFiles]
  );

  const filesByType = useMemo(() => {
    const grouped = new Map<string, typeof recap.recapFiles>();
    recap.recapFiles.forEach((file) => {
      const label = fileTypeLabels.get(file.fileTypeId) ?? "Other";
      grouped.set(label, [...(grouped.get(label) ?? []), file]);
    });
    return Array.from(grouped.entries());
  }, [fileTypeLabels, recap.recapFiles]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">{recap.name}</h1>
          <p className="text-sm text-base-content/60">
            {recap.event?.name} ·{" "}
            {formatDate(recap.event?.request?.date ?? null)} ·{" "}
            {formatTime(recap.event?.startTime ?? null)} –{" "}
            {formatTime(recap.event?.endTime ?? null)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-outline">
            {recap.event?.eventType?.name}
          </span>
          {recap.event?.isNational && (
            <span className="badge badge-warning">National</span>
          )}
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

      {/* ======================================================
          EVENT SUMMARY
      ====================================================== */}
      <div className="card bg-base-100 border border-base-300 mb-8">
        <div className="card-body space-y-4">
          <h2 className="text-lg font-semibold">Event Summary</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <InfoItem label="Event" value={recap.event?.name} />
            <InfoItem label="Address" value={recap.event?.address} />
            <InfoItem label="Type" value={recap.event?.eventType?.name} />
          </div>
          {recap.event?.notes && (
            <div className="rounded-lg bg-base-200 p-3 text-sm">
              {recap.event.notes}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          KPI SECTION
      ====================================================== */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KpiCard
          label="Products Sold"
          value={hotData.sales}
          color="text-primary"
        />
        <KpiCard label="Total Consumers" value={hotData.totalConsumers} />
        <KpiCard
          label="Tried Before"
          value={hotData.triedBefore}
          color="text-purple-500"
        />
        <KpiCard
          label="Competitive Presence"
          value={hotData.competitor}
          color="text-warning"
        />
      </div>

      {/* ======================================================
          PEOPLE
      ====================================================== */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body space-y-3">
            <h2 className="text-lg font-semibold">Store Managers</h2>
            {storeManagers.map((m) => (
              <div key={m.id} className="rounded-lg bg-base-200 p-3 text-sm">
                <p className="font-medium">{m.name}</p>
                <p className="text-base-content/70">{m.phone}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body space-y-3">
            <h2 className="text-lg font-semibold">Ambassadors</h2>
            {ambassadors.map((a) => (
              <div key={a.id} className="rounded-lg bg-base-200 p-3">
                <div className="flex justify-between">
                  <p className="font-medium">{a.name}</p>
                  <span className="badge badge-primary">Rating {a.rating}</span>
                </div>
                {a.address && (
                  <p className="text-sm text-base-content/70">{a.address}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================
          FEEDBACK
      ====================================================== */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-2">Consumer Feedback</h2>
            <div className="italic text-sm bg-base-200 p-4 rounded-lg">
              “{hotData.feedback}”
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-2">Account Learnings</h2>
            <div className="space-y-2 text-sm">
              {hotData.account.map((a) => (
                <p key={a.label}>
                  <strong>{a.label}:</strong> {a.value}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILES
      ====================================================== */}
      <h2 className="text-xl font-semibold mb-3">Evidence & Files</h2>
      {filesByType.map(([type, files]) => (
        <div key={type} className="mb-6">
          <p className="font-medium mb-2">{type}</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="card bg-base-200 cursor-pointer"
                onClick={() => {
                  const idx = imageFiles.findIndex((f) => f.id === file.id);
                  if (idx >= 0) openPreview(idx);
                }}
              >
                <div className="card-body text-sm">{file.name}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

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
