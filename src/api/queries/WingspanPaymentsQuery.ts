import { graphql } from "react-relay";

export const WingspanPaymentsQuery = graphql`
  query WingspanPaymentsQuery($limit: Int!, $periodId: ID) {
    wingspanStatus {
      connected
      message
    }
    wingspanPayments(limit: $limit, periodId: $periodId) {
      id
      contractorName
      contractorEmail
      amount
      status
      payDate
      periodId
      memo
    }
  }
`;
