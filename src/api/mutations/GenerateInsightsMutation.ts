import { graphql } from "react-relay";
import type { MutationParameters } from "relay-runtime";

export const GenerateInsightsMutation = graphql`
  mutation GenerateInsightsMutation(
    $tenantId: ID
    $fromDate: String
    $toDate: String
    $enqueue: Boolean!
  ) {
    generateInsights(
      tenantId: $tenantId
      fromDate: $fromDate
      toDate: $toDate
      enqueue: $enqueue
    ) {
      success
      enqueued
      insights {
        id
      }
    }
  }
`;

export interface GenerateInsightsMutationType extends MutationParameters {
  response: {
    readonly generateInsights: {
      readonly success: boolean;
      readonly enqueued: boolean;
      readonly insights: {
        readonly id: string;
      } | null;
    };
  };
  variables: {
    tenantId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    enqueue: boolean;
  };
}
