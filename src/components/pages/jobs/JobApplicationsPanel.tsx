/**
 * Per-job applications panel — admin sees who's applied, with
 * accept/decline actions. Also exposes "Open to all" so a favorites-
 * gated job can be widened to the entire BA pool.
 */
import { Suspense } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAlertStore } from "@/store/alertStore";
import { JobApplicationsQuery } from "@/api/queries/JobApplicationsQuery";
import type { JobApplicationsQuery as JobApplicationsQueryType } from "@api/queries/__generated__/JobApplicationsQuery.graphql";
import {
  AssignAmbassadorToJobMutation,
  OpenJobToAllMutation,
} from "@/api/mutations/JobLifecycleMutations";
import type { JobLifecycleMutations_AssignMutation } from "@api/mutations/__generated__/JobLifecycleMutations_AssignMutation.graphql";
import type { JobLifecycleMutations_OpenJobToAllMutation } from "@api/mutations/__generated__/JobLifecycleMutations_OpenJobToAllMutation.graphql";

interface Props {
  jobId: string;
  lifecycleStatus: string;
  favoritesOnly: boolean;
}

export default function JobApplicationsPanel({
  jobId,
  lifecycleStatus,
  favoritesOnly,
}: Props) {
  return (
    <Suspense
      fallback={
        <div
          className="spark-card p-5 text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Loading applications…
        </div>
      }
    >
      <Inner
        jobId={jobId}
        lifecycleStatus={lifecycleStatus}
        favoritesOnly={favoritesOnly}
      />
    </Suspense>
  );
}

const Inner: React.FC<Props> = ({ jobId, lifecycleStatus, favoritesOnly }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<JobApplicationsQueryType>(
    JobApplicationsQuery,
    { jobId },
    { fetchPolicy: "network-only" },
  );
  const apps = data?.jobApplications ?? [];

  const [commitAssign, assigning] =
    useMutation<JobLifecycleMutations_AssignMutation>(
      AssignAmbassadorToJobMutation,
    );
  const [commitOpen, opening] =
    useMutation<JobLifecycleMutations_OpenJobToAllMutation>(
      OpenJobToAllMutation,
    );

  const isPostable = ["posted", "filled"].includes(
    (lifecycleStatus || "").toLowerCase(),
  );

  return (
    <div className="spark-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            APPLICATIONS · {apps.length}
          </p>
          <h2 className="display text-xl font-bold mt-1">
            Who's raised their hand
          </h2>
        </div>
        {favoritesOnly && isPostable && (
          <button
            disabled={opening}
            onClick={() => {
              if (!confirm("Open this job to every BA in the pool?")) return;
              commitOpen({
                variables: { input: { jobId } },
                onCompleted: (resp) => {
                  if (resp.openJobToAll?.success) {
                    showAlert("Opened to all BAs.", "success");
                    window.location.reload();
                  } else {
                    showAlert(
                      resp.openJobToAll?.message ?? "Open failed.",
                      "warning",
                    );
                  }
                },
                onError: (err) => showAlert(err.message, "error"),
              });
            }}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{
              background: "var(--spark-gold)",
              color: "#0a0d09",
              opacity: opening ? 0.5 : 1,
            }}
          >
            ★ Open to all BAs
          </button>
        )}
      </div>

      {apps.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          No applications yet. Favorites get first-look; widen the pool above
          if you need more applicants.
        </p>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => {
            const name =
              [a.ambassadorFirstName, a.ambassadorLastName]
                .filter(Boolean)
                .join(" ") ||
              a.ambassadorEmail ||
              "(unnamed)";
            const isAccepted = a.status === "accepted";
            const isDeclined = a.status === "declined";
            const isWithdrawn = a.status === "withdrawn";
            const isApplied = a.status === "applied";
            return (
              <div
                key={a.uuid}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {a.ambassadorEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: isAccepted
                        ? "var(--spark-lime)"
                        : isDeclined || isWithdrawn
                          ? "rgba(255,255,255,0.4)"
                          : "var(--spark-gold)",
                    }}
                  >
                    {a.status.toUpperCase()}
                  </span>
                  {isApplied && (
                    <button
                      disabled={assigning}
                      onClick={() => {
                        commitAssign({
                          variables: {
                            input: { jobId, ambassadorId: a.ambassadorUuid },
                          },
                          onCompleted: (resp) => {
                            if (resp.assignAmbassadorToJob?.success) {
                              showAlert(`Assigned ${name}.`, "success");
                              window.location.reload();
                            } else {
                              showAlert(
                                resp.assignAmbassadorToJob?.message ??
                                  "Assign failed.",
                                "warning",
                              );
                            }
                          },
                          onError: (err) => showAlert(err.message, "error"),
                        });
                      }}
                      className="px-3 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background: "var(--spark-lime)",
                        color: "#0a0d09",
                        opacity: assigning ? 0.5 : 1,
                      }}
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
