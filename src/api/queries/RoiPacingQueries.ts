import { graphql } from "react-relay";

export const RoiPacingPageQuery = graphql`
  query RoiPacingQueriesPageQuery(
    $month: String
    $groupBy: String!
    $sortBy: String!
  ) {
    demoBudgetPacingAndLeaderboard(
      month: $month
      groupBy: $groupBy
      sortBy: $sortBy
    ) {
      month
      monthEnd
      targetAmount
      spentAmount
      committedAmount
      projectedAmount
      elapsedDays
      daysInMonth
      elapsedPct
      expectedSpendToDate
      paceStatus
      paceNote
      visitCount
      incompleteCostVisits
      canEditBudget
      groupBy
      sortBy
      targets {
        uuid
        scopeType
        scopeKey
        scopeLabel
        targetAmount
        notes
      }
      leaderboard {
        groupKey
        groupLabel
        visitCount
        demoDollars
        units
        salesDollars
        unitsPerDollar
        revenuePerDollar
        note
      }
    }
  }
`;

export const TodayAttentionQueueQuery = graphql`
  query RoiPacingQueriesTodayAttentionQueueQuery {
    todayAttentionQueue {
      totalCount
      buckets {
        key
        label
        count
        items {
          bucket
          title
          subtitle
          severity
          actionUrl
          actionLabel
          refId
        }
      }
    }
  }
`;
