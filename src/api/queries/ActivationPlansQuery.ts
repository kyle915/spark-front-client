import { graphql } from "react-relay";

export const ActivationPlansQuery = graphql`
  query ActivationPlansQuery($tenantId: ID, $first: Int) {
    activationPlans(tenantId: $tenantId, first: $first) {
      id
      uuid
      name
      conceptBrief
      startDate
      endDate
      markets
      requestCount
      pipeline {
        planned
        approved
        staffed
        executed
        verified
      }
    }
  }
`;
