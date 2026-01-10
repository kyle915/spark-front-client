import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@shared/LoadingButton";
import { EventTypeQuery } from "@api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";
import { EventTypeByIdQuery } from "@api/queries/EventTypeByIdQuery";
import type { EventTypeByIdQuery as EventTypeByIdQueryType } from "@api/queries/__generated__/EventTypeByIdQuery.graphql";
import { CreateEventTypeMutation } from "@api/mutations/CreateEventTypeMutation";
import type { CreateEventTypeMutation as CreateEventTypeMutationType } from "@api/mutations/__generated__/CreateEventTypeMutation.graphql";
import { UpdateEventTypeMutation } from "@api/mutations/UpdateEventTypeMutation";
import type { UpdateEventTypeMutation as UpdateEventTypeMutationType } from "@api/mutations/__generated__/UpdateEventTypeMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeftIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import FormCheckbox from "@/shared/FormCheckbox";
import FormInputText from "@/shared/FormInputText";

type EventTypeFormValues = {
  name: string;
  tenantId: string;
  isDefault: boolean;
};

type EventTypeFormProps = {
  defaultValues: EventTypeFormValues;
  onSubmit: (values: EventTypeFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
};

const EventTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
}: EventTypeFormProps) => {
  const { control, handleSubmit, reset } = useForm<EventTypeFormValues>({
    defaultValues,
  });

  const isEdit = mode === "edit";

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER */}
          <div className="flex flex-col gap-4 border-b border-base-100/20">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/catalogs/event-types/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <CalendarDaysIcon className="w-6 h-6" />
                  <h1>{isEdit ? "Edit Event Type" : "Create Event Type"}</h1>
                </span>
              </div>

              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update the information and behavior of this event type."
                  : "Define and configure the event type behavior."}
              </p>
            </div>
          </div>

          {/* SECTION: BASIC INFORMATION */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInputText
                control={control}
                name="name"
                label="Event Type Name"
                placeholder="e.g., Conference"
                rules={{
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                }}
              />
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between rounded-xl bg-base-200/60 border border-base-100/20 p-4">
              <div>
                <p className="font-medium">Default event type</p>
                <p className="text-xs text-base-content/60">
                  This event type will be selected by default
                </p>
              </div>

              <FormCheckbox label="" control={control} name="isDefault" />
            </div>
          </section>

          {/* FOOTER ACTIONS */}
          <div className="pt-2 flex items-center justify-end">
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              text={submitLabel}
            />
          </div>
        </div>
      </div>
    </form>
  );
};

const EventTypesTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<EventTypeQueryType>(
    EventTypeQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const eventTypes = useMemo(
    () => data.eventTypes.edges.map((edge) => edge.node),
    [data]
  );

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-sm text-base-content/70"
                  >
                    No event types for this tenant.
                  </td>
                </tr>
              )}
              {eventTypes.map((type) => (
                <tr key={type.id}>
                  <td>{type.name}</td>
                  <td>{type.isDefault ? "Yes" : "No"}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        navigate(`/catalogs/event-types/edit/${type.uuid}`)
                      }
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const EventTypesList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <CalendarDaysIcon className="w-8 h-8" />
              </div>
              <h1>Event Types</h1>
            </div>
            <p className="text-base-content/70">
              Manage and organize your event types.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/catalogs/event-types/create")}
          >
            New Event Type
          </button>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <EventTypesTable tenantId={tenantId} />
      )}
    </Layout>
  );
};

export const CreateEventType = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateEventTypeMutationType>(
    CreateEventTypeMutation
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: EventTypeFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createEventType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/event-types/list");
        } else {
          showAlert(payload?.message ?? "Error creating event type", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  return (
    <Layout>
      <EventTypeForm
        defaultValues={{
          name: "",
          tenantId: initialTenantId,
          isDefault: false,
        }}
        onSubmit={handleSubmit}
        submitLabel="Create"
        isSubmitting={isCreating}
        mode="create"
      />
    </Layout>
  );
};

export const EditEventType = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<EventTypeByIdQueryType>(
    EventTypeByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const eventType = data.eventType;
  const [commitUpdate, isUpdating] = useMutation<UpdateEventTypeMutationType>(
    UpdateEventTypeMutation
  );

  const handleSubmit = (values: EventTypeFormValues) => {
    if (!eventType?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: eventType.id,
          name: values.name,
          isDefault: values.isDefault,
          tenantId: values.tenantId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateEventType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/event-types/list");
        } else {
          showAlert(payload?.message ?? "Error updating event type", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!eventType) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Event type not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <EventTypeForm
        defaultValues={{
          name: eventType.name,
          isDefault: eventType.isDefault ?? false,
          tenantId: eventType.tenantId,
        }}
        onSubmit={handleSubmit}
        submitLabel="Update"
        isSubmitting={isUpdating}
        mode="edit"
      />
    </Layout>
  );
};
