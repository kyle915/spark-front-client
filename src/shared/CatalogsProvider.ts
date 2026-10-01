import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchQuery, type GraphQLTaggedNode } from "react-relay";

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
import { RateTypesQuery } from "@/api/queries/RateTypesQuery";
import { StatesQuery } from "@/api/queries/StatesQuery";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";

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
  code?: string | null;
}

export interface RequestStoreManagerItem {
  id: string;
  name: string;
  phone: string;
  uuid?: string;
  requestId?: string;
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
  retailersQuery?: string | null;
  distributors?: boolean;
  distributorsFilters?: DistributorsQueryType["variables"]["filters"];
  distributorsQuery?: string | null;
  requestTypes?: boolean;
  requestTypesFilters?: RequestTypesQueryType["variables"]["filters"];
  tenants?: boolean;
  requestStatuses?: boolean;
  requestStatusesFilters?: RequestStatusesQueryType["variables"]["filters"];
  requests?: boolean;
  requestsFilters?: RequestsQueryType["variables"]["filters"];
  requestStoreManagers?: boolean;
  requestStoreManagersFilters?: RequestStoreManagersQueryType["variables"]["filters"];
  rateTypes?: boolean;
  rateTypesFilters?: {
    tenantId?: string | null;
  };
  states?: boolean;
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
  rateTypes: CatalogItem[];
  states: CatalogItem[];
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
    rateTypes: boolean;
    states: boolean;
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
    rateTypes: Error | null;
    states: Error | null;
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
  rateTypes: [],
  states: [],
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
    rateTypes: false,
    states: false,
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
    rateTypes: null,
    states: null,
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
  response: RequestStoreManagersQueryType["response"],
) =>
  parseConnection(response.requestStoreManagers).map((manager) => ({
    ...manager,
    requestId: manager.requestId ?? undefined,
  }));

const REQUESTS_PAGE_SIZE_FOR_FILTERS = 100;
const RATE_TYPES_PAGE_SIZE_FOR_FILTERS = 100;

type RateTypeNode = CatalogItem & {
  tenantId?: string | null;
};

type RateTypesQueryType = {
  response: {
    rateTypes: Connection<RateTypeNode>;
  };
  variables: {
    first?: number;
    after?: string;
    last?: number;
    before?: string;
    q?: string | null;
    filters?: {
      tenantId?: string | null;
    };
  };
};

const parseRateTypes = (response: RateTypesQueryType["response"]) =>
  parseConnection(response.rateTypes);
const parseStates = (response: StatesQueryType["response"]) =>
  parseConnection(response.states);

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
  retailersQuery,
  distributors = false,
  distributorsFilters,
  distributorsQuery,
  requestTypes = false,
  requestTypesFilters,
  tenants = false,
  requestStatuses = false,
  requestStatusesFilters,
  requests = false,
  requestsFilters,
  requestStoreManagers = false,
  requestStoreManagersFilters,
  rateTypes = false,
  rateTypesFilters,
  states = false,
}: CatalogsProviderProps) => {
  const [state, setState] = useState<CatalogsState>(() => createInitialState());

  const eventTypeFiltersMemo = useMemo(
    () => eventTypesFilters ?? {},
    [eventTypesFilters],
  );
  const eventStatusFiltersMemo = useMemo(
    () => eventStatusesFilters ?? {},
    [eventStatusesFilters],
  );
  const clientsFiltersMemo = useMemo(
    () => clientsFilters ?? {},
    [clientsFilters],
  );
  const retailersFiltersMemo = useMemo(
    () => retailersFilters ?? {},
    [retailersFilters],
  );
  const retailersQueryMemo = useMemo(
    () => retailersQuery ?? null,
    [retailersQuery],
  );
  const retailersVariablesMemo = useMemo(
    () => ({ q: retailersQueryMemo }),
    [retailersQueryMemo],
  );
  const distributorsFiltersMemo = useMemo(
    () => distributorsFilters ?? {},
    [distributorsFilters],
  );
  const distributorsQueryMemo = useMemo(
    () => distributorsQuery ?? null,
    [distributorsQuery],
  );
  const distributorsVariablesMemo = useMemo(
    () => ({ q: distributorsQueryMemo }),
    [distributorsQueryMemo],
  );
  const requestTypesFiltersMemo = useMemo(
    () => requestTypesFilters ?? {},
    [requestTypesFilters],
  );
  const requestStatusesFiltersMemo = useMemo(
    () => requestStatusesFilters ?? {},
    [requestStatusesFilters],
  );
  const requestsFiltersMemo = useMemo(
    () => requestsFilters ?? {},
    [requestsFilters],
  );
  const requestStoreManagersFiltersMemo = useMemo(
    () => requestStoreManagersFilters ?? {},
    [requestStoreManagersFilters],
  );
  const rateTypesFiltersMemo = useMemo(
    () => rateTypesFilters ?? {},
    [rateTypesFilters],
  );
  const requestsVariablesMemo = useMemo(
    () => ({ first: REQUESTS_PAGE_SIZE_FOR_FILTERS }),
    [],
  );
  const rateTypesVariablesMemo = useMemo(
    () => ({ first: RATE_TYPES_PAGE_SIZE_FOR_FILTERS }),
    [],
  );
  const emptyFilters = useMemo(() => ({}), []);
  // The tenants connection defaults to 10 rows; 500 is its cap.
  const tenantsVariablesMemo = useMemo(() => ({ first: 500 }), []);

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
    TItem,
  >(
    isEnabled: boolean,
    filters: QueryFilters<TQuery>,
    query: GraphQLTaggedNode,
    key: keyof CatalogsState & string,
    parser: (data: TQuery["response"]) => TItem[],
    extraVariables?: Record<string, unknown>,
  ) => {
    const variables = useMemo(
      () =>
        ({
          ...(filters ? { filters } : {}),
          ...(extraVariables ?? {}),
        }) as TQuery["variables"],
      [filters, extraVariables],
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
        variables,
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
    parseEventTypes,
  );

  useCatalogEffect<EventStatusesQueryType, EventStatus>(
    eventStatuses,
    eventStatusFiltersMemo,
    EventStatusesQuery,
    "eventStatuses",
    parseEventStatuses,
  );

  useCatalogEffect<ClientsQueryType, CatalogItem>(
    clients,
    clientsFiltersMemo,
    ClientsQuery,
    "clients",
    parseClients,
  );

  useCatalogEffect<RetailersQueryType, CatalogItem>(
    retailers,
    retailersFiltersMemo,
    RetailersQuery,
    "retailers",
    parseRetailers,
    retailersVariablesMemo,
  );

  useCatalogEffect<DistributorsQueryType, CatalogItem>(
    distributors,
    distributorsFiltersMemo,
    DistributorsQuery,
    "distributors",
    parseDistributors,
    distributorsVariablesMemo,
  );

  useCatalogEffect<RequestTypesQueryType, CatalogItem>(
    requestTypes,
    requestTypesFiltersMemo,
    RequestTypesQuery,
    "requestTypes",
    parseRequestTypes,
  );

  useCatalogEffect<RequestStatusesQueryType, CatalogItem>(
    requestStatuses,
    requestStatusesFiltersMemo,
    RequestStatusesQuery,
    "requestStatuses",
    parseRequestStatuses,
  );

  useCatalogEffect<TenantsQueryType, CatalogItem>(
    tenants,
    emptyFilters,
    TenantsQuery,
    "tenants",
    parseTenants,
    tenantsVariablesMemo,
  );

  useCatalogEffect<RequestsQueryType, CatalogItem>(
    requests,
    requestsFiltersMemo,
    RequestsQuery,
    "requests",
    parseRequests,
    requestsVariablesMemo,
  );
  useCatalogEffect<RequestStoreManagersQueryType, RequestStoreManagerItem>(
    requestStoreManagers,
    requestStoreManagersFiltersMemo,
    RequestStoreManagersQuery,
    "requestStoreManagers",
    parseRequestStoreManagers,
  );
  useCatalogEffect<RateTypesQueryType, CatalogItem>(
    rateTypes,
    rateTypesFiltersMemo,
    RateTypesQuery,
    "rateTypes",
    parseRateTypes,
    rateTypesVariablesMemo,
  );
  useCatalogEffect<StatesQueryType, CatalogItem>(
    states,
    emptyFilters,
    StatesQuery,
    "states",
    parseStates,
  );

  return children({ ...state, refetch });
};

export type { CatalogsState };
export default CatalogsProvider;
