import { graphql } from "react-relay";

/**
 * /talent roster. AmbassadorsListQuery plus the fields the roster card needs
 * to show a BA who has only a phone: `phone`, and the market / brand of their
 * most recent shift. Walk-up check-in identities are stored under a synthetic
 * `checkin-<phone>@walkup.spark` email that must never be shown. Kept separate
 * from AmbassadorsListQuery so the other BA pickers don't pay for the
 * last-worked lookup.
 */
export const TalentRosterQuery = graphql`
  query TalentRosterQuery($filters: AmbassadorFiltersInput, $first: Int) {
    ambassadors(filters: $filters, first: $first) {
      edges {
        node {
          id
          uuid
          rating
          address
          isActive
          college
          inCollege
          headshotUrl
          phone
          lastWorkedMarket
          lastWorkedTenant
          user {
            firstName
            lastName
            email
          }
        }
      }
      totalCount
    }
  }
`;
