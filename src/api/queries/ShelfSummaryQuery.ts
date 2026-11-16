import { graphql } from "react-relay";

/**
 * On-shelf counts for one client and date range.
 *
 * Counted on the server from shelf photos on approved retail recaps, dated
 * by the event. `visits` is the base of every figure: approved retail
 * visits with a shelf photo that has an answer. `status` is "ready", "none"
 * (no visit has an answer yet) or "unavailable".
 */
export const ShelfSummaryQuery = graphql`
  query ShelfSummaryQuery($tenantId: ID!, $startDate: String, $endDate: String) {
    shelfSummary(tenantId: $tenantId, startDate: $startDate, endDate: $endDate) {
      status
      visits
      onShelf
      notFound
      unclear
      priceTagVisible
      unreadVisits
      notFoundStores {
        storeName
        eventDate
      }
      notFoundMore
    }
  }
`;
