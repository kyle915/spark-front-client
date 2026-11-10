import { Suspense, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { MyReportSubscriptionQuery } from "@/api/queries/MyReportSubscriptionQuery";
import type { MyReportSubscriptionQuery as QueryType } from "@api/queries/__generated__/MyReportSubscriptionQuery.graphql";
import { SetMyReportSubscriptionMutation } from "@/api/mutations/SetMyReportSubscriptionMutation";
import type { SetMyReportSubscriptionMutation as MutationType } from "@api/mutations/__generated__/SetMyReportSubscriptionMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<QueryType>(
    MyReportSubscriptionQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );
  const [subscribed, setSubscribed] = useState<boolean>(Boolean(data.myReportSubscription));
  useEffect(() => {
    setSubscribed(Boolean(data.myReportSubscription));
  }, [data.myReportSubscription]);
  const [commit, saving] = useMutation<MutationType>(SetMyReportSubscriptionMutation);

  const toggle = () => {
    if (saving) return;
    const next = !subscribed;
    commit({
      variables: { input: { tenantId, subscribed: next } },
      onCompleted: (res) => {
        const r = res.setMyReportSubscription;
        if (r?.success) {
          setSubscribed(Boolean(r.subscribed));
          showAlert(r.message, "success");
        } else {
          showAlert(r?.message || "Couldn't update your subscription.", "error");
        }
      },
      onError: () => showAlert("Couldn't update your subscription.", "error"),
    });
  };

  return (
    <label
      className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
      title="Sent to your own email address at the start of each month. Only changes your subscription."
    >
      <input
        type="checkbox"
        role="switch"
        checked={subscribed}
        onChange={toggle}
        disabled={saving}
        className="w-4 h-4"
        style={{ accentColor: "var(--spark-lime)" }}
      />
      <span>Email me this report every month</span>
    </label>
  );
};

/**
 * Personal opt-in to the brand's monthly report email (needs the
 * myReportSubscription field on the server — spark-api #1354).
 */
export const ReportSubscriptionToggle: React.FC<{ tenantId: string | null }> = ({
  tenantId,
}) =>
  tenantId ? (
    <Suspense fallback={null}>
      <Inner tenantId={tenantId} />
    </Suspense>
  ) : null;

export default ReportSubscriptionToggle;
