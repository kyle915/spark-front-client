import { graphql } from "react-relay";

export const GetCustomRecapsQuery = graphql`
  query CustomRecapsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: CustomRecapFiltersInput
  ) {
    customRecaps(
      first: $first
      after: $after
      last: $last
      before: $before
      filters: $filters
    ) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          uuid
          name
          submittedAt
          totalEngagements
          fillingForAmbassador
          late
          incomplete
          approved
          usedCorpoCard
          event {
            id
            name
            date
          }
          ambassador {
            id
            user {
              firstName
              lastName
            }
          }
          job {
            id
            name
          }
          retailer {
            id
            name
          }
          location {
            id
            name
          }
          state {
            id
            name
          }
          customRecapTemplate {
            id
            name
          }
          customRecapProductSample {
            id
            quantity
            product {
              id
              name
              image
            }
          }
          customRecapSalePerformance {
            id
            price
            product {
              id
              name
              image
            }
            typeOfGood {
              id
              name
            }
          }
          customRecapFiles {
            id
            name
            url
            approved
            fileRecapCategory {
              id
              name
            }
            fileType {
              id
              name
            }
          }
          customField {
            id
            name
            value
            recapSection {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const GetCustomRecapQuery = graphql`
  query CustomRecapsQueryDetailsQuery($uuid: ID) {
    customRecap(uuid: $uuid) {
      id
      uuid
      name
      submittedAt
      totalEngagements
      fillingForAmbassador
      late
      incomplete
      approved
      usedCorpoCard
      event {
        id
        name
        date
      }
      ambassador {
        id
        user {
          firstName
          lastName
        }
      }
      job {
        id
        name
      }
      retailer {
        id
        name
      }
      location {
        id
        name
      }
      state {
        id
        name
      }
      customRecapTemplate {
        id
        name
      }
      customRecapProductSample {
        id
        quantity
        product {
          id
          name
          image
        }
      }
      customRecapSalePerformance {
        id
        price
        product {
          id
          name
          image
        }
        typeOfGood {
          id
          name
        }
      }
      customRecapFiles {
        id
        name
        url
        approved
        fileRecapCategory {
          id
          name
        }
        fileType {
          id
          name
        }
      }
      customField {
        id
        name
        value
        recapSection {
          id
          name
        }
      }
    }
  }
`;
