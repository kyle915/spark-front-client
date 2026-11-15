import { graphql } from "react-relay";

export const EventDashboardQuery = graphql`
  query EventDashboardQuery($filters: EventDashboardFiltersInput) {
    eventDashboard(filters: $filters) {
      globalKpis {
        singleCansSold
        multiPacksSold
        packCansEquivalent
        productsSold
        byRmm {
          rmmId
          rmmName
          singleCansSold
          multiPacksSold
        }
      }
      metrics {
        totalEvents
        consumersSampled
        brandAwareness
        purchaseIntent
        brandAwarenessBase
        purchaseIntentBase
        comparisonPeriod
        comparisonValues {
          totalEvents
          consumersSampled
          brandAwareness
          purchaseIntent
        }
      }
      monthlyTrends {
        dataPoints {
          month
          consumersSampled
          willingToPurchase
          conversionRate
          eventsCount
        }
      }
      performanceInsights {
        knewAboutBrand
        knewAboutBrandPercentage
        willingToPurchase
        willingToPurchasePercentage
        bestMonth {
          month
          eventsCount
          consumersCount
        }
        growthRate
      }
      goalsProgress {
        name
        target
        current
        percentageComplete
      }
      recentEvents {
        id
        name
        date
        location
        consumers
        intentRate
        status
      }
    }
    eventDashboardFilterOptions {
      distributors {
        id
        name
      }
      rmms {
        id
        name
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
