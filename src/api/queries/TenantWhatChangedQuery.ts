import { graphql } from "react-relay";

/**
 * One or two sentences comparing a window with the one before it. The
 * figures are worked out on the server from approved recaps; `text` is
 * empty when there are too few to compare. Its own query, so a slow or
 * failed load never touches the dashboard's main query.
 */
export const TenantWhatChangedQuery = graphql`
  query TenantWhatChangedQuery($tenantId: ID!, $startDate: String, $endDate: String) {
    tenantWhatChanged(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      text
      source
      previousStartDate
      previousEndDate
    }
  }
`;
