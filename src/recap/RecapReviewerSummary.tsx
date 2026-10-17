import { useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RecapReviewerSummaryQuery } from "@/api/queries/RecapReviewerSummaryQuery";
import type { RecapReviewerSummaryQuery as RecapReviewerSummaryQueryType } from "@/api/queries/__generated__/RecapReviewerSummaryQuery.graphql";
import { SummarizeRecapMutation } from "@/api/mutations/SummarizeRecapMutation";
import type { SummarizeRecapMutation as SummarizeRecapMutationType } from "@/api/mutations/__generated__/SummarizeRecapMutation.graphql";
import {
  RecapReviewerSummaryCard,
  type ReviewerSummaryData,
} from "@/recap/RecapReviewerSummaryCard";

/**
 * Loads the ops reviewer note for one recap detail page. Mount this in the
 * admin chrome around RecapDocument, not inside the paper.
 */
function RecapReviewerSummaryInner({
  recapId,
  isCustom,
  needsReview,
}: {
  recapId: string;
  isCustom: boolean;
  needsReview: boolean;
}) {
  const data = useLazyLoadQuery<RecapReviewerSummaryQueryType>(
    RecapReviewerSummaryQuery,
    { recapId, isCustom, generateIfMissing: needsReview },
    { fetchPolicy: "store-or-network" },
  );
  const [commit, inFlight] = useMutation<SummarizeRecapMutationType>(
    SummarizeRecapMutation,
  );
  const [override, setOverride] = useState<ReviewerSummaryData | null>(null);
  const summary = override ?? data.recapReviewerSummary;
  if (!summary) return null;

  return (
    <RecapReviewerSummaryCard
      summary={summary}
      summarizing={inFlight}
      onSummarize={() => {
        commit({
          variables: { recapId, isCustom },
          onCompleted: (res) => {
            if (res.summarizeRecap) setOverride(res.summarizeRecap);
          },
        });
      }}
    />
  );
}

export default function RecapReviewerSummary(props: {
  recapId: string;
  isCustom: boolean;
  needsReview: boolean;
}) {
  return <RecapReviewerSummaryInner {...props} />;
}
