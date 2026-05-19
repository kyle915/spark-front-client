import { graphql } from "react-relay";

export const AcademyModulesAdminQuery = graphql`
  query AcademyModulesAdminQuery($filters: AcademyModuleFiltersInput) {
    academyModulesAdmin(filters: $filters) {
      id
      uuid
      title
      kind
      body
      order
      published
      createdAt
      updatedAt
      tenantId
    }
  }
`;
