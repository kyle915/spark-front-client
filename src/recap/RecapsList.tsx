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
import {
  useLazyLoadQuery,
  useMutation,
  usePreloadedQuery,
} from "react-relay/hooks";
import DataTableRelay from "@/shared/DataTableRelay";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { StatesQuery } from "@/api/queries/StatesQuery";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { StatesQuery as StatesQueryType } from "@/api/queries/__generated__/StatesQuery.graphql";
import type { RecapsQuery as RecapsQueryType } from "@/api/queries/__generated__/RecapsQuery.graphql";

import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

// import { ApproveRecapMutation } from "@api/mutations/ApproveRecapMutation";
// import type { ApproveRecapMutation as ApproveRecapMutationType } from "@api/mutations/__generated__/ApproveRecapMutation.graphql";
import { GenerateRecapPdfMutation } from "@/api/mutations/GenerateRecapPdfMutation";
import type { GenerateRecapPdfMutation as GenerateRecapPdfMutationType } from "@api/mutations/__generated__/GenerateRecapPdfMutation.graphql";
import type { PreloadedQuery } from "react-relay";
import type { RecapRow } from "@/types/columnsTypes";
import { createRecapColumns } from "@/utils/columns";
import { ArrowPathIcon, CameraIcon } from "@heroicons/react/24/solid";
import {
  // CheckCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  // PencilIcon,
  // XCircleIcon,
} from "@heroicons/react/24/outline";

import { Link, useSearchParams } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { Funnel, FunnelXIcon } from "lucide-react";
import { useAlertStore } from "@/store/alertStore";
import { useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormDatePicker from "@/shared/FormDatePicker";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";

const PAGE_SIZE = 10;

// ======================================================
// TABLE CONTENT
// ======================================================
type RecapsTableContentProps = {
  queryReference: PreloadedQuery<RecapsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  emptyMessage: string;
  exportingId: string | null;
  isExporting: boolean;
  returnPage: number;
  returnAfter: string | null;
  onExportPdf: (recap: RecapRow) => void;
  // onApprove: (recap: RecapRow) => void;
  // onDecline: (recap: RecapRow) => void;
  // approvingId: string | null;
  // targetApproval: boolean | null;
  // isApproving: boolean;
};

const RecapsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  emptyMessage,
  exportingId,
  isExporting,
  returnPage,
  returnAfter,
  onExportPdf,
}: // onApprove,
// onDecline,
// approvingId,
// targetApproval,
// isApproving,
RecapsTableContentProps) => {
  const data = usePreloadedQuery<RecapsQueryType>(RecapsQuery, queryReference);
  const connection = data.recaps;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Recap data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<RecapRow>
      connection={connection}
      columns={createRecapColumns()}
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
                return `/recap/view/${row.uuid}?${params.toString()}`;
              })()}
              className="btn btn-xs btn-outline"
            >
              <EyeIcon className="w-5 h-5" />
              View
            </Link>

            <button
              type="button"
              className="btn btn-xs btn-outline text-info disabled:text-info/50"
              onClick={() => onExportPdf(row)}
              disabled={isExporting}
              aria-label="Export recap PDF"
            >
              {isExporting && exportingId === row.id ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Export PDF
                </>
              )}
            </button>

            {/* <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => navigate(`/recap/edit/${row.uuid}`)}
            >
              <PencilIcon className="w-5 h-5" />
            </button> */}
            {/* <button
              type="button"
              className="btn btn-xs btn-outline btn-success tooltip disabled:text-success/50 hover:text-white"
              onClick={() => onApprove(row)}
              disabled={isApproving || Boolean(row.approved)}
              data-tip={row.approved ? "Already approved" : "Approve recap"}
              aria-label="Approve recap"
            >
              {isApproving &&
              approvingId === row.id &&
              targetApproval === true ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <CheckCircleIcon className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline btn-error tooltip disabled:text-error/50 hover:text-white"
              onClick={() => onDecline(row)}
              disabled={isApproving || !row.approved}
              data-tip={!row.approved ? "Already declined" : "Decline recap"}
              aria-label="Decline recap"
            >
              {isApproving &&
              approvingId === row.id &&
              targetApproval === false ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <XCircleIcon className="w-5 h-5" />
              )}
            </button> */}
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
type RecapsListInnerProps = {
  filters?: {
    tenantId?: string;
    eventId?: string;
    eventAddress?: string;
    stateId?: string;
    eventDate?: string;
    rmmAsignedId?: string;
  };
  emptyMessage: string;
  onRefreshReady?: (refreshFn: () => void) => void;
};

const RecapsListInner = ({
  filters,
  emptyMessage,
  onRefreshReady,
}: RecapsListInnerProps) => {
  const [searchParams] = useSearchParams();
  const showAlert = useAlertStore((state) => state.showAlert);
  // const [approvingId, setApprovingId] = useState<string | null>(null);
  // const [targetApproval, setTargetApproval] = useState<boolean | null>(null);
  // const [commitApprove, isApproving] =
  // useMutation<ApproveRecapMutationType>(ApproveRecapMutation);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [commitGeneratePdf, isExporting] =
    useMutation<GenerateRecapPdfMutationType>(GenerateRecapPdfMutation);

  const initialPageFromUrl = useMemo(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }, [searchParams]);

  const initialAfterFromUrl = useMemo(() => {
    const value = searchParams.get("after");
    return value && value.length > 0 ? value : null;
  }, [searchParams]);

  const recapFilters = useMemo(
    () => ({
      ...filters,
      approved: true,
    }),
    [filters],
  );

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
  } = useRelayPagination<RecapsQueryType>({
    query: RecapsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters: recapFilters },
    initialPage: initialPageFromUrl,
    initialAfter: initialAfterFromUrl,
  });

  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  // const handleSetRecapApproval = useCallback(
  //   (recap: RecapRow, approved: boolean) => {
  //     if (!recap.id) return;

  //     // setApprovingId(recap.id);
  //     // setTargetApproval(approved);
  //     commitApprove({
  //       variables: { input: { id: recap.id, approved } },
  //       onCompleted: (response) => {
  //         const payload = response.approveRecap;
  //         if (payload.success) {
  //           showAlert(
  //             payload.message ?? "Recap updated successfully",
  //             "success"
  //           );
  //           refresh();
  //         } else {
  //           showAlert(
  //             payload.message ?? "Failed to update recap status",
  //             "error"
  //           );
  //         }
  //         setApprovingId(null);
  //         setTargetApproval(null);
  //       },
  //       onError: (error) => {
  //         showAlert(error.message, "error");
  //         setApprovingId(null);
  //         setTargetApproval(null);
  //       },
  //     });
  //   },
  //   [commitApprove, refresh, showAlert]
  // );

  const handleExportPdf = useCallback(
    (recap: RecapRow) => {
      if (!recap.id) return;

      setExportingId(recap.id);
      commitGeneratePdf({
        variables: { input: { id: recap.id } },
        onCompleted: (response) => {
          const payload = response.generateRecapPdf;
          if (payload.success) {
            const fileUrl = payload.recapFile?.file;
            if (fileUrl) {
              const newTab = window.open(
                fileUrl,
                "_blank",
                "noopener,noreferrer",
              );
              if (!newTab) {
                window.location.assign(fileUrl);
                showAlert("Popup blocked. Opened PDF in this tab.", "warning");
              } else {
                showAlert(
                  payload.message ?? "PDF generated successfully",
                  "success",
                );
              }
            } else {
              showAlert("PDF generated but file URL is missing", "warning");
            }
          } else {
            showAlert(payload.message ?? "Failed to generate PDF", "error");
          }
          setExportingId(null);
        },
        onError: (error) => {
          showAlert(error.message, "error");
          setExportingId(null);
        },
      });
    },
    [commitGeneratePdf, showAlert],
  );

  return (
    <Suspense fallback={<Loading />}>
      {queryRef ? (
        <RecapsTableContent
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
          // onApprove={(recap) => handleSetRecapApproval(recap, true)}
          // onDecline={(recap) => handleSetRecapApproval(recap, false)}
          // approvingId={approvingId}
          // targetApproval={targetApproval}
          // isApproving={isApproving}
          onExportPdf={handleExportPdf}
          exportingId={exportingId}
          isExporting={isExporting}
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
const RecapList = () => {
  const { tenantId } = useAuthStore();
  const refreshRef = useRef<(() => void) | null>(null);
  const [eventAddress, setEventAddress] = useState<string>("");
  const [eventSearchInput, setEventSearchInput] = useState<string>("");
  const [eventSearch, setEventSearch] = useState<string>("");
  const [stateSearchInput, setStateSearchInput] = useState<string>("");
  const [stateSearch, setStateSearch] = useState<string>("");
  const { control, watch, setValue } = useForm<{
    eventAddress: string;
    eventId: string | null;
    stateId: string | null;
    eventDate: string;
    rmmAsignedId: string | null; // 👈 NUEVO
  }>({
    defaultValues: {
      eventAddress: "",
      eventId: null,
      stateId: null,
      eventDate: "",
      rmmAsignedId: null, // 👈 NUEVO
    },
  });
  const [rmmOptions, setRmmOptions] = useState<FilterOption[]>([]);
  const [rmmSearch, setRmmSearch] = useState("");
  const rmmRequestIdRef = useRef(0);

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
  // EVENTS (FROM TENANT)
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
    selectedEventId || selectedStateId || selectedEventDate
      ? "No recaps found for this event."
      : "No recaps found.";

  return (
    <Layout>
      {/* =========================
          HEADER
      ========================= */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CameraIcon className="w-6 h-6" />
          </div>
          <h1>Recaps</h1>
        </div>
        <p className="text-base-content/70">
          Manage your event recaps and summaries.
        </p>
      </div>

      {/* =========================
          FILTERS
      ========================= */}
      <div className="flex flex-col gap-4">
        <div className="spark-card">
          <div className="flex items-center justify-between cursor-pointer px-6 py-4 select-none">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Funnel size={18} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-base-content">
                  Filters
                </h3>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => refreshRef.current?.()}
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Refresh
                </button>

                {(selectedEventId ||
                  eventAddress ||
                  selectedStateId ||
                  selectedEventDate) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setValue("eventId", null);
                        setValue("stateId", null);
                        setValue("eventDate", "");
                        setEventAddress("");
                        setValue("eventAddress", "");
                        setEventSearchInput("");
                        setStateSearchInput("");
                      }}
                    >
                      <FunnelXIcon className="w-4 h-4" />
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-2 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="w-full max-w-sm">
                <FormAutocomplete
                  name="eventId"
                  control={control}
                  label="Event"
                  options={eventOptions}
                  placeholder="Search event"
                  disabled={eventOptions.length === 0}
                  onSearch={setEventSearchInput}
                />
              </div>
              <div className="w-full max-w-sm">
                <FormAutocomplete
                  name="rmmAsignedId"
                  control={control}
                  label="RMM Client"
                  options={rmmOptions}
                  placeholder="Search RMM client"
                  disabled={rmmOptions.length === 0}
                  onSearch={setRmmSearch}
                />
              </div>
              <div className="w-full max-w-sm">
                <FormAutocomplete
                  name="stateId"
                  control={control}
                  label="State"
                  options={stateOptions}
                  placeholder="Search state"
                  disabled={stateOptions.length === 0}
                  onSearch={setStateSearchInput}
                />
              </div>
              <div className="w-full max-w-sm">
                <FormInputText
                  name="eventAddress"
                  control={control}
                  label="Event Address"
                  placeholder="Search address"
                />
              </div>
              <div className="w-full max-w-sm">
                <FormDatePicker
                  name="eventDate"
                  control={control}
                  label="Event Date"
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2">
          {/* =========================
          TABLE
      ========================= */}
          {tenantId ? (
            <RecapsListInner
              key={`${tenantId}::${selectedEventId}::${selectedStateId}::${eventAddress}::${selectedEventDate}-${selectedRmmId}`} // Reset inner state when filters change
              filters={filters}
              emptyMessage={emptyMessage}
              onRefreshReady={(fn) => (refreshRef.current = fn)}
            />
          ) : (
            <div className="alert alert-warning">
              <span>Tenant ID is required to load recaps.</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RecapList;
