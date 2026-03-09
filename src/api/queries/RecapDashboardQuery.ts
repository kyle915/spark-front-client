import { graphql } from "react-relay";

export const RecapDashboardQuery = graphql`
  query RecapDashboardQuery($filters: RecapDashboardFiltersInput) {
    recapDashboard(filters: $filters) {
      metrics {
        totalConsumersSampled
        totalPurchases
        conversionRate
        revenueGenerated
        comparisonPeriod
        comparisonValues {
          totalConsumersSampled
          totalPurchases
          conversionRate
          revenueGenerated
        }
      }
      monthlyTrends {
        dataPoints {
          month
          consumersSampled
          purchases
          conversionRate
          revenue
          recapsCount
        }
      }
      performanceInsights {
        newCustomersSampled
        newCustomersPercentage
        brandAwareness
        brandAwarenessPercentage
        willingToPurchase
        highestWillingnessToBuy {
          marketName
          willingCount
        }
        strongestBrandAwareness {
          marketName
          brandAwareCount
        }
        topConvertingMarket {
          marketName
          conversionRate
        }
        willingToPurchasePercentage
        bestMonth {
          month
          recapsCount
          consumersCount
        }
        growthRate
      }
      marketAnalysis {
        dataPoints {
          marketId
          marketName
          consumers
          purchases
          conversion
          demos
          efficiency
        }
      }
      rmmPerformance {
        dataPoints {
          rmmId
          rmmName
          consumersSampled
          demos
          conversionRate
        }
      }
    }
    recapDashboardFilterOptions {
      distributors {
        id
        name
      }
      rmms {
        id
        name
        address
      }
      quarters {
        value
        label
      }
      tenants {
        id
        name
      }
    }
  }
`;
