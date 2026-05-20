import { graphql } from "react-relay";

export const WingspanPayrollPeriodsQuery = graphql`
  query WingspanPayrollPeriodsQuery($limit: Int!) {
    wingspanStatus {
      connected
      message
    }
    wingspanPayrollPeriods(limit: $limit) {
      id
      label
      startsAt
      endsAt
      payDate
      status
      totalAmount
      contractorCount
    }
  }
`;
