import { graphql } from "react-relay";

/**
 * Account Map pins only — lat/lng, retailer, status, name/address.
 *
 * Must not use RequestsQuery / Master Tracker (products, open shifts,
 * recap rollups). Cap stays at the API ceiling of 2000.
 * Coverage class comes from filed recaps (sampled=1 visit, repeat=>1,
 * never_visited=0); requests alone are only ever `planned`.
 *
 * Rows that share a `storeKey` are one physical store: the server groups by
 * street address / spot on the ground, and `visitCount`, `coverageClass` and
 * `planned` are that store's, not its banner's. `locationSource` says where
 * lat/lng came from: the request, its event, or a looked-up address (the
 * event's, else the request's own). `lastVisitDate` is the store's newest
 * filed visit.
 */
export const AccountMapQuery = graphql`
  query AccountMapQuery($tenantId: ID, $first: Int, $offset: Int) {
    accountMapPinTotal(tenantId: $tenantId)
    accountMapPins(tenantId: $tenantId, first: $first, offset: $offset) {
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
      storeKey
      locationSource
      lastVisitDate
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
