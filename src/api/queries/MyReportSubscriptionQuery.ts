import { graphql } from "react-relay";

/** Is the signed-in person subscribed to this brand's monthly report email? */
export const MyReportSubscriptionQuery = graphql`
  query MyReportSubscriptionQuery($tenantId: ID) {
    myReportSubscription(tenantId: $tenantId)
  }
`;
