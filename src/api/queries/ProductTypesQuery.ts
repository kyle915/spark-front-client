import { graphql } from "react-relay";

export const ProductTypesQuery = graphql`
  query ProductTypesQuery($filters: ProductTypeFiltersInput) {
    productTypes(filters: $filters) {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
  }
`;
