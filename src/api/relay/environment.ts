import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
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

    const result = await response.json();

    // Check for token expiration error
    if (result.errors) {
        const isTokenExpired = result.errors.some((error: any) => {
            const msg = error.message.toLowerCase();
            return (
                msg.includes("signature has expired") ||
                msg.includes("introspection is disabled") ||
                msg.includes("error decoding signature")
            );
        });

        if (isTokenExpired) {
            const { refreshToken, logout } = useAuthStore.getState();

            if (!refreshToken) {
                logout();
                useAlertStore.getState().showAlert("Session expired. Please login again.", "error");
                return result;
            }

            try {
                // Attempt to refresh the token
                const refreshResponse = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `
                           mutation RefreshToken($input: RefreshTokenInput!) {
                            refreshToken(input: $input) {
                                success
                                errors
                                token {
                                token
                                }
                            }
}
                        `,
                        variables: { input: { refreshToken } },
                    }),
                });

                const refreshResult = await refreshResponse.json();
                const refreshData = refreshResult.data?.refreshToken;

                if (refreshData?.success && refreshData?.token?.token) {
                    const newToken = refreshData.token.token;
                    // Update store and local storage
                    localStorage.setItem("@token", newToken);
                    useAuthStore.setState({
                        token: newToken,
                        refreshToken: refreshToken // Keep old as it's not returned in new mutation
                    });

                    // Retry original request with new token
                    const retryResponse = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `JWT ${newToken}`,
                        },
                        body: JSON.stringify({
                            query: params.text,
                            variables,
                        }),
                    });

                    return await retryResponse.json();
                } else {
                    throw new Error("Refresh failed");
                }
            } catch (error) {
                logout();
                useAlertStore.getState().showAlert("Session expired. Please login again.", "error");
                return result; // Return original error
            }
        }
    }

    return result;
}

function fetchRelay(params: RequestParameters, variables: Variables) {
    return fetchGraphQL(params, variables);
}

const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
    getDataID: (payload) => {
        if (payload.__typename && payload.id != null) {
            return `${payload.__typename}:${payload.id}`;
        }

        return payload.id ?? null;
    },
});

export default environment;
