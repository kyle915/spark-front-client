// import { graphql } from "react-relay";

// export const PublicClientsQuery = graphql`
//   query PublicClientsQuery($requestUrlName: String!) {
//     publicClients(requestUrlName: $requestUrlName) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           tenantId
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_CLIENTS_QUERY = `
  query PublicClientsQuery($requestUrlName: String!) {
    publicClients(requestUrlName: $requestUrlName) {
      edges {
        node {
          id
          uuid
          name
          email
          tenantId
        }
      }
    }
  }
`;
