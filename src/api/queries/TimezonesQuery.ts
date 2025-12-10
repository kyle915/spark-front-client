import { graphql } from 'react-relay';

export const TimezonesQuery = graphql`
  query TimezonesQuery {
    timezones {
      edges {
        node {
          id
          uuid
          name
          code
          offset
        }
      }
    }
  }
`;
