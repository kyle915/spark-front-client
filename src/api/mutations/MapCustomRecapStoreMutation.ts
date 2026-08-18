import { graphql } from "react-relay";

export const MapCustomRecapStoreMutation = graphql`
  mutation MapCustomRecapStoreMutation($input: MapCustomRecapStoreInput!) {
    mapCustomRecapStore(input: $input) {
      success
      message
      clientMutationId
      customRecap {
        __typename
        id
        uuid
        storeMappingStatus
        retailer {
          id
          name
          address
          isNational
        }
      }
    }
  }
`;
