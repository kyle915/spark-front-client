import { graphql } from "react-relay";

export const ActivationPlanQuery = graphql`
  query ActivationPlanQuery($id: ID, $uuid: String) {
    activationPlan(id: $id, uuid: $uuid) {
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
