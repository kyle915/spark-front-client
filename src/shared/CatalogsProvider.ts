import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchQuery, type GraphQLTaggedNode } from "react-relay";

import { useAuthStore } from "@/store/authStore";

import type { EventStatus, EventType } from "../types/events/formTypes";
import environment from "@api/relay/environment";
import { EventTypeQuery } from "@api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";
import { EventStatusesQuery } from "@api/queries/EventStatusesQuery";
import type { EventStatusesQuery as EventStatusesQueryType } from "@api/queries/__generated__/EventStatusesQuery.graphql";
import { ClientsQuery } from "@api/queries/ClientsQuery";
import type { ClientsQuery as ClientsQueryType } from "@api/queries/__generated__/ClientsQuery.graphql";
import { RetailersQuery } from "@api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";
import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { RequestTypesQuery } from "@api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import { RequestStatusesQuery } from "@api/queries/RequestStatusesQuery";
import type { RequestStatusesQuery as RequestStatusesQueryType } from "@api/queries/__generated__/RequestStatusesQuery.graphql";
import { RequestsQuery } from "@api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { RequestStoreManagersQuery } from "@api/queries/RequestStoreManagersQuery";
import type { RequestStoreManagersQuery as RequestStoreManagersQueryType } from "@api/queries/__generated__/RequestStoreManagersQuery.graphql";

type Connection<Node> = {
  edges?: ReadonlyArray<{
    node?: Node | null;
  } | null> | null;
} | null;

type QueryWithFilters = { variables: { filters?: unknown } };
type QueryFilters<TQuery extends QueryWithFilters> =
  | TQuery["variables"]["filters"]
  | undefined;

export interface CatalogItem {
  id: string;
  name: string;
  uuid?: string;
  email?: string | null;
  address?: string | null;
  storeContact?: string | null;
}

export interface RequestStoreManagerItem {
  id: string;
  name: string;
  phone: string;
  uuid?: string;
  requestId?: string | null;
}
type CatalogsProviderProps = {
  children: (catalogs: CatalogsState) => ReactNode;
  eventTypes?: boolean;
  eventTypesFilters?: EventTypeQueryType["variables"]["filters"];
  eventStatuses?: boolean;
  eventStatusesFilters?: EventStatusesQueryType["variables"]["filters"];
  clients?: boolean;
  clientsFilters?: ClientsQueryType["variables"]["filters"];
  retailers?: boolean;
  retailersFilters?: RetailersQueryType["variables"]["filters"];
  distributors?: boolean;
  distributorsFilters?: DistributorsQueryType["variables"]["filters"];
  requestTypes?: boolean;
  requestTypesFilters?: RequestTypesQueryType["variables"]["filters"];
  tenants?: boolean;
  requestStatuses?: boolean;
  requestStatusesFilters?: RequestStatusesQueryType["variables"]["filters"];
  requests?: boolean;
  requestsFilters?: RequestsQueryType["variables"]["filters"];
  requestStoreManagers?: boolean;
  requestStoreManagersFilters?: RequestStoreManagersQueryType["variables"]["filters"];
};

type CatalogsState = {
  eventTypes: EventType[];
  eventStatuses: EventStatus[];
  clients: CatalogItem[];
  retailers: CatalogItem[];
  distributors: CatalogItem[];
  requestTypes: CatalogItem[];
  requestStatuses: CatalogItem[];
  tenants: CatalogItem[];
  requests: CatalogItem[];
  requestStoreManagers: RequestStoreManagerItem[];
  loading: {
    eventTypes: boolean;
    eventStatuses: boolean;
    clients: boolean;
    retailers: boolean;
    distributors: boolean;
    requestTypes: boolean;
    requestStatuses: boolean;
    tenants: boolean;
    requests: boolean;
    requestStoreManagers: boolean;
  };
  errors: {
    eventTypes: Error | null;
    eventStatuses: Error | null;
    clients: Error | null;
    retailers: Error | null;
    distributors: Error | null;
    requestTypes: Error | null;
    requestStatuses: Error | null;
    tenants: Error | null;
    requests: Error | null;
    requestStoreManagers: Error | null;
  };
  refetch: (key: keyof CatalogsState) => void;
};

const createInitialState = (): CatalogsState => ({
  eventTypes: [],
  eventStatuses: [],
  clients: [],
  retailers: [],
  distributors: [],
  requestTypes: [],
  requestStatuses: [],
  tenants: [],
  requests: [],
  requestStoreManagers: [],
  loading: {
    eventTypes: false,
    eventStatuses: false,
    clients: false,
    retailers: false,
    distributors: false,
    requestTypes: false,
    requestStatuses: false,
    tenants: false,
    requests: false,
    requestStoreManagers: false,
  },
  errors: {
    eventTypes: null,
    eventStatuses: null,
    clients: null,
    retailers: null,
    distributors: null,
    requestTypes: null,
    requestStatuses: null,
    tenants: null,
    requests: null,
    requestStoreManagers: null,
  },
  refetch: () => {},
});

const parseConnection = <Node>(connection: Connection<Node>): Node[] =>
  connection?.edges?.flatMap((edge) => (edge?.node ? [edge.node] : [])) ?? [];

const parseEventTypes = (response: EventTypeQueryType["response"]) =>
  parseConnection(response.eventTypes);
const parseEventStatuses = (response: EventStatusesQueryType["response"]) =>
  parseConnection(response.eventStatuses);
const parseClients = (response: ClientsQueryType["response"]) =>
  parseConnection(response.clients);
const parseRetailers = (response: RetailersQueryType["response"]) =>
  parseConnection(response.retailers);
const parseDistributors = (response: DistributorsQueryType["response"]) =>
  parseConnection(response.distributors);
const parseRequestTypes = (response: RequestTypesQueryType["response"]) =>
  parseConnection(response.requestTypes);
const parseRequestStatuses = (response: RequestStatusesQueryType["response"]) =>
  parseConnection(response.requestStatuses);
const parseTenants = (response: TenantsQueryType["response"]) =>
  parseConnection(response.tenants);
const parseRequests = (response: RequestsQueryType["response"]) =>
  parseConnection(response.requests);
const parseRequestStoreManagers = (
  response: RequestStoreManagersQueryType["response"]
) => parseConnection(response.requestStoreManagers);

const REQUESTS_PAGE_SIZE_FOR_FILTERS = 100;

const CatalogsProvider = ({
  children,
  eventTypes = false,
  eventTypesFilters,
  eventStatuses = false,
  eventStatusesFilters,
  clients = false,
  clientsFilters,
  retailers = false,
  retailersFilters,
  distributors = false,
  distributorsFilters,
  requestTypes = false,
  requestTypesFilters,
  tenants = false,
  requestStatuses = false,
  requestStatusesFilters,
  requests = false,
  requestsFilters,
  requestStoreManagers = false,
  requestStoreManagersFilters,
}: CatalogsProviderProps) => {
  const { tenantId } = useAuthStore();
  const [state, setState] = useState<CatalogsState>(() => createInitialState());

  // tenant filter for requests
  const withTenantForRequests = <
    T extends Record<string, unknown> | null | undefined
  >(
    filters: T
  ): Record<string, unknown> => {
    if (!tenantId) return (filters ?? {}) as Record<string, unknown>;

    return {
      ...(filters ?? {}),
      tenantId,
    };
  };

  // Filter requests by tenant always
  const requestsFiltersMemo = useMemo(
    () => withTenantForRequests(requestsFilters),
    [requestsFilters]
  );
  const retailersFiltersMemo = useMemo(
    () => withTenantForRequests(retailersFilters) ?? {},
    [retailersFilters]
  );
  const distributorsFiltersMemo = useMemo(
    () => withTenantForRequests(distributorsFilters) ?? {},
    [distributorsFilters]
  );

  // Memoized filters
  const eventTypeFiltersMemo = useMemo(
    () => eventTypesFilters ?? {},
    [eventTypesFilters]
  );
  const eventStatusFiltersMemo = useMemo(
    () => eventStatusesFilters ?? {},
    [eventStatusesFilters]
  );
  const clientsFiltersMemo = useMemo(
    () => clientsFilters ?? {},
    [clientsFilters]
  );

  const requestTypesFiltersMemo = useMemo(
    () => requestTypesFilters ?? {},
    [requestTypesFilters]
  );
  const requestStatusesFiltersMemo = useMemo(
    () => requestStatusesFilters ?? {},
    [requestStatusesFilters]
  );

  const requestStoreManagersFiltersMemo = useMemo(
    () => requestStoreManagersFilters ?? {},
    [requestStoreManagersFilters]
  );
  const requestsVariablesMemo = useMemo(
    () => ({ first: REQUESTS_PAGE_SIZE_FOR_FILTERS }),
    []
  );
  const emptyFilters = useMemo(() => ({}), []);

  const [refreshTriggers, setRefreshTriggers] = useState<
    Record<string, number>
  >({});

  const refetch = (key: keyof CatalogsState) => {
    setRefreshTriggers((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1,
    }));
  };

  // Helper to create fetch effect
  const useCatalogEffect = <
    TQuery extends { response: unknown; variables: Record<string, unknown> },
    TItem
  >(
    isEnabled: boolean,
    filters: QueryFilters<TQuery>,
    query: GraphQLTaggedNode,
    key: keyof CatalogsState & string,
    parser: (data: TQuery["response"]) => TItem[],
    extraVariables?: Record<string, unknown>
  ) => {
    const variables = useMemo(
      () =>
        ({
          ...(filters ? { filters } : {}),
          ...(extraVariables ?? {}),
        } as TQuery["variables"]),
      [filters, extraVariables]
    );

    const refreshTrigger = refreshTriggers[key] || 0;

    useEffect(() => {
      if (!isEnabled) {
        setState((prev) => ({
          ...prev,
          [key]: [],
          loading: { ...prev.loading, [key]: false },
          errors: { ...prev.errors, [key]: null },
        }));
        return;
      }

      let isActive = true;
      let subscription: { unsubscribe: () => void } | null = null;

      setState((prev) => ({
        ...prev,
        loading: { ...prev.loading, [key]: true },
        errors: { ...prev.errors, [key]: null },
      }));

      subscription = fetchQuery<TQuery>(
        environment,
        query,
        variables
      ).subscribe({
        next: (response) => {
          if (!isActive) return;
          setState((prev) => ({
            ...prev,
            [key]: parser(response),
            loading: { ...prev.loading, [key]: false },
            errors: { ...prev.errors, [key]: null },
          }));
        },
        error: (error: Error) => {
          if (!isActive) return;
          setState((prev) => ({
            ...prev,
            [key]: [],
            loading: { ...prev.loading, [key]: false },
            errors: { ...prev.errors, [key]: error },
          }));
        },
        complete: () => {
          if (!isActive) return;
          setState((prev) => ({
            ...prev,
            loading: { ...prev.loading, [key]: false },
          }));
        },
      });

      return () => {
        isActive = false;
        subscription?.unsubscribe();
      };
    }, [isEnabled, query, key, parser, variables, refreshTrigger]);
  };

  useCatalogEffect<EventTypeQueryType, EventType>(
    eventTypes,
    eventTypeFiltersMemo,
    EventTypeQuery,
    "eventTypes",
    parseEventTypes
  );

  useCatalogEffect<EventStatusesQueryType, EventStatus>(
    eventStatuses,
    eventStatusFiltersMemo,
    EventStatusesQuery,
    "eventStatuses",
    parseEventStatuses
  );

  useCatalogEffect<ClientsQueryType, CatalogItem>(
    clients,
    clientsFiltersMemo,
    ClientsQuery,
    "clients",
    parseClients
  );

  useCatalogEffect<RetailersQueryType, CatalogItem>(
    retailers || !!tenantId,
    retailersFiltersMemo,
    RetailersQuery,
    "retailers",
    parseRetailers
  );

  useCatalogEffect<DistributorsQueryType, CatalogItem>(
    distributors || !!tenantId,
    distributorsFiltersMemo,
    DistributorsQuery,
    "distributors",
    parseDistributors
  );

  useCatalogEffect<RequestTypesQueryType, CatalogItem>(
    requestTypes,
    requestTypesFiltersMemo,
    RequestTypesQuery,
    "requestTypes",
    parseRequestTypes
  );

  useCatalogEffect<RequestStatusesQueryType, CatalogItem>(
    requestStatuses,
    requestStatusesFiltersMemo,
    RequestStatusesQuery,
    "requestStatuses",
    parseRequestStatuses
  );

  useCatalogEffect<TenantsQueryType, CatalogItem>(
    tenants,
    emptyFilters,
    TenantsQuery,
    "tenants",
    parseTenants
  );

  useCatalogEffect<RequestsQueryType, CatalogItem>(
    requests || !!tenantId,
    requestsFiltersMemo,
    RequestsQuery,
    "requests",
    parseRequests,
    requestsVariablesMemo
  );

  useCatalogEffect<RequestStoreManagersQueryType, RequestStoreManagerItem>(
    requestStoreManagers,
    requestStoreManagersFiltersMemo,
    RequestStoreManagersQuery,
    "requestStoreManagers",
    parseRequestStoreManagers
  );

  return children({ ...state, refetch });
};

export type { CatalogsState };
export default CatalogsProvider;
