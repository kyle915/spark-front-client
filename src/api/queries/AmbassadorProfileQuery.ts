import { graphql } from "react-relay";

export const AmbassadorProfileQuery = graphql`
  query AmbassadorProfileQuery($uuid: ID, $id: ID) {
    ambassadorProfile(uuid: $uuid, id: $id) {
      ambassador {
        id
        uuid
        rating
        address
        phone
        aboutMe
        coordinates
        isActive
        tShirtSize
        createdAt
        location {
          id
          name
        }
        user {
          id
          uuid
          firstName
          lastName
          email
        }
      }
      reviews {
        id
        uuid
        review
        score
        createdAt
      }
      notes {
        id
        uuid
        note
        createdAt
      }
      skills {
        id
        uuid
        skill {
          id
          name
        }
      }
    }
  }
`;
