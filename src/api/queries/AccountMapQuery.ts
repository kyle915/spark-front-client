import { graphql } from "react-relay";

/**
 * Account Map pins only — lat/lng, retailer, status, name/address.
 *
 * Must not use RequestsQuery / Master Tracker (products, open shifts,
 * recap rollups). Cap stays at the API ceiling of 2000.
 * Coverage class comes from filed recaps (sampled=1 visit, repeat=>1,
 * never_visited=0); requests alone are only ever `planned`.
 */
export const AccountMapQuery = graphql`
  query AccountMapQuery($tenantId: ID, $first: Int) {
    accountMapPins(tenantId: $tenantId, first: $first) {
      id
      name
      address
      lat
      lng
      statusSlug
      date
      retailerName
      locationName
      stateCode
      coverageClass
      visitCount
      planned
    }
    accountMapCoverage(tenantId: $tenantId) {
      rosterTotal
      sampled
      repeat
      neverVisited
      planned
    }
  }
`;
