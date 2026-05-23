import { useState, Suspense } from "react";
import { useNavigate } from "react-router";
import { useMutation, useLazyLoadQuery, graphql } from "react-relay";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { ImportConnecteamRecapPdfMutation } from "@/api/mutations/ImportConnecteamRecapPdfMutation";
import type { ImportConnecteamRecapPdfMutation as ImportMutationType } from "@/api/mutations/__generated__/ImportConnecteamRecapPdfMutation.graphql";
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// Pull the templates for the currently selected tenant. Kyle's team
// switches tenants from the sidebar TenantPicker before importing, so
// the tenant in authStore is the right scope for templates here.
const TenantTemplatesQuery = graphql`
  query RecapImportConnecteam_TemplatesQuery($tenantId: ID!) {
    customRecapTemplates(filters: { tenantId: $tenantId }, first: 50) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
  }
`;

type Stat = {
  pdfLabel: string;
  pdfValue: string;
  fieldName: string | null;
  fieldId: string | null;
  score: number | null;
  skippedReason: string | null;
};

type LastImport = {
  recapUuid: string;
  matchedCount: number;
  unmatchedCount: number;
  stats: ReadonlyArray<Stat>;
};

function TemplatePicker({
  tenantId,
  value,
  onChange,
}: {
  tenantId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const data = useLazyLoadQuery<{
    response: {
      customRecapTemplates: {
        edges: { node: { id: string; uuid: string; name: string } }[];
      };
    };
    variables: { tenantId: string };
  }>(TenantTemplatesQuery, { tenantId }, { fetchPolicy: "network-only" });

  const templates = data.customRecapTemplates.edges.map((e) => e.node);

  if (templates.length === 0) {
    return (
      <p className="text-sm text-warning flex items-center gap-2 mt-1">
        <ExclamationTriangleIcon className="w-4 h-4" />
        No custom recap templates for this tenant. Create one first.
      </p>
    );
  }

  return (
    <select
      className="select select-bordered w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Pick a template</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export default function RecapImportConnecteam() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const { tenantId, tenantMeta } = useAuthStore();

  const [eventId, setEventId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastImport, setLastImport] = useState<LastImport | null>(null);

  const [commit, isInFlight] = useMutation<ImportMutationType>(
    ImportConnecteamRecapPdfMutation,
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId.trim()) {
      showAlert("Paste an event ID.", "warning");
      return;
    }
    if (!templateId) {
      showAlert("Pick a recap template.", "warning");
      return;
    }
    if (!file) {
      showAlert("Choose a Connecteam PDF.", "warning");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("File must be a PDF.", "warning");
      return;
    }

    // FileReader → data URL → base64 chunk. atob/btoa round-trips on
    // binary data corrupt non-ASCII bytes, so we let the browser
    // handle the encoding via readAsDataURL.
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) {
      showAlert("Couldn't read PDF contents.", "error");
      return;
    }

    commit({
      variables: {
        input: {
          eventId: eventId.trim(),
          customRecapTemplateId: templateId,
          pdfBase64: base64,
        },
      },
      onCompleted: (res) => {
        const payload = res.importConnecteamRecapPdf;
        if (!payload?.success) {
          showAlert(
            `Import failed: ${payload?.message ?? "Unknown error."}`,
            "error",
          );
          return;
        }
        setLastImport({
          recapUuid: String(payload.customRecap?.uuid ?? ""),
          matchedCount: payload.matchedCount,
          unmatchedCount: payload.unmatchedCount,
          stats: (payload.stats ?? []).map((s) => ({
            pdfLabel: s.pdfLabel,
            pdfValue: s.pdfValue,
            fieldName: s.fieldName ?? null,
            fieldId: s.fieldId ?? null,
            score: s.score ?? null,
            skippedReason: s.skippedReason ?? null,
          })),
        });
        showAlert(payload.message, "success");
      },
      onError: (err) => {
        showAlert(`Import failed: ${err.message}`, "error");
      },
    });
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <DocumentArrowUpIcon className="w-6 h-6" />
          </div>
          <h1>Import recap from Connecteam PDF</h1>
        </div>
        <p className="text-base-content/70">
          Drop a Connecteam-exported recap PDF here and we'll draft a
          Spark Custom Recap from it. Review and tweak before approving.
          Receipt photos still get uploaded manually on the draft.
        </p>
        <p className="text-xs text-base-content/50">
          Importing into tenant:{" "}
          <span className="font-medium">
            {tenantMeta?.requestUrlName ?? tenantId ?? "(none selected)"}
          </span>{" "}
          — switch tenants in the sidebar if you need a different one.
        </p>
      </div>

      {!tenantId ? (
        <p className="text-warning flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4" />
          Pick a tenant in the sidebar before importing.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-xl bg-base-100 p-5 shadow-sm border border-base-200 space-y-4 max-w-2xl"
        >
          <div>
            <label className="label-mini block mb-1.5">Event ID</label>
            <input
              type="text"
              className="input input-bordered w-full font-mono text-xs"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="paste from the Master Tracker row's URL"
            />
            <p className="text-xs mt-1 text-base-content/60">
              Open the event in the Master Tracker; the ID is the
              opaque string after <code>/event/view/</code>.
            </p>
          </div>

          <div>
            <label className="label-mini block mb-1.5">Recap template</label>
            <Suspense
              fallback={
                <div className="select select-bordered w-full opacity-50">
                  Loading templates…
                </div>
              }
            >
              <TemplatePicker
                tenantId={tenantId}
                value={templateId}
                onChange={setTemplateId}
              />
            </Suspense>
          </div>

          <div>
            <label className="label-mini block mb-1.5">Connecteam PDF</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="file-input file-input-bordered w-full"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs mt-1 text-base-content/60">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isInFlight || !eventId.trim() || !templateId || !file}
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              {isInFlight ? "Importing…" : "Import recap"}
            </button>
          </div>
        </form>
      )}

      {lastImport && (
        <div className="mt-6 rounded-xl bg-base-100 p-5 shadow-sm border border-base-200 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircleIcon className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold">Draft created</h2>
          </div>
          <p className="text-sm mb-3">
            <span className="text-success font-medium">
              {lastImport.matchedCount}
            </span>{" "}
            field{lastImport.matchedCount === 1 ? "" : "s"} imported ·{" "}
            <span className="text-warning font-medium">
              {lastImport.unmatchedCount}
            </span>{" "}
            unmatched · receipt photo to upload manually.
          </p>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                navigate(`/recap/view-custom/${lastImport.recapUuid}`)
              }
            >
              Open draft recap
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setLastImport(null);
                setFile(null);
              }}
            >
              Import another
            </button>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-base-content/70 hover:text-primary">
              Field mapping report ({lastImport.stats.length} rows)
            </summary>
            <div className="overflow-x-auto mt-2">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>PDF label</th>
                    <th>Mapped to</th>
                    <th>Value</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {lastImport.stats.map((s, i) => (
                    <tr key={i}>
                      <td className="font-mono">{s.pdfLabel}</td>
                      <td>
                        {s.fieldName ?? (
                          <span className="text-warning">— unmatched —</span>
                        )}
                        {s.score !== null && s.score < 1 && (
                          <span className="text-base-content/50 ml-1">
                            (fuzzy {s.score})
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs truncate" title={s.pdfValue}>
                        {s.pdfValue || (
                          <span className="text-base-content/40">empty</span>
                        )}
                      </td>
                      <td className="text-base-content/60">
                        {s.skippedReason ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </Layout>
  );
}
