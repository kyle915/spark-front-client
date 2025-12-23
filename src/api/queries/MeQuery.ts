import { graphql } from "react-relay";

export const MeQuery = graphql`
  query MeQuery {
    me {
      __typename
      id
      uuid
      email
      firstName
      lastName
      username
      image
      role {
        __typename
        id
        uuid
        name
      }
    }
  }
`;
