import { Controller, useForm, useWatch } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import FormInputText from "@/shared/FormInputText";
import FormInputTime from "@/shared/FormInputTime";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormAddressSearch from "@/shared/FormAddressSearch";
import FormDatePicker from "@/shared/FormDatePicker";
import EditableLocationMap from "@/shared/EditableLocationMap";
import FormCheckbox from "@/shared/FormCheckbox";
import FormTextarea from "@/shared/FormTextarea";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { SaveIcon } from "lucide-react";
import type { Path, PathValue } from "react-hook-form";
import {
  resolveTimezoneIdByCityAndDate,
  resolveTimezoneIdByCoordinates,
  resolveTimezoneIdByDate,
  getCoordinatesByCity,
} from "@/utils";

import { useMutation } from "react-relay/hooks";
import type { OperationType } from "relay-runtime";
import { useAlertStore } from "@store/alertStore";

import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";

import { CreateRequestStoreManagerMutation } from "@api/mutations/CreateRequestStoreManagerMutation";
import type { CreateRequestStoreManagerMutation as CreateRequestStoreManagerMutationType } from "@api/mutations/__generated__/CreateRequestStoreManagerMutation.graphql";

import { CreateDistributorMutation } from "@api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";

import { CreateRetailerMutation } from "@api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@api/mutations/__generated__/CreateRetailerMutation.graphql";

import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { RetailersQuery } from "@api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";
import { BillingEntitiesQuery } from "@api/queries/BillingEntitiesQuery";
import { useEntitiesByLocation } from "../hooks/useEntitiesByLocation";
import { useLocationsByState } from "../hooks/useLocationsByState";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

export interface RequestFormValues {
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  address: string;
  coordinates?: number[] | null;
  timezoneId?: string | null;
  retailerId?: string | null;
  distributorId?: string | null;
  billingEntityId?: string | null;
  requestTypeId?: string | null;
  rmmAsignedId?: string;
  eventTypeId?: string | null;
  clientName?: string;
  clientEmail?: string;
  entitiesLocationId?: string | null;
  entitiesLocationName?: string | null;
  distributorName?: string;
  distributorEmail?: string;
  retailerName?: string;
  retailerAddress?: string;
  retailerStoreContact?: string;
  storeManagerName?: string;
  storeManagerPhone?: string;
  storeManagerId?: string | null;
  distributorLocationId?: string | null;
  retailerLocationId?: string | null;
  isTableNeeded?: boolean;
  tableSize?: string;
  products?: string[];
  stateId?: string | null;
  isNationalRetailer?: boolean;
  notes?: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  storeContact?: string | null;
  code?: string | null;
}

interface RmmClientItem {
  id: string;
  uuid: string;
  firstName: string;
  lastName: string;
}

interface ProductItem {
  id: string;
  name: string;
  image?: string | null;
  productType?: { id: string; name: string } | null;
}

interface TimezoneItem {
  id: string;
  name: string;
  code: string;
  offset: number;
}

interface StoreManagerItem {
  id: string;
  name: string;
  phone: string;
}

type BillingEntityItem = {
  id: string;
  uuid: string;
  name: string;
};

type BillingEntitiesQueryType = OperationType & {
  response: {
    billingEntities?: {
      edges?: Array<{
        node?: BillingEntityItem | null;
      } | null> | null;
    } | null;
  };
  variables: {
    filters?: {
      tenantId?: string | null;
      tenantUuid?: string | null;
    } | null;
    q?: string | null;
    first?: number | null;
    after?: string | null;
    last?: number | null;
    before?: string | null;
  };
};

interface RequestFormProps {
  mode: "create" | "edit";
  tenantId: string;
  onSubmit: (data: RequestFormValues) => void;
  defaultValues?: Partial<RequestFormValues>;
  clients?: CatalogItem[];
  eventTypes?: CatalogItem[];
  rmmClients?: RmmClientItem[];
  userIdLoggin: string;
  userUuidLoggin?: string;
  // retailers?: CatalogItem[];
  // distributors?: CatalogItem[];
  requestTypes: CatalogItem[];
  timezones?: TimezoneItem[];
  productTypes?: CatalogItem[];
  products?: ProductItem[];
  productsLoading?: boolean;
  selectedProductType?: string;
  onProductTypeChange?: (productTypeId: string) => void;
  requestId?: string | null;
  requestStoreManagers?: StoreManagerItem[];
  // locations?: CatalogItem[];
  states?: CatalogItem[];
  disableStateSelect?: boolean;
  hideTableNeededFields?: boolean;
  hideDistributorFields?: boolean;
  hideEventTypeField?: boolean;
  showBillingEntityField?: boolean;

  onRefetch?: (
    key: "distributors" | "retailers" | "requestStoreManagers",
  ) => void;

  enableContactSection?: boolean;
  contactMode?: "request" | "manual";
  // Create-only: admin opt-in to email the client a confirmation. When the
  // handler is provided (CreateRequest passes it for admins), the checkbox
  // renders near the submit button. Edit path never passes these.
  notifyRequestor?: boolean;
  onNotifyRequestorChange?: (checked: boolean) => void;
  requestContactInfo?: Partial<
    Pick<
      RequestFormValues,
      | "distributorName"
      | "distributorEmail"
      | "retailerName"
      | "retailerAddress"
      | "retailerStoreContact"
      | "storeManagerName"
      | "storeManagerPhone"
    >
  >;
}

// Pagination Products (Temporary)
const PAGE_SIZE = 12;

export default function RequestForm({
  mode,
  onSubmit,
  defaultValues = {},
  rmmClients = [],
  userIdLoggin = "",
  userUuidLoggin = "",
  // retailers = [],
  // distributors = [],
  requestTypes,
  timezones = [],
  eventTypes = [],
  productTypes = [],
  products = [],
  productsLoading = false,
  selectedProductType = "",
  onProductTypeChange,
  tenantId,
  requestId = null,
  requestStoreManagers = [],
  onRefetch,
  enableContactSection = false,
  contactMode,
  notifyRequestor = false,
  onNotifyRequestorChange,
  requestContactInfo,
  states = [],
  disableStateSelect = false,
  hideTableNeededFields = false,
  hideDistributorFields = false,
  hideEventTypeField = false,
  showBillingEntityField = false,
}: RequestFormProps) {
  const [localSelectedProductType, setLocalSelectedProductType] =
    useState(selectedProductType);

  const resolvedSelectedProductType =
    onProductTypeChange !== undefined
      ? selectedProductType
      : localSelectedProductType;

  const safeDefaultValues: RequestFormValues = {
    name: "",
    date: "",
    startTime: "",
    endTime: "",
    address: "",
    coordinates: null,
    timezoneId: null,
    retailerId: null,
    distributorId: null,
    eventTypeId: "",
    requestTypeId: null,
    rmmAsignedId: userIdLoggin,
    clientName: "",
    clientEmail: "",
    distributorName: "",
    distributorEmail: "",
    retailerName: "",
    retailerAddress: "",
    retailerStoreContact: "",
    storeManagerName: "",
    storeManagerPhone: "",
    isTableNeeded: false,
    tableSize: "",
    products: [],
    stateId: null,
    isNationalRetailer: true,
    notes: "",
    distributorLocationId: null,
    retailerLocationId: null,
    entitiesLocationId: null,
    ...defaultValues,
  };
  if (!safeDefaultValues.eventTypeId && eventTypes.length === 1) {
    safeDefaultValues.eventTypeId = eventTypes[0].id;
  }

  const { showAlert } = useAlertStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ========================
  // INITIALIZE FORM AND FORM STATE
  // ========================
  const { handleSubmit, control, watch, setValue, formState, trigger } =
    useForm<RequestFormValues>({ defaultValues: safeDefaultValues });

  const isDirty = formState.isDirty;

  // One program is not a question — hide the picker (same rule as check-in)
  // and stamp the sole EventType so submit still has a required id.
  useEffect(() => {
    if (eventTypes.length !== 1) return;
    const current = watch("eventTypeId");
    if (current) return;
    setValue("eventTypeId", eventTypes[0].id, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [eventTypes, setValue, watch]);

  // ========================
  // WATCHERS FOR COORDINATES & TIMEZONE AND HOOK
  // ========================
  const selectedCoordinates = watch("coordinates");
  const selectedTimezoneId = watch("timezoneId");

  /* ================= WATCH FOR SECTION ENTITIES ================= */
  const distributorId = watch("distributorId");
  const retailerId = watch("retailerId");
  const retailerNameValue = watch("retailerName");
  const storeManagerId = watch("storeManagerId");
  const distributorLocationId = watch("distributorLocationId");
  const retailerLocationId = watch("retailerLocationId");
  const selectedStateId = watch("stateId");
  const prevStateIdRef = useRef<string | null | undefined>(undefined);
  const prevEntitiesLocationIdRef = useRef<string | null | undefined>(
    undefined,
  );
  const notesValue = watch("notes") || "";
  const selectedEntitiesLocationId = watch("entitiesLocationId");
  const isEntitiesLocationSelected = Boolean(selectedEntitiesLocationId);
  const isStateSelected = Boolean(selectedStateId);
  const isNationalRetailer = watch("isNationalRetailer") ?? true;
  const prevIsNationalRetailerRef = useRef<boolean | undefined>(undefined);
  const selectedRequestTypeId = watch("requestTypeId");

  useEffect(() => {
    if (mode !== "create") return;
    if (!userIdLoggin && !userUuidLoggin) return;
    if (!rmmClients.length) return;

    const selectedRmm =
      rmmClients.find((c) => c.id === userIdLoggin) ??
      rmmClients.find((c) => c.uuid === userUuidLoggin);

    if (selectedRmm) {
      setValue("rmmAsignedId", selectedRmm.id, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [mode, userIdLoggin, userUuidLoggin, rmmClients, setValue]);

  useEffect(() => {
    if (prevStateIdRef.current === undefined) {
      prevStateIdRef.current = selectedStateId;
      return;
    }

    if (prevStateIdRef.current === (selectedStateId ?? null)) return;

    const isInitialEditLoad =
      mode === "edit" && !prevStateIdRef.current && selectedStateId;

    prevStateIdRef.current = selectedStateId ?? null;

    if (isInitialEditLoad) return;

    // =========================
    // RESET
    // =========================
    setValue("entitiesLocationId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });

    setValue("distributorId", null, { shouldDirty: true, shouldTouch: true });
    setValue("retailerId", null, { shouldDirty: true, shouldTouch: true });
    setValue("storeManagerId", null, { shouldDirty: true, shouldTouch: true });

    setValue("distributorLocationId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("retailerLocationId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });

    setValue("distributorName", "", { shouldDirty: true, shouldTouch: true });
    setValue("distributorEmail", "", { shouldDirty: true, shouldTouch: true });
    setValue("retailerName", "", { shouldDirty: true, shouldTouch: true });
    setValue("retailerAddress", "", { shouldDirty: true, shouldTouch: true });
    setValue("retailerStoreContact", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [selectedStateId, setValue]);

  // ========================
  // HIDE DISTRIBUTOR FOR REQUEST TYPE: Event Activation
  // ========================
  const isEventActivation = useMemo(() => {
    const selected = requestTypes.find((rt) => rt.id === selectedRequestTypeId);

    return selected?.name === "Event Activation";
  }, [selectedRequestTypeId, requestTypes]);

  const extractRmmClients = useCallback(
    (data: RmmClientsQueryType["response"]) =>
      data.rmmClients?.flatMap((e) => (e ? [e] : [])) ?? [],
    [],
  );

  const rmmSearchVariables = useMemo(() => ({ tenantId }), [tenantId]);

  const rmmSearchHook = useSearchQuery<
    { id: string; uuid: string; firstName: string; lastName: string },
    RmmClientsQueryType
  >({
    queryDocument: RmmClientsQuery,
    extractNodes: extractRmmClients,
    variables: rmmSearchVariables,
    minLength: 1,
  });

  const rmmOptions = useMemo(() => {
    const source =
      rmmSearchHook.searchTerm.trim().length >= 1
        ? rmmSearchHook.items
        : rmmClients;

    return source.map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
    }));
  }, [rmmSearchHook.searchTerm, rmmSearchHook.items, rmmClients]);

  const extractBillingEntities = useCallback(
    (data: BillingEntitiesQueryType["response"]) =>
      data.billingEntities?.edges?.flatMap((edge) =>
        edge?.node ? [edge.node] : [],
      ) ?? [],
    [],
  );

  const billingEntitiesSearchHook = useSearchQuery<
    BillingEntityItem,
    BillingEntitiesQueryType
  >({
    queryDocument: BillingEntitiesQuery,
    extractNodes: extractBillingEntities,
    variables: {
      filters: { tenantId },
      first: 100,
    },
    minLength: 0,
  });

  const billingEntityOptions = useMemo(
    () =>
      billingEntitiesSearchHook.items.map((billingEntity) => ({
        value: billingEntity.id,
        label: billingEntity.name,
      })),
    [billingEntitiesSearchHook.items],
  );

  // ========================
  // LOCATIONS (CITY) BY STATE WITH SEARCH
  // ========================
  const extractLocations = useCallback(
    (data: LocationsQueryType["response"]) =>
      data.locations?.edges?.flatMap((e) => (e?.node ? [e.node] : [])) ?? [],
    [],
  );

  const locationsHook = useLocationsByState<
    { id: string; name: string },
    LocationsQueryType
  >({
    stateId: selectedStateId ?? null,
    queryDocument: LocationsQuery,
    extractNodes: extractLocations,
    initialItems: defaultValues?.entitiesLocationId
      ? [
          {
            id: defaultValues.entitiesLocationId,
            name: (defaultValues as any).entitiesLocationName || "",
          },
        ]
      : [],
  });

  /* ================= DISTRIBUTORS AND RETAILERS ================= */
  const extractDistributors = useCallback(
    (data: DistributorsQueryType["response"]) =>
      data.distributors?.edges?.flatMap((e) => (e?.node ? [e.node] : [])) ?? [],
    [],
  );

  const distributorsHook = useEntitiesByLocation<
    CatalogItem,
    DistributorsQueryType
  >({
    tenantId,
    entitiesLocationId: selectedEntitiesLocationId ?? null,
    stateId: selectedStateId ?? null,
    filterByStateOnly: mode === "create",
    initialItems: defaultValues?.distributorId
      ? [
          {
            id: defaultValues.distributorId,
            name: (defaultValues as any).distributorName || "",
          },
        ]
      : [],
    queryDocument: DistributorsQuery,
    extractNodes: extractDistributors,
  });

  const extractRetailers = useCallback(
    (data: RetailersQueryType["response"]) =>
      data.retailers?.edges?.flatMap((e) => (e?.node ? [e.node] : [])) ?? [],
    [],
  );

  const retailerAdditionalFilters = useMemo(
    () => ({ isNational: isNationalRetailer }),
    [isNationalRetailer],
  );

  const retailersHook = useEntitiesByLocation<CatalogItem, RetailersQueryType>({
    tenantId,
    entitiesLocationId: selectedEntitiesLocationId ?? null,
    locationIdRequired: !isNationalRetailer,
    additionalFilters: retailerAdditionalFilters,
    initialItems: defaultValues?.retailerId
      ? [
          {
            id: defaultValues.retailerId,
            name: (defaultValues as any).retailerName || "",
          },
        ]
      : [],
    queryDocument: RetailersQuery,
    extractNodes: extractRetailers,
  });

  useEffect(() => {
    if (!retailerId) return;

    const selectedRetailer = retailersHook.items.find(
      (item) => item.id === retailerId,
    );
    const selectedRetailerName = selectedRetailer?.name?.trim();
    if (!selectedRetailerName) return;
    if ((retailerNameValue ?? "").trim() === selectedRetailerName) return;

    setValue("retailerName", selectedRetailerName, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [retailerId, retailerNameValue, retailersHook.items, setValue]);

  /* ================= UI STATE ================= */
  const [showDistributorLocation, setShowDistributorLocation] = useState(false);
  const [showRetailerLocation, setShowRetailerLocation] = useState(false);
  const [showStoreManagerCreate, setShowStoreManagerCreate] = useState(false);

  const storeManagerOptions = useMemo(
    () =>
      (requestStoreManagers ?? []).map((m) => ({
        value: m.id,
        label: m.phone ? `${m.name} (${m.phone})` : m.name,
      })),
    [requestStoreManagers],
  );

  const [commitCreateDistributor, isCreatingDistributor] =
    useMutation<CreateDistributorMutationType>(CreateDistributorMutation);

  const [commitCreateRetailer, isCreatingRetailer] =
    useMutation<CreateRetailerMutationType>(CreateRetailerMutation);

  const [commitCreateStoreManager, isCreatingStoreManager] =
    useMutation<CreateRequestStoreManagerMutationType>(
      CreateRequestStoreManagerMutation,
    );

  const manualFields = useWatch({ control });

  const effectiveContactMode = useMemo(
    () => contactMode ?? (requestContactInfo ? "request" : "manual"),
    [contactMode, requestContactInfo],
  );

  const showContactSection = useMemo(() => {
    if (enableContactSection !== undefined) return enableContactSection;
    return Boolean(requestContactInfo);
  }, [enableContactSection, requestContactInfo]);

  const contactInfo = useMemo(() => {
    if (effectiveContactMode === "request") return requestContactInfo ?? {};
    return {
      distributorName: manualFields.distributorName ?? null,
      distributorEmail: manualFields.distributorEmail ?? null,
      retailerName: manualFields.retailerName ?? null,
      retailerAddress: manualFields.retailerAddress ?? null,
      retailerStoreContact: manualFields.retailerStoreContact ?? null,
      storeManagerName: manualFields.storeManagerName ?? null,
      storeManagerPhone: manualFields.storeManagerPhone ?? null,
    };
  }, [effectiveContactMode, manualFields, requestContactInfo]);

  const handleCreateDistributor = () => {
    const { distributorName, distributorEmail } = contactInfo;

    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    if (!distributorName || !distributorEmail || !distributorLocationId) {
      showAlert("Missing distributor data.", "error");
      return;
    }

    commitCreateDistributor({
      variables: {
        input: {
          tenantId,
          name: distributorName,
          email: distributorEmail,
          locationId: distributorLocationId,
        },
      },
      updater: (store) => {
        const payload = store.getRootField("createDistributor");
        const newDistributor = payload?.getLinkedRecord("distributor");

        if (!newDistributor) return;

        const root = store.getRoot();
        const distributors = root.getLinkedRecord("distributors");

        if (!distributors) return;

        const edges = distributors.getLinkedRecords("edges") ?? [];

        const newEdge = store.create(
          `edge:${newDistributor.getDataID()}`,
          "DistributorEdge",
        );

        newEdge.setLinkedRecord(newDistributor, "node");

        distributors.setLinkedRecords([...edges, newEdge], "edges");
      },
      onCompleted: (res) => {
        const distributor = res.createDistributor?.distributor;

        if (res.createDistributor?.success && distributor) {
          distributorsHook.addItem(distributor);

          setValue("distributorId", distributor.id, {
            shouldDirty: true,
            shouldTouch: true,
          });

          setShowDistributorLocation(false);

          // limpiar campos
          setValue("distributorName", "");
          setValue("distributorEmail", "");
          setValue("distributorLocationId", null);

          showAlert(res.createDistributor.message, "success");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const handleCreateRetailer = () => {
    const { retailerName, retailerAddress, retailerStoreContact } = contactInfo;

    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    if (!retailerName || !retailerAddress || !retailerLocationId) {
      showAlert("Missing retailer data.", "error");
      return;
    }

    commitCreateRetailer({
      variables: {
        input: {
          tenantId,
          name: retailerName,
          address: retailerAddress,
          storeContact: retailerStoreContact ?? "",
          locationId: retailerLocationId,
        },
      },
      updater: (store) => {
        const payload = store.getRootField("createRetailer");
        const newRetailer = payload?.getLinkedRecord("retailer");
        if (!newRetailer) return;

        const root = store.getRoot();

        const retailersConnection = root.getLinkedRecord("retailers");
        if (!retailersConnection) return;

        const edges = retailersConnection.getLinkedRecords("edges") ?? [];

        const newEdge = store.create(
          `client:newRetailerEdge:${newRetailer.getDataID()}`,
          "RetailerEdge",
        );

        newEdge.setLinkedRecord(newRetailer, "node");

        retailersConnection.setLinkedRecords([...edges, newEdge], "edges");
      },
      onCompleted: (res) => {
        const retailer = res.createRetailer?.retailer;
        if (res.createRetailer?.success && retailer) {
          retailersHook.addItem(retailer);
          setValue("retailerId", retailer.id, {
            shouldDirty: true,
            shouldTouch: true,
          });
          setShowRetailerLocation(false);
          onRefetch?.("retailers");
          // limpiar campos
          setValue("retailerName", "");
          setValue("retailerAddress", "");
          setValue("retailerStoreContact", "");
          setValue("retailerLocationId", null);
          showAlert(res.createRetailer.message, "success");
        } else {
          showAlert(res.createRetailer?.message ?? "Error", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const handleCreateStoreManager = async () => {
    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    const isValid = await trigger(["storeManagerName", "storeManagerPhone"]);
    if (!isValid) {
      showAlert("Please complete store manager information.", "error");
      return;
    }

    const { storeManagerName, storeManagerPhone } = contactInfo;
    if (!storeManagerName || !storeManagerPhone) return;

    commitCreateStoreManager({
      variables: {
        input: {
          tenantId,
          requestId: requestId ?? null,
          name: storeManagerName,
          phone: storeManagerPhone,
        },
      },
      updater: (store) => {
        const payload = store.getRootField("createRequestStoreManager");
        const newManager = payload?.getLinkedRecord("requestStoreManager");
        if (!newManager) return;

        const root = store.getRoot();

        const managersConnection = root.getLinkedRecord("requestStoreManagers");
        if (!managersConnection) return;

        const edges = managersConnection.getLinkedRecords("edges") ?? [];

        const newEdge = store.create(
          `client:newStoreManagerEdge:${newManager.getDataID()}`,
          "RequestStoreManagerEdge",
        );

        newEdge.setLinkedRecord(newManager, "node");

        managersConnection.setLinkedRecords([...edges, newEdge], "edges");
      },
      onCompleted: (res) => {
        const manager = res.createRequestStoreManager?.requestStoreManager;
        if (res.createRequestStoreManager?.success && manager) {
          setValue("storeManagerId", manager.id, {
            shouldDirty: true,
            shouldTouch: true,
          });
          onRefetch?.("requestStoreManagers");
          showAlert(res.createRequestStoreManager.message, "success");
        } else {
          showAlert(
            res.createRequestStoreManager?.message ??
              "Error creating store manager",
            "error",
          );
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const selectedDate = watch("date");
  const previousCityRef = useRef<string | null>(undefined as any);
  const previousDateRef = useRef<string | null>(undefined as any);
  const previousCoordinatesRef = useRef<string | null>(undefined as any);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const handleTimezoneAndMap = async () => {
      if (!timezones.length) return;

      const currentCity =
        locationsHook.items.find((l) => l.id === selectedEntitiesLocationId)
          ?.name ?? null;
      const currentState =
        states.find((s) => s.id === selectedStateId)?.name ?? null;
      const currentDate = selectedDate ?? null;
      const coords = selectedCoordinates;

      const coordsStr = coords ? `${coords[0]},${coords[1]}` : null;

      const isInitial = isInitialMountRef.current;
      if (isInitial) {
        // Initialize refs without triggering updates
        previousCityRef.current = currentCity;
        previousDateRef.current = currentDate;
        previousCoordinatesRef.current = coordsStr;
        isInitialMountRef.current = false;
        return;
      }

      const cityChanged = currentCity !== previousCityRef.current;
      const dateChanged = currentDate !== previousDateRef.current;
      const coordsChanged = coordsStr !== previousCoordinatesRef.current;

      if (!cityChanged && !dateChanged && !coordsChanged) return;

      previousCityRef.current = currentCity;
      previousDateRef.current = currentDate;
      previousCoordinatesRef.current = coordsStr;

      // 1) City changed -> Update Map Coordinates & Timezone
      if (cityChanged && currentCity) {
        const newCoords = await getCoordinatesByCity(currentCity, currentState);
        if (newCoords) {
          setValue("coordinates", [newCoords.lat, newCoords.lng], {
            shouldDirty: true,
            shouldTouch: true,
          });
          previousCoordinatesRef.current = `${newCoords.lat},${newCoords.lng}`;

          let tzId = await resolveTimezoneIdByCoordinates(
            timezones,
            newCoords.lat,
            newCoords.lng,
          );
          if (tzId) {
            tzId =
              resolveTimezoneIdByDate(timezones, currentDate, tzId) ?? tzId;
            setValue("timezoneId", tzId, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        } else {
          // Fallback if no coords found
          const result = await resolveTimezoneIdByCityAndDate(
            timezones,
            currentCity,
            currentState,
            currentDate,
            selectedTimezoneId,
          );
          if (result) {
            setValue("timezoneId", result, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        }
        return;
      }

      // 2) Coordinates changed (from map click or address search) -> Update Timezone
      if (coordsChanged && coords && coords.length === 2) {
        let tzId = await resolveTimezoneIdByCoordinates(
          timezones,
          coords[0],
          coords[1],
        );
        if (tzId) {
          tzId = resolveTimezoneIdByDate(timezones, currentDate, tzId) ?? tzId;
          setValue("timezoneId", tzId, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }
        return;
      }

      // 3) Only Date changed -> Recalculate DST without re-fetching coords if possible
      if (dateChanged && currentDate) {
        if (selectedTimezoneId) {
          const tzId = resolveTimezoneIdByDate(
            timezones,
            currentDate,
            selectedTimezoneId,
          );
          if (tzId && tzId !== selectedTimezoneId) {
            setValue("timezoneId", tzId, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        } else if (coords && coords.length === 2) {
          let tzId = await resolveTimezoneIdByCoordinates(
            timezones,
            coords[0],
            coords[1],
          );
          if (tzId) {
            tzId =
              resolveTimezoneIdByDate(timezones, currentDate, tzId) ?? tzId;
            setValue("timezoneId", tzId, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        } else if (currentCity) {
          const result = await resolveTimezoneIdByCityAndDate(
            timezones,
            currentCity,
            currentState,
            currentDate,
            selectedTimezoneId,
          );
          if (result) {
            setValue("timezoneId", result, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        }
      }
    };

    handleTimezoneAndMap();
  }, [
    selectedEntitiesLocationId,
    selectedStateId,
    selectedDate,
    selectedCoordinates,
    timezones,
    locationsHook.items,
    states,
    selectedTimezoneId,
    setValue,
  ]);

  const isTableNeeded = watch("isTableNeeded");
  const selectedProducts = watch("products") || [];

  const filteredProducts = useMemo(() => {
    if (!resolvedSelectedProductType) return products;
    return products.filter(
      (p) => p.productType?.id === resolvedSelectedProductType,
    );
  }, [products, resolvedSelectedProductType]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [resolvedSelectedProductType]);

  const toggleProduct = (productId: string) => {
    const current = selectedProducts;
    if (current.includes(productId)) {
      noteSet(
        "products",
        current.filter((id) => id !== productId),
      );
    } else {
      noteSet("products", [...current, productId]);
    }
  };

  const noteSet = <TFieldName extends Path<RequestFormValues>>(
    name: TFieldName,
    value: PathValue<RequestFormValues, TFieldName>,
  ) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const stateOptions = useMemo(
    () =>
      states.map((state) => ({
        value: state.id,
        label: state.code ? `${state.name} (${state.code})` : state.name,
        searchText: state.code ? `${state.name} ${state.code}` : state.name,
      })),
    [states],
  );

  // STATE AND LOCATIONS EFFECTS TO QUERY Q
  useEffect(() => {
    if (isEventActivation) {
      setValue("distributorId", null, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [isEventActivation, setValue]);

  useEffect(() => {
    if (mode !== "create") return;

    if (!selectedEntitiesLocationId) return;

    if (!distributorLocationId) {
      setValue("distributorLocationId", selectedEntitiesLocationId, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }

    if (!retailerLocationId) {
      setValue("retailerLocationId", selectedEntitiesLocationId, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [
    mode,
    selectedEntitiesLocationId,
    distributorLocationId,
    retailerLocationId,
    setValue,
  ]);

  useEffect(() => {
    const previousLocationId = prevEntitiesLocationIdRef.current;
    const currentLocationId = selectedEntitiesLocationId ?? null;

    if (previousLocationId === undefined) {
      prevEntitiesLocationIdRef.current = currentLocationId;
      return;
    }

    if (previousLocationId === (currentLocationId ?? null)) return;

    const isInitialEditLoad =
      mode === "edit" && !previousLocationId && currentLocationId;

    prevEntitiesLocationIdRef.current = currentLocationId;

    if (isInitialEditLoad) return;

    // =========================
    // RESET
    // =========================
    setValue("distributorId", null, { shouldDirty: true, shouldTouch: true });
    setValue("retailerId", null, { shouldDirty: true, shouldTouch: true });
    setValue("storeManagerId", null, { shouldDirty: true, shouldTouch: true });

    // Resetear términos de búsqueda en hooks
    distributorsHook.setSearchTerm("");
    retailersHook.setSearchTerm("");
  }, [selectedEntitiesLocationId, setValue, distributorsHook, retailersHook]);

  useEffect(() => {
    if (prevIsNationalRetailerRef.current === undefined) {
      prevIsNationalRetailerRef.current = isNationalRetailer;
      return;
    }

    if (prevIsNationalRetailerRef.current === isNationalRetailer) return;

    const isInitialEditLoad =
      mode === "edit" &&
      prevIsNationalRetailerRef.current === undefined &&
      isNationalRetailer !== undefined;

    prevIsNationalRetailerRef.current = isNationalRetailer;

    if (isInitialEditLoad) return;

    setValue("retailerId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
    retailersHook.setSearchTerm("");
  }, [isNationalRetailer, setValue, retailersHook]);

  useEffect(() => {
    if (!hideTableNeededFields) return;

    setValue("isTableNeeded", false, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("tableSize", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [hideTableNeededFields, setValue]);

  useEffect(() => {
    if (!hideDistributorFields) return;

    setShowDistributorLocation(false);
    setValue("distributorId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("distributorName", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("distributorEmail", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    setValue("distributorLocationId", null, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [hideDistributorFields, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER (match View Request) */}
          <div className="flex flex-col gap-5 border-b border-base-100/20">
            {/* top row */}
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/requests/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/requests/list"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!isDirty}
                >
                  <SaveIcon className="w-4 h-4" />
                  Save changes
                </button>
              </div>
            </div>

            {/* title row */}
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <PencilIcon className="w-6 h-6" />
                  <h1>
                    {mode === "edit"
                      ? (defaultValues?.name ?? "Edit Request")
                      : "Create Request"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {mode === "edit"
                  ? "Update the request information. Changes will apply immediately after saving."
                  : "Fill out the form below to create a new request."}
              </p>
            </div>
          </div>

          {/* BASIC INFORMATION */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText<RequestFormValues>
                name="name"
                control={control}
                placeholder="Enter name"
                label="Name"
                rules={{ required: "Name is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="requestTypeId"
                control={control}
                label="Request Type"
                placeholder="Search request type..."
                options={requestTypes.map((rt) => ({
                  value: rt.id,
                  label: rt.name,
                }))}
                rules={{ required: "Request Type is required" }}
              />

              {!(hideEventTypeField || eventTypes.length <= 1) && (
                <FormAutocomplete<RequestFormValues>
                  name="eventTypeId"
                  control={control}
                  label="Event Type"
                  placeholder="Search event type..."
                  options={eventTypes.map((et) => ({
                    value: et.id,
                    label: et.name,
                  }))}
                  rules={{ required: "Event Type is required" }}
                />
              )}

              <FormDatePicker<RequestFormValues>
                name="date"
                control={control}
                label="Date"
                placeholder="MM/DD/YYYY"
                // Create enforces a 2-day lead time. Edit (admin-only) must NOT:
                // admins need to fix the date/state/market on past or
                // <24h-away requests (e.g. external-form rows that came in
                // without a state), which the lead-time guard otherwise blocks
                // with "Date cannot be earlier than allowed".
                minDaysFromToday={mode === "edit" ? undefined : 2}
                rules={{ required: "Date is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="timezoneId"
                control={control}
                label="Timezone"
                disabled
                placeholder="Select location in map"
                options={timezones.map((tz) => {
                  const sign = tz.offset >= 0 ? "+" : "-";
                  const abs = Math.abs(tz.offset);
                  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
                  const minutes = String(abs % 60).padStart(2, "0");
                  return {
                    value: tz.id,
                    label: `${tz.name}-${tz.code} (UTC${sign}${hours}:${minutes})`,
                  };
                })}
                rules={{ required: "Timezone is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="startTime"
                control={control}
                label="Start Time"
                rules={{ required: "Start Time is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="endTime"
                control={control}
                label="End Time"
                rules={{ required: "End Time is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="rmmAsignedId"
                control={control}
                label="RMM Assigned"
                placeholder="Search RMM..."
                options={rmmOptions}
                onSearch={rmmSearchHook.setSearchTerm}
                loading={rmmSearchHook.isLoading}
              />

              <div className={showBillingEntityField ? "" : "md:col-span-2"}>
                <FormAddressSearch<RequestFormValues>
                  name="address"
                  placeholder="Enter address"
                  control={control}
                  label="Address"
                  rules={{ required: "Address is required" }}
                  onSelect={(result) => {
                    noteSet("coordinates", [result.lat, result.lng]);
                  }}
                />
              </div>

              {showBillingEntityField && (
                <FormAutocomplete<RequestFormValues>
                  name="billingEntityId"
                  control={control}
                  label="Billing Entity"
                  placeholder="Search Billing Entity..."
                  options={billingEntityOptions}
                  onSearch={billingEntitiesSearchHook.setSearchTerm}
                  loading={billingEntitiesSearchHook.isLoading}
                  disabled={!tenantId}
                />
              )}
            </div>
          </section>

          {/* ================= ENTITIES ================= */}
          {(mode === "create" || showContactSection) && (
            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">Event entities</p>
                  <p className="text-sm text-base-content/60">
                    Select existing records or create new ones if needed.
                  </p>
                </div>
                <span className="text-xs text-base-content/60">
                  Retailer & Distributor
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 w-full items-end">
                <FormAutocomplete<RequestFormValues>
                  name="stateId"
                  control={control}
                  label="State"
                  placeholder="Select state..."
                  options={stateOptions}
                  disabled={!tenantId || disableStateSelect}
                  rules={{ required: "State is required" }}
                />

                <Controller
                  name="isNationalRetailer"
                  control={control}
                  render={({ field }) => (
                    <div className="form-control w-full">
                      {/* Espacio invisible para equiparar la altura con el label superior de los autocomplete */}
                      <label className="label">
                        <span className="label-text opacity-0">.</span>
                      </label>
                      <label className="cursor-pointer flex items-center justify-center gap-3 border border-base-300 rounded-full min-h-11 bg-base-100/50 hover:bg-base-200/50 transition-colors w-full px-4">
                        <span className="label-text font-medium text-sm text-base-content/80">
                          National retailer
                        </span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary toggle-sm"
                          checked={!!field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={!tenantId}
                        />
                      </label>
                    </div>
                  )}
                />

                <FormAutocomplete<RequestFormValues>
                  name="entitiesLocationId"
                  control={control}
                  label="City"
                  placeholder="Select city..."
                  options={locationsHook.items.map((l) => ({
                    value: l.id,
                    label: l.name,
                  }))}
                  loading={locationsHook.isLoading}
                  onSearch={locationsHook.setSearchTerm}
                  disabled={!tenantId || !selectedStateId}
                  rules={{ required: "City is required" }}
                />
              </div>

              {!isStateSelected && (
                <p className="text-sm text-warning">
                  {hideDistributorFields
                    ? "Select a state first to enable retailer."
                    : "Select a state first to enable distributor."}
                </p>
              )}

              {isStateSelected &&
                !isNationalRetailer &&
                !isEntitiesLocationSelected && (
                  <p className="text-sm text-warning">
                    Select a city first to enable retailer.
                  </p>
                )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {!isEventActivation && !hideDistributorFields && (
                  <div className="space-y-4 rounded-xl bg-base-200/60 p-4">
                    <p className="font-medium">Distributor</p>

                    <FormAutocomplete
                      name="distributorId"
                      control={control}
                      label="Select distributor"
                      placeholder="Search distributor..."
                      options={distributorsHook.items.map((d) => ({
                        value: d.id,
                        label: d.name,
                      }))}
                      onSearch={distributorsHook.setSearchTerm}
                      disabled={!isStateSelected}
                    />

                    {!distributorId && (
                      <div className="space-y-3">
                        <p className="text-base-content/60">or</p>
                        {!showDistributorLocation ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => {
                              setShowDistributorLocation(true);

                              if (selectedEntitiesLocationId) {
                                setValue(
                                  "distributorLocationId",
                                  selectedEntitiesLocationId,
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  },
                                );
                              }
                            }}
                            disabled={!isStateSelected}
                          >
                            Create new distributor
                          </button>
                        ) : (
                          <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormInputText
                                name="distributorName"
                                control={control}
                                label="Distributor name"
                                placeholder="Enter distributor name"
                              />
                              <FormInputText
                                name="distributorEmail"
                                control={control}
                                label="Distributor email"
                                placeholder="Enter distributor email"
                              />
                            </div>

                            <FormAutocomplete
                              name="distributorLocationId"
                              control={control}
                              label="Distributor location"
                              placeholder="Select location"
                              options={locationsHook.items.map((l) => ({
                                value: l.id,
                                label: l.name,
                              }))}
                              loading={locationsHook.isLoading}
                              onSearch={locationsHook.setSearchTerm}
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={handleCreateDistributor}
                                disabled={
                                  isCreatingDistributor || !isStateSelected
                                }
                              >
                                Confirm distributor
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  setShowDistributorLocation(false);
                                  setValue("distributorLocationId", null);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4 rounded-xl bg-base-200/60 p-4">
                  <p className="font-medium">Retailer</p>

                  <FormAutocomplete
                    name="retailerId"
                    control={control}
                    label="Select retailer"
                    placeholder="Search retailer..."
                    options={retailersHook.items.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                    onSearch={retailersHook.setSearchTerm}
                    disabled={
                      !isNationalRetailer &&
                      (!isStateSelected || !isEntitiesLocationSelected)
                    }
                  />

                  {!retailerId && (
                    <div className="space-y-3">
                      <p className="text-base-content/60">or</p>
                      {!showRetailerLocation ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => {
                            setShowRetailerLocation(true);

                            if (selectedEntitiesLocationId) {
                              setValue(
                                "retailerLocationId",
                                selectedEntitiesLocationId,
                                {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                },
                              );
                            }
                          }}
                          disabled={!isEntitiesLocationSelected}
                        >
                          Create new retailer
                        </button>
                      ) : (
                        <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInputText
                              name="retailerName"
                              control={control}
                              label="Retailer name"
                              placeholder="Enter retailer name"
                            />
                            <FormInputText
                              name="retailerAddress"
                              control={control}
                              label="Retailer address"
                              placeholder="Enter retailer address"
                            />
                            <FormInputText
                              name="retailerStoreContact"
                              control={control}
                              label="Store contact"
                              placeholder="Enter store contact"
                            />
                          </div>

                          <FormAutocomplete
                            name="retailerLocationId"
                            control={control}
                            label="Retailer location"
                            placeholder="Select location"
                            options={locationsHook.items.map((l) => ({
                              value: l.id,
                              label: l.name,
                            }))}
                            loading={locationsHook.isLoading}
                            onSearch={locationsHook.setSearchTerm}
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={handleCreateRetailer}
                              disabled={
                                isCreatingRetailer ||
                                !isEntitiesLocationSelected
                              }
                            >
                              Confirm retailer
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setShowRetailerLocation(false);
                                setValue("retailerLocationId", null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`space-y-4 rounded-xl bg-base-200/60 p-4 ${
                    isEventActivation ? "" : "md:col-span-2"
                  }`}
                >
                  <p className="font-medium">Store manager</p>

                  <FormAutocomplete
                    name="storeManagerId"
                    control={control}
                    label="Select store manager"
                    placeholder="Search store manager..."
                    options={storeManagerOptions}
                  />

                  {!storeManagerId && (
                    <div className="space-y-3">
                      <p className="text-base-content/60">or</p>
                      {!showStoreManagerCreate ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setShowStoreManagerCreate(true)}
                        >
                          Create new store manager
                        </button>
                      ) : (
                        <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInputText
                              name="storeManagerName"
                              control={control}
                              label="Store manager name"
                              placeholder="Enter name"
                              rules={{
                                required: "Store manager name is required",
                              }}
                            />
                            <FormInputText
                              name="storeManagerPhone"
                              control={control}
                              label="Store manager phone"
                              placeholder="Enter phone"
                              rules={{
                                required: "Store manager phone is required",
                              }}
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={handleCreateStoreManager}
                              disabled={isCreatingStoreManager}
                            >
                              Confirm store manager
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setShowStoreManagerCreate(false);
                                setValue("storeManagerName", "");
                                setValue("storeManagerPhone", "");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* DETAILS  */}
          {!hideTableNeededFields && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Details</p>
              <div className="grid grid-cols-1 gap-4">
                <FormCheckbox<RequestFormValues>
                  name="isTableNeeded"
                  control={control}
                  label="Table Needed?"
                />
                {isTableNeeded && (
                  <FormInputText<RequestFormValues>
                    name="tableSize"
                    control={control}
                    label="Table Size"
                    placeholder="Enter table size"
                    type="number"
                    rules={{ required: "Table Size is required" }}
                  />
                )}
              </div>
            </section>
          )}

          {/* NOTES */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Notes</p>
              <span
                className={`text-xs ${
                  notesValue.length > 480
                    ? "text-error"
                    : "text-base-content/60"
                }`}
              >
                {notesValue.length}/500
              </span>
            </div>

            <FormTextarea<RequestFormValues>
              name="notes"
              control={control}
              label="Additional Notes"
              placeholder="Enter any additional details or instructions..."
              rules={{
                maxLength: {
                  value: 500,
                  message: "Notes cannot exceed 500 characters",
                },
              }}
            />
          </section>

          {/* PRODUCTS */}
          {products.length > 0 && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-lg">Products</p>

                <div className="w-56">
                  <select
                    className="select select-bordered select-sm w-full"
                    value={resolvedSelectedProductType}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      if (onProductTypeChange) {
                        onProductTypeChange(nextValue);
                        return;
                      }
                      setLocalSelectedProductType(nextValue);
                    }}
                  >
                    <option value="">All Types</option>
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {resolvedSelectedProductType && visibleProducts.length > 0 && (
                <p className="text-xs text-base-content/60">
                  Showing products of selected type
                </p>
              )}

              {productsLoading && (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {!productsLoading && visibleProducts.length === 0 && (
                  <p className="text-base-content/60 col-span-full">
                    No products found.
                  </p>
                )}

                {visibleProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`card bg-base-100 shadow-sm border cursor-pointer transition-all ${
                      selectedProducts.includes(product.id)
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-base-300 hover:border-primary/50"
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <div className="card-body p-4 items-center text-center">
                      <div className="w-16 h-16 mb-2 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-base-content/50">
                            No img
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-sm font-medium truncate w-full"
                        title={product.name}
                      >
                        {product.name}
                      </h4>

                      {product.productType?.name && (
                        <span className="text-xs text-base-content/60 mt-1">
                          {product.productType.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-base-content/60 text-center">
                Showing {visibleProducts.length} of {filteredProducts.length}{" "}
                products
              </p>

              {visibleCount < filteredProducts.length && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + PAGE_SIZE, filteredProducts.length),
                      )
                    }
                  >
                    Load more products
                  </button>
                </div>
              )}
            </section>
          )}

          {/* LOCATION MAP */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Location</p>
            </div>

            <Controller
              name="coordinates"
              control={control}
              render={({ field }) => (
                <EditableLocationMap
                  coordinates={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </section>

          {/* FOOTER ACTIONS (optional but matches nice UX) */}
          <div className="pt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Admin-only: opt in to email the client a confirmation.
                Rendered only on create when CreateRequest wires the handler
                (admins only); edit/update path never passes it. */}
            {mode === "create" && onNotifyRequestorChange ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-base-100/30 bg-base-200/60 px-4 py-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm mt-0.5"
                  checked={notifyRequestor}
                  onChange={(e) => onNotifyRequestorChange(e.target.checked)}
                />
                <span className="flex flex-col">
                  <span className="label-text font-medium text-sm text-base-content/90">
                    Email the client a confirmation
                  </span>
                  <span className="text-xs text-base-content/60">
                    Off by default — admin-created requests are silent.
                  </span>
                </span>
              </label>
            ) : (
              <span className="hidden sm:block" />
            )}

            <div className="flex items-center justify-end gap-2">
              <Link
                type="button"
                className="btn btn-sm btn-outline"
                to="/requests/list"
              >
                <XCircleIcon className="w-4 h-4" />
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!isDirty}
              >
                {mode === "edit" ? "Save changes" : "Create request"}
                <SaveIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
