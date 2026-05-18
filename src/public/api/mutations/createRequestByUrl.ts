export const CREATE_REQUEST_BY_URL = `
  mutation CreateRequestByUrl(
    $input: CreateRequestWithDependenciesInput!
    $requestUrlName: String!
  ) {
    createRequestByUrl(input: $input, requestUrlName: $requestUrlName) {
      success
      message
      request {
        id
        uuid
        name
        address
        rmmAsigned {
          firstName
          lastName
          email
        }
      }
    }
  }
`;
