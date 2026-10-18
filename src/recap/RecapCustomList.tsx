import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { useLazyLoadQuery, usePreloadedQuery } from "react-relay/hooks";
import DataTableRelay from "@/shared/DataTableRelay";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { StatesQuery } from "@/api/queries/StatesQuery";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@/api/queries/__generated__/CustomRecapsQuery.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { StatesQuery as StatesQueryType } from "@/api/queries/__generated__/StatesQuery.graphql";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

import type { PreloadedQuery } from "react-relay";
import type { CustomRecapRow } from "@/types/columnsTypes";
import { createCustomRecapColumns } from "@/utils/columns";
import { ArrowPathIcon, CameraIcon } from "@heroicons/react/24/solid";
import { EyeIcon } from "@heroicons/react/24/outline";

import { Link, useSearchParams } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { FilterIcon, FunnelXIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormDatePicker from "@/shared/FormDatePicker";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import ImportConnecteamButton from "./ImportConnecteamButton";

const PAGE_SIZE = 10;

// ======================================================
// TABLE CONTENT
// ======================================================
type CustomRecapsTableContentProps = {
  queryReference: PreloadedQuery<CustomRecapsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  emptyMessage: string;
  returnPage: number;
  returnAfter: string | null;
};

const CustomRecapsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  emptyMessage,
  returnPage,
  returnAfter,
}: CustomRecapsTableContentProps) => {
  const data = usePreloadedQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    queryReference,
  );
  const connection = data.customRecaps;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Custom Recap data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<CustomRecapRow>
      connection={connection as any}
      columns={createCustomRecapColumns()}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      isNavigating={isNavigating}
      onPageLoaded={onPageLoaded}
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <div className="flex gap-2">
            {/* Real link so right-click → "Open in new tab", ⌘/Ctrl-click,
                and middle-click work; plain left-click still does SPA nav. */}
            <Link
              to={(() => {
                const params = new URLSearchParams();
                params.set("fromPage", String(returnPage));
                if (returnAfter) params.set("fromAfter", returnAfter);
                return `/recap/view-custom/${row.uuid}?${params.toString()}`;
              })()}
              className="btn btn-xs btn-outline"
            >
              <EyeIcon className="w-5 h-5" />
              View
            </Link>
          </div>
        ),
      }}
      emptyState={<SparkEmptyState title={emptyMessage} />}
    />
  );
};

// ======================================================
// LIST INNER (PAGINATION)
// ======================================================
type CustomRecapsListInnerProps = {
  filters?: {
    tenantId?: string;
    eventId?: string;
    eventAddress?: string;
    stateId?: string;
    eventDate?: string;
    rmmAsignedId?: string;
    approved?: boolean;
  };
  emptyMessage: string;
  onRefreshReady?: (refreshFn: () => void) => void;
};

const CustomRecapsListInner = ({
  filters,
  emptyMessage,
  onRefreshReady,
}: CustomRecapsListInnerProps) => {
  const [searchParams] = useSearchParams();

  const initialPageFromUrl = useMemo(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }, [searchParams]);

  const initialAfterFromUrl = useMemo(() => {
    const value = searchParams.get("after");
    return value && value.length > 0 ? value : null;
  }, [searchParams]);

  const {
    queryRef,
    displayPage,
    isNavigating,
    currentAfterCursor,
    handlePageLoaded,
    refresh,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<CustomRecapsQueryType>({
    query: GetCustomRecapsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
    initialPage: initialPageFromUrl,
    initialAfter: initialAfterFromUrl,
  });

  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  return (
    <Suspense fallback={<Loading />}>
      {queryRef ? (
        <CustomRecapsTableContent
          queryReference={queryRef}
          currentPage={displayPage}
          pageSize={PAGE_SIZE}
          onNext={goNext}
          onPrevious={goPrevious}
          onGoToPage={goToPage}
          isNavigating={isNavigating}
          onPageLoaded={handlePageLoaded}
          emptyMessage={emptyMessage}
          returnPage={displayPage}
          returnAfter={currentAfterCursor}
        />
      ) : (
        <Loading />
      )}
    </Suspense>
  );
};

type FilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

// ======================================================
// PAGE
// ======================================================
const RecapCustomList = () => {
  const { tenantId } = useAuthStore();
  const refreshRef = useRef<(() => void) | null>(null);

  const [eventAddress, setEventAddress] = useState<string>("");
  const [eventSearchInput, setEventSearchInput] = useState<string>("");
  const [eventSearch, setEventSearch] = useState<string>("");
  const [stateSearchInput, setStateSearchInput] = useState<string>("");
  const [stateSearch, setStateSearch] = useState<string>("");
  const [rmmSearch, setRmmSearch] = useState("");
  const [rmmOptions, setRmmOptions] = useState<FilterOption[]>([]);
  const rmmRequestIdRef = useRef(0);

  const { control, watch, setValue } = useForm<{
    eventAddress: string;
    eventId: string | null;
    stateId: string | null;
    eventDate: string;
    rmmAsignedId: string | null;
  }>({
    defaultValues: {
      eventAddress: "",
      eventId: null,
      stateId: null,
      eventDate: "",
      rmmAsignedId: null,
    },
  });

  const eventAddressInput = watch("eventAddress");
  const selectedEventId = watch("eventId") ?? "";
  const selectedStateId = watch("stateId") ?? "";
  const selectedEventDate = watch("eventDate") ?? "";
  const selectedRmmId = watch("rmmAsignedId") ?? "";

  const loadRmm = useCallback(
    async (query: string) => {
      if (!tenantId) return;
      const requestId = ++rmmRequestIdRef.current;

      const data = await fetchQuery<RmmClientsQueryType>(
        environment,
        RmmClientsQuery,
        {
          tenantId,
          q: query || null,
        },
      ).toPromise();

      if (rmmRequestIdRef.current !== requestId) return;

      const options =
        data?.rmmClients?.map((rmm) => ({
          value: rmm.id,
          label: rmm.firstName
            ? `${rmm.firstName} ${rmm.lastName}`
            : rmm.username,
          searchText: [rmm.firstName, rmm.lastName, rmm.username]
            .filter(Boolean)
            .join(" "),
        })) ?? [];

      setRmmOptions(options);
    },
    [tenantId],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEventAddress(eventAddressInput?.trim() ?? "");
    }, 500);
    return () => window.clearTimeout(handle);
  }, [eventAddressInput]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setEventSearch(eventSearchInput.trim());
    }, 500);
    return () => window.clearTimeout(handle);
  }, [eventSearchInput]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setStateSearch(stateSearchInput.trim());
    }, 500);
    return () => window.clearTimeout(handle);
  }, [stateSearchInput]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadRmm(rmmSearch.trim());
    }, 500);
    return () => window.clearTimeout(handle);
  }, [rmmSearch, loadRmm]);

  // =========================
  // DROPDOWN DATA
  // =========================
  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      filters: { tenantId: tenantId || undefined },
      q: eventSearch || undefined,
    },
    { fetchPolicy: "store-and-network" },
  );

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {
      q: stateSearch || undefined,
      first: 200,
    },
    { fetchPolicy: "store-and-network" },
  );

  const eventOptions = useMemo(
    () =>
      eventsData.events.edges.map((edge) => {
        const dateLabel = edge.node.startTime
          ? new Date(edge.node.startTime).toLocaleDateString()
          : "";
        return {
          value: edge.node.id,
          label: dateLabel
            ? `${edge.node.name} – ${dateLabel}`
            : edge.node.name,
        };
      }),
    [eventsData],
  );

  const stateOptions = useMemo(
    () =>
      statesData.states.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [statesData],
  );

  const filters = useMemo(() => {
    if (!tenantId) {
      return undefined;
    }

    return {
      tenantId,
      approved: true,
      eventId: selectedEventId || undefined,
      eventAddress: eventAddress || undefined,
      stateId: selectedStateId || undefined,
      eventDate: selectedEventDate || undefined,
      rmmAsignedId: selectedRmmId || undefined,
    };
  }, [
    tenantId,
    selectedEventId,
    eventAddress,
    selectedStateId,
    selectedEventDate,
    selectedRmmId,
  ]);

  const emptyMessage =
    selectedEventId || selectedStateId || selectedEventDate || eventAddress || selectedRmmId
      ? "No custom recaps found matching these filters."
      : "No custom recaps found.";

  return (
    <Layout>
      {/* =========================
          HEADER
      ========================= */}
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CameraIcon className="w-6 h-6" />
            </div>
            <h1>Custom Recaps</h1>
          </div>
          <p className="text-base-content/70">Manage your custom recaps.</p>
        </div>
        <ImportConnecteamButton
          onImported={() => refreshRef.current?.()}
        />
      </div>

      {/* =========================
          CONTENT
      ========================= */}
      <div className="flex flex-col gap-4">
        {/* FILTERS PANEL */}
        <div className="spark-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <FilterIcon className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-base-content/70">
                Filters
              </h2>
            </div>
            
            <div className="flex gap-2">
               <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => refreshRef.current?.()}
              >
                <ArrowPathIcon className="w-4 h-4 text-primary" />
                Refresh
              </button>

              {(selectedEventId ||
                eventAddress ||
                selectedStateId ||
                selectedEventDate ||
                selectedRmmId) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => {
                    setValue("eventId", null);
                    setValue("stateId", null);
                    setValue("eventDate", "");
                    setEventAddress("");
                    setValue("eventAddress", "");
                    setValue("rmmAsignedId", null);
                    setEventSearchInput("");
                    setStateSearchInput("");
                    setRmmSearch("");
                  }}
                >
                  <FunnelXIcon className="w-4 h-4" />
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
             <FormAutocomplete
                name="eventId"
                control={control}
                label="Event"
                options={eventOptions}
                placeholder="Search event"
                disabled={eventOptions.length === 0}
                onSearch={setEventSearchInput}
              />
               <FormAutocomplete
                name="rmmAsignedId"
                control={control}
                label="RMM Client"
                options={rmmOptions}
                placeholder="Search RMM client"
                disabled={rmmOptions.length === 0}
                onSearch={setRmmSearch}
              />
              <FormAutocomplete
                name="stateId"
                control={control}
                label="State"
                options={stateOptions}
                placeholder="Search state"
                disabled={stateOptions.length === 0}
                onSearch={setStateSearchInput}
              />
              <FormInputText
                name="eventAddress"
                control={control}
                label="Event Address"
                placeholder="Address..."
              />
              <FormDatePicker
                name="eventDate"
                control={control}
                label="Event Date"
                placeholder="MM/DD/YYYY"
              />
          </div>
        </div>

        <div className="mt-2">
          {tenantId ? (
            <CustomRecapsListInner
              key={`${tenantId}::${selectedEventId}::${selectedStateId}::${eventAddress}::${selectedEventDate}::${selectedRmmId}`} 
              filters={filters}
              emptyMessage={emptyMessage}
              onRefreshReady={(fn) => (refreshRef.current = fn)}
            />
          ) : (
            <div className="alert alert-warning">
              <span>Tenant ID is required to load custom recaps.</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RecapCustomList;
