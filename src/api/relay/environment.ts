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

  // Check for token expiration error.
  //
  // Two distinct cases we have to tease apart:
  //   1. The caller had a token that's now stale → real "session
  //      expired" — refresh or kick to login.
  //   2. There was NEVER a token (e.g. user just landed on /magic/
  //      <token> and the first Relay query fired before the magic
  //      link exchange completed) — this is "not logged in yet", not
  //      "session expired." Show the alert and that user sees a
  //      misleading bounce off the magic link flow.
  //
  // We also stop treating "introspection is disabled" as expiration
  // — that's the backend's response to ANY unauthenticated request
  // and only happens when there was no/invalid token to begin with.
  // For that case we fall into the silent path below (no auth token
  // → don't alert).
  if (result.errors) {
    const isTokenExpired = result.errors.some((error: { message: string }) => {
      const msg = error.message.toLowerCase();
      return (
        msg.includes("signature has expired") ||
        msg.includes("error decoding signature")
      );
    });
    const isUnauthenticated = result.errors.some(
      (error: { message: string }) =>
        error.message.toLowerCase().includes("introspection is disabled"),
    );
    // No token ever set + no refresh token → user is plain not signed
    // in. Don't show "Session expired" — let the route guard handle
    // the redirect (or in the magic-link case, let the exchange
    // finish without flashing an error toast).
    const onMagicRoute = window.location.pathname.startsWith("/magic/");
    if (isUnauthenticated && !token && !onMagicRoute) {
      return result;
    }
    if (isUnauthenticated && onMagicRoute) {
      // Magic-link page handles its own auth — silently swallow this
      // pre-exchange unauthenticated response.
      return result;
    }

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
  return fetchGraphQL(params, variables);
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

export default environment;
