import React, { useEffect, useState } from "react";
import { useParams } from "react-router";

interface SharedVisitPayload {
  ok: boolean;
  error?: string;
  message?: string;
  resourceType?: string;
  brandName?: string;
  visit?: {
    uuid: string;
    storeLabel: string;
    visitDate: string;
    samplesDistributed: number | null;
    consumersSampled: number | null;
    repObservedUnits: number | null;
  };
}

function apiBaseUrl(): string {
  const gql = (import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined) ?? "";
  try {
    return new URL(gql).origin;
  } catch {
    return "";
  }
}

export const WorkspaceSharePublicPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedVisitPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiBaseUrl()}/api/public/workspace-share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json()) as SharedVisitPayload;
        if (!cancelled) {
          setData(body);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            ok: false,
            message: "Unable to load this shared recap link right now.",
          });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      className="min-h-[100dvh] py-10 px-4"
      style={{ background: "#faf7f1", color: "#1c1917" }}
    >
      <div
        className="max-w-xl mx-auto rounded-2xl p-6 md:p-8 shadow-sm space-y-5"
        style={{ background: "#ffffff", border: "1px solid #e7e5e4" }}
      >
        {loading ? (
          <p className="text-sm" style={{ color: "#57534e" }}>
            Loading shared field recap…
          </p>
        ) : !data?.ok ? (
          <div className="space-y-2">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#ef5a2a" }}
            >
              Link Unavailable
            </p>
            <h1 className="text-xl font-bold" style={{ color: "#1c1917" }}>
              This shared recap link is unavailable
            </h1>
            <p className="text-sm" style={{ color: "#57534e" }}>
              {data?.message || "This link has expired or was revoked by the brand workspace."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "#e7e5e4" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#57534e" }}>
                  Approved Field Activation Recap
                </p>
                <h1 className="text-2xl font-bold mt-1" style={{ color: "#1c1917" }}>
                  {data.brandName}
                </h1>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: "#ecfccb", color: "#365314" }}
              >
                Verified Visit
              </span>
            </div>

            {data.visit ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: "#78716c" }}>
                    Account / Store
                  </p>
                  <p className="text-lg font-semibold" style={{ color: "#1c1917" }}>
                    {data.visit.storeLabel}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#57534e" }}>
                    Visit Date: {data.visit.visitDate}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-3" style={{ background: "#fafaf9", border: "1px solid #e7e5e4" }}>
                    <p className="text-xs" style={{ color: "#78716c" }}>Samples</p>
                    <p className="text-xl font-bold mt-1" style={{ color: "#1c1917" }}>
                      {data.visit.samplesDistributed ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "#fafaf9", border: "1px solid #e7e5e4" }}>
                    <p className="text-xs" style={{ color: "#78716c" }}>Shoppers</p>
                    <p className="text-xl font-bold mt-1" style={{ color: "#1c1917" }}>
                      {data.visit.consumersSampled ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "#fafaf9", border: "1px solid #e7e5e4" }}>
                    <p className="text-xs" style={{ color: "#78716c" }}>Observed Units</p>
                    <p className="text-xl font-bold mt-1" style={{ color: "#1c1917" }}>
                      {data.visit.repObservedUnits ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <p className="text-xs pt-2" style={{ color: "#78716c" }}>
              Shared from {data.brandName}&apos;s Spark workspace · Revocable read-only link
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSharePublicPage;
