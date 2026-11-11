import { Component, Suspense, type ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RecapReviewChecksQuery } from "@/api/queries/RecapReviewChecksQuery";
import type { RecapReviewChecksQuery as QueryType } from "@api/queries/__generated__/RecapReviewChecksQuery.graphql";
import { photoTrustLine } from "./photoTrust";

const Inner: React.FC<{ recapId: string; isCustom: boolean }> = ({ recapId, isCustom }) => {
  const data = useLazyLoadQuery<QueryType>(
    RecapReviewChecksQuery,
    { recapId, isCustom },
    { fetchPolicy: "store-or-network" },
  );
  const line = photoTrustLine(data?.recapReviewChecks);
  if (!line) return null;
  return (
    <p
      className="text-sm inline-flex items-center gap-2"
      style={{ color: "var(--spark-text-secondary)" }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
        style={{ border: "1px solid var(--spark-border)" }}
      >
        ✓
      </span>
      {line}
    </p>
  );
};

/** A broken check must never break the recap page. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Client-facing trust line under a recap's photos: shown only when Spark's
 * duplicate check passed. Clients never see a flag here — a flagged recap
 * is a staff matter, handled in the review panel before sign-off.
 */
const RecapPhotoTrust: React.FC<{ recapId: string; isCustom: boolean }> = (props) => (
  <Quiet>
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  </Quiet>
);

export default RecapPhotoTrust;
