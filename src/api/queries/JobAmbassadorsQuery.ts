import { graphql } from "react-relay";

export const JobAmbassadorsQuery = graphql`
    query JobAmbassadorsQuery($jobId: ID!, $first: Int = 50) {
        jobApplicants(jobId: $jobId, first: $first) {
            edges {
                node {
                    id
                    ambassador {
                        id
                        uuid
                        user {
                            id
                            uuid
                            firstName
                            lastName
                        }
                    }
                    status {
                        id
                        slug
                        name
                    }
                }
            }
        }
    }
`;
