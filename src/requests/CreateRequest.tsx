import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import RequestForm, { type RequestFormValues } from "./components/RequestForm";

import { fetchQuery } from "react-relay";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import { CreateRequestMutation } from "@/api/mutations/RequestMutation";
import { StatesQuery } from "@api/queries/StatesQuery";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";

import { CreateEventMutation } from "@/api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@/api/mutations/__generated__/CreateEventMutation.graphql";

import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";

import { useAlertStore } from "@store/alertStore";
// import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { dateFormat } from "@/public/form/utils/toDate";
import { buildDateTimeWithOffset } from "@utils/index";
import CatalogsProvider from "@/shared/CatalogsProvider";
import environment from "@api/relay/environment";

interface CreateRequestFormProps {
  tenantId: string;
  tenantSlug?: string | null;
  userId?: string;
  userUuid?: string;
}

const CreateRequestForm = ({
  tenantId,
  tenantSlug,
  userId,
  userUuid,
}: CreateRequestFormProps) => {
  // ========================
  // QUERIES
  // ========================
  const rmmClientsData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );

  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const productTypes =
    productTypesData.productTypes?.edges.map((e) => e.node) || [];

  const initialProductTypeId = productTypes[0]?.id ?? null;

  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    {
      filters: { tenantId, productTypeId: initialProductTypeId },
      first: 100,
    },
    { fetchPolicy: "store-and-network" },
  );

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  // ========================
  // MUTATION
  // ========================
  const [commitCreateRequest, isCreating] = useMutation<RequestMutation>(
    CreateRequestMutation,
  );

  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  // ========================
  // DATA MAPPING
  // ========================
  const rmmClients = rmmClientsData.rmmClients?.map((c) => c) || [];

  const states = useMemo(
    () => statesData.states?.edges.map((e) => e.node) ?? [],
    [statesData.states?.edges],
  );
  const isJeeterTenant = tenantSlug?.toLowerCase() === "jeeter";

  const californiaState = useMemo(
    () =>
      states.find(
        (state) =>
          state.name?.toLowerCase() === "california" ||
          state.code?.toLowerCase() === "ca",
      ) ?? null,
    [states],
  );

  const allowedStates = useMemo(() => {
    if (!isJeeterTenant) return states;
    return californiaState ? [californiaState] : [];
  }, [isJeeterTenant, states, californiaState]);

  const requestTypes =
    requestTypesData.requestTypes?.edges.map((e) => e.node) || [];

  const initialProducts = useMemo(
    () => productsData.products?.edges.map((e) => e.node) || [],
    [productsData.products?.edges],
  );

  const [selectedProductTypeId, setSelectedProductTypeId] = useState<
    string | null
  >(initialProductTypeId);
  const [products, setProducts] = useState(initialProducts);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const productsRequestIdRef = useRef(0);
  const hasMountedProductsEffectRef = useRef(false);
  const hasInitializedProductTypeRef = useRef(false);

  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (hasInitializedProductTypeRef.current) return;
    if (!initialProductTypeId) return;

    setSelectedProductTypeId(initialProductTypeId);
    hasInitializedProductTypeRef.current = true;
  }, [initialProductTypeId]);

  useEffect(() => {
    if (!hasMountedProductsEffectRef.current) {
      hasMountedProductsEffectRef.current = true;
      return;
    }

    const requestId = ++productsRequestIdRef.current;
    setIsProductsLoading(true);

    fetchQuery<ProductsQueryType>(
      environment,
      ProductsQuery,
      {
        filters: { tenantId, productTypeId: selectedProductTypeId },
        first: 100,
      },
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .then((data) => {
        if (!data) return;
        if (requestId !== productsRequestIdRef.current) return;
        const nextProducts = data.products?.edges.map((e) => e.node) || [];
        setProducts(nextProducts);
      })
      .catch(() => {
        if (requestId !== productsRequestIdRef.current) return;
        setProducts([]);
      })
      .finally(() => {
        if (requestId !== productsRequestIdRef.current) return;
        setIsProductsLoading(false);
      });
  }, [selectedProductTypeId, tenantId]);

  // ========================
  // SUBMIT
  // handler create event
  // ========================
  const runCreateEvent = (requestId: string, formData: RequestFormValues) => {
    const timezone =
      timezones.find((tz) => tz.id === formData.timezoneId) ?? null;

    const offsetMinutes = timezone?.offset ?? null;
    const dateValue = dateFormat(formData.date);

    const normalizedDate = buildDateTimeWithOffset(
      dateValue,
      "00:00",
      offsetMinutes,
    );

    commitCreateEvent({
      variables: {
        input: {
          name: formData.name,
          date: normalizedDate,
          eventTypeId: formData.eventTypeId ?? "",
          requestId: requestId,
          address: formData.address,
          notes: formData.notes ?? "",
          isNational: false,
          timezoneId: formData.timezoneId ?? null,
          rmmAsignedId: formData.rmmAsignedId,
          distributorId: formData.distributorId ?? null,
          retailerId: formData.retailerId ?? null,
          startTime: formData.startTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.startTime,
                offsetMinutes,
              )
            : "",
          endTime: formData.endTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.endTime,
                offsetMinutes,
              )
            : "",
          coordinates: formData.coordinates ?? undefined,
          tenantId: tenantId,
        },
      },
      onCompleted: ({ createEvent }) => {
        if (createEvent?.success && createEvent.event?.uuid) {
          navigate(`/event/view/${createEvent.event.uuid}`);
        } else {
          showAlert(createEvent?.message ?? "Error creating event", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const handleSubmit = (formData: RequestFormValues) => {
    const timezone =
      timezones.find((tz) => tz.id === formData.timezoneId) ?? null;
    const offsetMinutes = timezone?.offset ?? null;
    const rawDateValue = (formData.date ?? "").toString().trim();
    const dateValue = dateFormat(rawDateValue);
    const dateForNameSource = dateValue || rawDateValue;
    const dateForName = /^\d{4}-\d{2}-\d{2}$/.test(dateForNameSource)
      ? `${dateForNameSource.slice(5, 7)}/${dateForNameSource.slice(8, 10)}/${dateForNameSource.slice(0, 4)}`
      : dateForNameSource;
    const requestName = [
      (formData.name ?? "").trim(),
      (formData.retailerName ?? "").trim(),
      dateForName,
    ]
      .filter(Boolean)
      .join("-");

    commitCreateRequest({
      variables: {
        input: {
          tenantId: tenantId,
          name: requestName || formData.name,
          date: buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes),
          startTime: formData.startTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.startTime,
                offsetMinutes,
              )
            : "",
          endTime: formData.endTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.endTime,
                offsetMinutes,
              )
            : "",
          address: formData.address,
          notes: formData.notes?.trim() ?? "",
          coordinates: (formData.coordinates ?? []) as readonly number[],
          timezoneId: formData.timezoneId!,
          requestTypeId: formData.requestTypeId!,
          distributorId: isJeeterTenant ? null : (formData.distributorId ?? null),
          retailerId: formData.retailerId ?? null,
          locationId: formData.entitiesLocationId,
          stateId: formData.stateId,
          storeManagerId: formData.storeManagerId ?? null,
          rmmAsignedId: formData.rmmAsignedId,
          // Create-only fields
          clientName: formData.clientName!,
          clientEmail: formData.clientEmail!,
          distributorName: isJeeterTenant ? "" : formData.distributorName!,
          distributorEmail: isJeeterTenant ? "" : formData.distributorEmail!,
          retailerName: formData.retailerName!,
          retailerAddress: formData.retailerAddress!,
          retailerStoreContact: formData.retailerStoreContact!,
          storeManagerName: formData.storeManagerName!,
          storeManagerPhone: formData.storeManagerPhone!,

          // Details
          details: [
            {
              isTableNeeded: isJeeterTenant
                ? false
                : formData.isTableNeeded || false,
              tableSize: isJeeterTenant
                ? null
                : formData.tableSize
                  ? parseInt(formData.tableSize)
                  : null,
            },
          ],

          // Products
          products: (formData.products || []).map((id) => ({
            productId: id,
          })),
        },
      },
      onCompleted: (response) => {
        const request = response.createRequest?.request;

        if (response.createRequest?.success && request?.uuid) {
          showAlert(response.createRequest.message, "success");

          // Crear el evento inmediatamente
          runCreateEvent(request.id, formData);
        } else {
          showAlert(
            response.createRequest?.message ?? "Error creating request",
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating request: ${error.message}`, "error");
      },
    });
  };

  if (isCreating) {
    return <Loading />;
  }

  const filters = { tenantId: tenantId };

  return (
    <CatalogsProvider
      eventTypes
      eventTypesFilters={filters}
      // retailers
      // retailersFilters={filters}
      // distributors
      // distributorsFilters={filters}
      requestStoreManagers
      requestStoreManagersFilters={filters}
    >
      {({ requestStoreManagers, eventTypes }) => (
        <RequestForm
          mode="create"
          onSubmit={handleSubmit}
          eventTypes={eventTypes}
          requestTypes={requestTypes}
          timezones={timezones}
          productTypes={productTypes}
          products={products}
          productsLoading={isProductsLoading}
          selectedProductType={selectedProductTypeId ?? ""}
          onProductTypeChange={(productTypeId) =>
            setSelectedProductTypeId(productTypeId || null)
          }
          tenantId={tenantId}
          rmmClients={rmmClients}
          userIdLoggin={userId ? userId : ""}
          userUuidLoggin={userUuid ? userUuid : ""}
          // retailers={retailers}
          states={allowedStates}
          defaultValues={
            isJeeterTenant && californiaState
              ? { stateId: californiaState.id }
              : undefined
          }
          disableStateSelect={isJeeterTenant}
          hideTableNeededFields={isJeeterTenant}
          hideDistributorFields={isJeeterTenant}
          // distributors={distributors}
          requestStoreManagers={requestStoreManagers}
          enableContactSection={true}
          contactMode="manual"
        />
      )}
    </CatalogsProvider>
  );
};

// ========================
// PAGE CONTENT
// ========================
const CreateRequestContent = () => {
  const { tenantId, tenantSlug, user } = useAuthStore();

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center py-20 text-base-content/60">
        No tenant selected. Please select a company first.
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<Loading />}>
        <CreateRequestForm
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          userId={user?.id}
          userUuid={user?.uuid}
        />
      </Suspense>
    </>
  );
};

// ========================
// PAGE
// ========================
const CreateRequest = () => {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <CreateRequestContent />
      </Suspense>
    </Layout>
  );
};

export default CreateRequest;
