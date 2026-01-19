// import { graphql } from "react-relay";

// export const PublicLocationsQuery = graphql`
//   query PublicLocationsQuery($requestUrlName: String!, $q: String) {
//     publicLocations(requestUrlName: $requestUrlName, q: $q) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           code
//           zip
//           tenantId
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_LOCATIONS_QUERY = `
  query PublicLocationsQuery($requestUrlName: String!, $q: String) {
    publicLocations(requestUrlName: $requestUrlName, q: $q) {
      edges {
        node {
          id
          uuid
          name
          code
          zip
          tenantId
        }
      }
    }
  }
`;
