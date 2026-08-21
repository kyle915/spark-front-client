import { graphql } from "react-relay";

/**
 * Account Map pins only — lat/lng, retailer, status, name/address.
 *
 * Must not use RequestsQuery / Master Tracker (products, open shifts,
 * recap rollups). Cap stays at the API ceiling of 2000.
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
    }
  }
`;
