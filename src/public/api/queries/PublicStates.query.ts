// import { graphql } from "react-relay";

// export const PublicStatesQuery = graphql`
//   query PublicStatesQuery($q: String) {
//     publicStates(q: $q) {
//       edges {
//         node {
//           __typename
//           id
//           uuid
//           name
//           code
//         }
//       }
//     }
//   }
// `;

export const PUBLIC_STATES_QUERY = `
  query PublicStatesQuery($q: String) {
    publicStates(q: $q) {
      edges {
        node {
          id
          uuid
          name
          code
        }
      }
    }
  }
`;
