import { graphql } from "react-relay";

export const DashboardQuery = graphql`
  query DashboardQuery {
    tenants {
      totalCount
    }

    events(first: 500) {
      totalCount
      edges {
        node {
          id
          name
          createdAt
          startTime
          endTime

          eventType {
            name
          }

          status {
            name
          }
          
          request {
            date
            client {
              name
            }
            distributor {
              name
            }
            retailer {
              name
            }
          }
        }
      }
    }

    requests(first: 500) {
      totalCount
      edges {
        node {
          id
          date

          requestType {
            name
          }

          status {
            name
          }

          client {
            name
          }

          distributor {
            name
          }

          retailer {
            name
          }
        }
      }
    }

    distributors(filters: {}) {
      edges {
        node {
          id
          name
        }
      }
    }

    clients(filters: {}) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;
