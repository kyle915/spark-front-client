import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import {
  isSettledMutation,
  scheduleCountsRefresh,
  startCountsHeartbeat,
} from "./countsRefresh";
import type {
  RequestParameters,
  Variables,
  GraphQLResponse,
} from "relay-runtime";

/**
 * The brand selected in the app. For people on more than one brand the
 * server can't tell which one a page means; it uses this when they are a
 * member of it (spark-api utils/graphql/mixins.py, X-Spark-Tenant).
 */
function selectedTenantHeader(): Record<string, string> {
  const uuid = useAuthStore.getState().tenantUuid;
  return uuid ? { "X-Spark-Tenant": uuid } : {};
}

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
      ...selectedTenantHeader(),
    },
    body: JSON.stringify({
      query: params.text,
      variables,
    }),
  });

  const result = await response.json();

  // Check for token expiration error
  if (result.errors) {
    const isTokenExpired = result.errors.some((error: { message: string }) => {
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
        useAlertStore
          .getState()
          .showAlert("Session expired. Please login again.", "error");
        return result;
      }

      try {
        // Attempt to refresh the token
        const refreshResponse = await fetch(
          import.meta.env.VITE_GRAPHQL_ENDPOINT,
          {
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
          }
        );

        const refreshResult = await refreshResponse.json();
        const refreshData = refreshResult.data?.refreshToken;

        if (refreshData?.success && refreshData?.token?.token) {
          const newToken = refreshData.token.token;
          // Update store and local storage
          localStorage.setItem("@token", newToken);
          useAuthStore.setState({
            token: newToken,
            refreshToken: refreshToken, // Keep old as it's not returned in new mutation
          });

          // Retry original request with new token
          const retryResponse = await fetch(
            import.meta.env.VITE_GRAPHQL_ENDPOINT,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `JWT ${newToken}`,
                ...selectedTenantHeader(),
              },
              body: JSON.stringify({
                query: params.text,
                variables,
              }),
            }
          );

          return await retryResponse.json();
        } else {
          throw new Error("Refresh failed");
        }
      } catch {
        logout();
        useAlertStore
          .getState()
          .showAlert("Session expired. Please login again.", "error");
        return result; // Return original error
      }
    }
  }

  return result;
}

function fetchRelay(params: RequestParameters, variables: Variables) {
  const pending = fetchGraphQL(params, variables);
  // Anything that changed data may have changed a count somewhere: re-read
  // the shared counts so badges, tabs and tiles match without a reload.
  void pending
    .then((response) => {
      if (isSettledMutation(params, response)) scheduleCountsRefresh(environment);
    })
    .catch(() => {
      /* the caller handles the failure; nothing to refresh */
    });
  return pending;
}

const environment = new Environment({
  network: Network.create(fetchRelay),
  store: new Store(new RecordSource()),
  getDataID: (payload) => {
    if (payload.__typename && payload.id != null) {
      return `${payload.__typename}:${payload.id}`;
    }
    return null;
  },
});

startCountsHeartbeat(environment);

export default environment;
