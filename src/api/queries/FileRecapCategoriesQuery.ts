import { graphql } from "react-relay";

export type FileRecapCategoriesQueryType = {
    response: {
        fileRecapCategories: {
            edges: Array<{
                node: {
                    id: string;
                    uuid: string;
                    name: string;
                };
            }>;
        };
    };
    variables: {
        filters?: {
            tenantId?: string | null;
        } | null;
    };
};

export const FileRecapCategoriesQuery = graphql`
    query FileRecapCategoriesQuery($filters: FileRecapCategoryFiltersInput = null) {
        fileRecapCategories(filters: $filters) {
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
