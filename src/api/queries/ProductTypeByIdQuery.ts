import { graphql } from "react-relay";

export const ProductTypeByIdQuery = graphql`
  query ProductTypeByIdQuery($uuid: ID!) {
    productType(uuid: $uuid) {
      id
      uuid
      name
      tenantId
    }
  }
`;
