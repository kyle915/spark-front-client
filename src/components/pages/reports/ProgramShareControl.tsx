import { Suspense, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { ProgramShareLinkQuery } from "@/api/queries/ProgramShareLinkQuery";
import type { ProgramShareLinkQuery as QueryType } from "@api/queries/__generated__/ProgramShareLinkQuery.graphql";
import { SetProgramShareEnabledMutation } from "@/api/mutations/SetProgramShareEnabledMutation";
import type { SetProgramShareEnabledMutation as MutationType } from "@api/mutations/__generated__/SetProgramShareEnabledMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { clientOrigin } from "@/utils/publicHosts";
import { programLinkUrl } from "@/public/program/programShare";

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<QueryType>(
    ProgramShareLinkQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const [enabled, setEnabled] = useState(Boolean(data.programShareLink.enabled));
  const [token, setToken] = useState<string | null>(data.programShareLink.token ?? null);
  useEffect(() => {
    setEnabled(Boolean(data.programShareLink.enabled));
    setToken(data.programShareLink.token ?? null);
  }, [data.programShareLink.enabled, data.programShareLink.token]);
  const [commit, saving] = useMutation<MutationType>(SetProgramShareEnabledMutation);
  const [confirming, setConfirming] = useState(false);

  const set = (next: boolean) => {
    setConfirming(false);
    commit({
      variables: { input: { tenantId, enabled: next } },
      onCompleted: (res) => {
        const r = res.setProgramShareEnabled;
        if (r?.success) {
          setEnabled(Boolean(r.enabled));
          setToken(r.token ?? null);
          showAlert(r.message, "success");
        } else {
          showAlert(r?.message || "Couldn't update the program link.", "error");
        }
      },
      onError: () => showAlert("Couldn't update the program link.", "error"),
    });
  };

  const url = enabled && token ? programLinkUrl(clientOrigin(), token) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Program link copied.", "success");
    } catch {
      showAlert("Couldn't copy — select the link and copy it.", "error");
    }
  };

  const btn = {
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
  } as const;

  return (
    <section className="spark-card p-4" aria-label="Public program link">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Public program link</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
            {enabled
              ? "On — anyone with the link can see program totals, states and field photos. No ambassador names, receipts or spend."
              : "Off. Turn it on to share a live page of totals, states and field photos with people who don't have a Spark login."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled ? (
            <>
              <button
                type="button"
                onClick={copy}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={() => set(false)}
                disabled={saving}
                className="px-3 py-1.5 rounded-xl text-sm disabled:opacity-50"
                style={btn}
              >
                Turn off
              </button>
            </>
          ) : confirming ? (
            <>
              <button
                type="button"
                onClick={() => set(true)}
                disabled={saving}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
              >
                Yes, make it public
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded-xl text-sm"
                style={btn}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-3 py-1.5 rounded-xl text-sm"
              style={btn}
            >
              Turn on
            </button>
          )}
        </div>
      </div>
      {url ? (
        <p
          className="mono text-xs mt-3 break-all select-all"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {url}
        </p>
      ) : null}
    </section>
  );
};

/**
 * Opt-in public page for the brand's program (needs spark-api #1358).
 * Turning it on is a deliberate two-step: it publishes program totals to
 * anyone holding the link. Turning it off revokes every shared link.
 */
const ProgramShareControl: React.FC<{ tenantId: string | null }> = ({ tenantId }) =>
  tenantId ? (
    <Suspense fallback={null}>
      <Inner tenantId={tenantId} />
    </Suspense>
  ) : null;

export default ProgramShareControl;
