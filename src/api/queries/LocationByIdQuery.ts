import { graphql } from "react-relay";

export const LocationByIdQuery = graphql`
  query LocationByIdQuery($uuid: ID!) {
    location(uuid: $uuid) {
      id
      uuid
      name
      code
      zip
      state {
        id
        uuid
        name
        code
      }
    }
  }
`;
