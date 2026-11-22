import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { useSyncExternalStore } from "react";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { noteLegalGate } from "@/legal/acceptance/legalGateStore";
import { resetHotRelayDataPrefetch } from "@/lib/prefetchHotRelayData";
import {
  findGuardrailError,
  guardrailFromStatus,
  GuardrailError,
} from "./guardrailErrors";
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
 * The brand and workspace membership selected in the app. For people on more
 * than one brand or holding distinct workspace/provider memberships, the
 * server resolves exact tenant + role scope from X-Spark-Tenant and
 * X-Spark-Membership.
 */
function readLocalStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / non-browser env */
  }
}

function selectedTenantHeader(): Record<string, string> {
  const { tenantUuid, membershipUuid } = useAuthStore.getState();
  const resolvedTenant = tenantUuid ?? readLocalStorage("@tenantUuid");
  const resolvedMembership =
    membershipUuid ?? readLocalStorage("@membershipUuid");
  const headers: Record<string, string> = {};
  if (resolvedTenant) headers["X-Spark-Tenant"] = resolvedTenant;
  if (resolvedMembership) headers["X-Spark-Membership"] = resolvedMembership;
  return headers;
}

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      success
      errors
      token {
        token
      }
    }
  }
`;

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Single-flight JWT refresh so concurrent requests hitting an expired token
 * share one refreshToken network round-trip.
 */
async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const { refreshToken, logout } = useAuthStore.getState();
  const storedRefresh = refreshToken ?? readLocalStorage("@refreshToken");
  if (!storedRefresh) {
    logout();
    useAlertStore
      .getState()
      .showAlert("Session expired. Please login again.", "error");
    return null;
  }

  refreshInFlight = (async () => {
    try {
      const refreshResponse = await fetch(
        import.meta.env.VITE_GRAPHQL_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: REFRESH_TOKEN_MUTATION,
            variables: { input: { refreshToken: storedRefresh } },
          }),
        },
      );
      const refreshResult = await refreshResponse.json();
      const refreshData = refreshResult?.data?.refreshToken;
      if (refreshData?.success && refreshData?.token?.token) {
        const newToken: string = refreshData.token.token;
        writeLocalStorage("@token", newToken);
        useAuthStore.setState({
          token: newToken,
          refreshToken: storedRefresh,
        });
        return newToken;
      }
      throw new Error("Refresh failed");
    } catch {
      logout();
      useAlertStore
        .getState()
        .showAlert("Session expired. Please login again.", "error");
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isTokenExpiredErrors(errors: unknown): boolean {
  if (!Array.isArray(errors)) return false;
  return errors.some((error) => {
    const msg = String(
      (error as { message?: unknown } | null)?.message ?? "",
    ).toLowerCase();
    return (
      msg.includes("signature has expired") ||
      msg.includes("introspection is disabled") ||
      msg.includes("error decoding signature")
    );
  });
}

async function postGraphQLOnce(
  query: string,
  variables: Variables,
  token: string | null,
): Promise<GraphQLResponse> {
  const response = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `JWT ${token}` } : {}),
      ...selectedTenantHeader(),
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  // A bare HTTP 429 (no JSON body) reads as the GraphQL-level refusal.
  const throttled = guardrailFromStatus(
    response.status,
    response.headers.get("Retry-After"),
  );
  if (throttled) {
    return {
      data: null,
      errors: [
        {
          message: throttled.message,
          extensions: { code: throttled.code, retryAfter: throttled.retryAfter },
        },
      ],
    } as unknown as GraphQLResponse;
  }

  return (await response.json()) as GraphQLResponse;
}

async function fetchGraphQLRaw(
  query: string,
  variables: Variables,
): Promise<GraphQLResponse> {
  const token =
    readLocalStorage("@token") ?? useAuthStore.getState().token ?? null;
  const result = await postGraphQLOnce(query, variables, token);

  // Terms not accepted yet (LEGAL_ACCEPTANCE_REQUIRED): show the clickwrap.
  noteLegalGate(result);

  const body = result as { errors?: unknown };
  if (isTokenExpiredErrors(body.errors)) {
    const newToken = await refreshAccessTokenSingleFlight();
    if (!newToken) return result;

    const retried = await postGraphQLOnce(query, variables, newToken);
    noteLegalGate(retried);
    return retried;
  }

  return result;
}

/**
 * Rate limits, export/bulk caps and oversized queries are the server saying
 * "not now", not a broken page: one toast for the burst, and an error whose
 * message is the server's own sentence so `onError` handlers and the page
 * error boundary show it as-is. Mutations always fail on one (an export that
 * was refused must not look like it started); a query fails only when the
 * server sent no data.
 */
function surfaceGuardrail(
  operationKind: "query" | "mutation" | "subscription",
  response: GraphQLResponse,
): GraphQLResponse {
  const body = response as { data?: unknown; errors?: unknown };
  const hit = findGuardrailError(body.errors);
  if (!hit) return response;
  useAlertStore.getState().showGuardrail(hit);
  if (body.data == null || operationKind === "mutation") {
    throw new GuardrailError(hit);
  }
  return response;
}

export interface AuthenticatedGraphQLResult<
  TData = Record<string, unknown>,
> {
  data?: TData | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

export interface ExecuteAuthenticatedGraphQLOptions {
  operationName?: string;
  operationKind?: "query" | "mutation";
}

function inferOperationKind(query: string): "query" | "mutation" {
  return /^\s*mutation\b/i.test(query) ? "mutation" : "query";
}

/**
 * Shared authenticated GraphQL helper for imperative callers outside Relay's
 * codegen hooks (approvals batch actions, XLSX bulk upload, brand launch
 * wizard). Carries `X-Spark-Tenant`, legal-gate handling, single-flight JWT
 * refresh + retry, guardrail toasts, and post-mutation sidebar count refresh.
 */
export async function executeAuthenticatedGraphQL<
  TData = Record<string, unknown>,
>(
  query: string,
  variables: Variables = {},
  options: ExecuteAuthenticatedGraphQLOptions = {},
): Promise<AuthenticatedGraphQLResult<TData>> {
  const operationKind = options.operationKind ?? inferOperationKind(query);
  const raw = await fetchGraphQLRaw(query, variables);
  const checked = surfaceGuardrail(operationKind, raw);
  const typed = checked as unknown as AuthenticatedGraphQLResult<TData>;
  if (operationKind === "mutation" && !typed.errors?.length && typed.data != null) {
    scheduleCountsRefresh(environment);
  }
  return typed;
}

function fetchRelay(params: RequestParameters, variables: Variables) {
  const pending = fetchGraphQLRaw(params.text ?? "", variables).then(
    (response) => surfaceGuardrail(params.operationKind, response),
  );
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

const recordSource = new RecordSource();

const environment = new Environment({
  network: Network.create(fetchRelay),
  store: new Store(recordSource),
  getDataID: (payload) => {
    if (payload.__typename && payload.id != null) {
      return `${payload.__typename}:${payload.id}`;
    }
    return null;
  },
});

startCountsHeartbeat(environment);

let workspaceEpoch = 0;
const workspaceListeners = new Set<() => void>();

function subscribeWorkspaceEpoch(listener: () => void): () => void {
  workspaceListeners.add(listener);
  return () => {
    workspaceListeners.delete(listener);
  };
}

function getWorkspaceEpoch(): number {
  return workspaceEpoch;
}

/**
 * Monotonically increasing epoch bumped on explicit workspace switches so
 * AuthenticatedShell remounts active route queries cleanly without reloading
 * the browser tab or unmounting sidebar/topbar chrome.
 */
export function useWorkspaceEpoch(): number {
  return useSyncExternalStore(
    subscribeWorkspaceEpoch,
    getWorkspaceEpoch,
    getWorkspaceEpoch,
  );
}

/**
 * Clear cached tenant records in Relay's RecordSource, re-key active route
 * queries, and refresh sidebar counts — zero full-tab reload required.
 */
export function resetRelayStore(): void {
  recordSource.clear();
  resetHotRelayDataPrefetch();
  workspaceEpoch += 1;
  for (const listener of workspaceListeners) {
    listener();
  }
  scheduleCountsRefresh(environment, 0);
}

export default environment;
