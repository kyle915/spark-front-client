import { graphql } from "react-relay";

/**
 * Latest stored weekly narration. The weekly job writes the row; this
 * query never asks the model.
 */
export const TenantWeeklyNarrationQuery = graphql`
  query TenantWeeklyNarrationQuery($tenantId: ID!) {
    tenantWeeklyNarration(tenantId: $tenantId) {
      weekStart
      weekEnd
      body
      filedRecaps
      generatedAt
    }
  }
`;
