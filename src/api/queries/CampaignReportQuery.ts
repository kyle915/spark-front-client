import { graphql } from "react-relay";

/**
 * Branded campaign report for a single Request (a brand activation).
 *
 * Powers the authenticated admin report view (/report-view/:requestId).
 * Selects every field the shared <CampaignReportView> renders — KPI tiles,
 * the event table, photo gallery, activation map / location list, BA roster
 * and consumer-quote highlights — plus the `shareToken` used to build the
 * public link and Download-PDF URL.
 *
 * The public shareable page (/report/:token) renders the SAME view but
 * fetches the report from the no-auth REST endpoint instead of this query,
 * so the only field it can't see is `shareToken`.
 */
export const CampaignReportQuery = graphql`
  query CampaignReportQuery($requestId: ID!) {
    campaignReport(requestId: $requestId) {
      requestId
      brandName
      title
      dateRange
      generatedAt
      shareToken
      kpis {
        events
        recaps
        consumersReached
        samplesDistributed
        productsSold
        cansSold
        packsSold
        totalEngagements
        firstTimeConsumers
        brandAwareConsumers
        willingToPurchase
      }
      events {
        id
        name
        date
        locationName
        city
        state
        coordinates
        recapCount
      }
      photos {
        url
        caption
      }
      ambassadors {
        name
        isExternal
        eventCount
      }
      highlights {
        text
        source
      }
    }
  }
`;
