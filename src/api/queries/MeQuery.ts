import { graphql } from "react-relay";

export const MeQuery = graphql`
  query MeQuery {
    me {
        id
        uuid
        email
        firstName
        lastName
        username
        role{
            id
            uuid
            name
        }
    }
  }
`;
