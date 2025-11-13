import { Environment, Network, RecordSource, Store } from "relay-runtime";
import type {
    RequestParameters,
    Variables,
    GraphQLResponse,
} from "relay-runtime";

async function fetchGraphQL(
    params: RequestParameters,
    variables: Variables
): Promise<GraphQLResponse> {
    const token = localStorage.getItem("@token");

    const response = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `JWT ${token}` } : {}),
        },
        body: JSON.stringify({
            query: params.text,
            variables,
        }),
    });

    return await response.json();
}

function fetchRelay(params: RequestParameters, variables: Variables) {
    return fetchGraphQL(params, variables);
}

const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
});

export default environment;
