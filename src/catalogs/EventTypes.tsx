import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
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
import { CalendarDaysIcon } from "@heroicons/react/24/solid";

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
};

const EventTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: EventTypeFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventTypeFormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-control gap-2 p-2">
        <div className="flex items-center gap-4">
          <label className="label p-0">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            {...register("name", { required: "Name is required" })}
          />
        </div>
        {errors.name && (
          <span className="text-error text-sm">{errors.name.message}</span>
        )}
      </div>

      <div className="form-control gap-2 p-2">
        <div className="flex items-center gap-4">
          <label className="label p-0">
            <span className="label-text">Is default</span>
          </label>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            {...register("isDefault")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <LoadingButton
          type="submit"
          loading={isSubmitting}
          text={submitLabel}
        />
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
                      className="btn btn-ghost btn-sm"
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
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <CalendarDaysIcon className="w-8 h-8" />
              <h1>Event Types</h1>
            </span>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Event Type</h1>
        <p className="text-sm text-base-content/70">
          Assign the event type to a tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <EventTypeForm
            defaultValues={{
              name: "",
              tenantId: initialTenantId,
              isDefault: false,
            }}
            onSubmit={handleSubmit}
            submitLabel="Create"
            isSubmitting={isCreating}
          />
        </div>
      </div>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Event Type</h1>
        <p className="text-sm text-base-content/70">
          Update the name, default flag or tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <EventTypeForm
            defaultValues={{
              name: eventType.name,
              isDefault: eventType.isDefault ?? false,
              tenantId: eventType.tenantId,
            }}
            onSubmit={handleSubmit}
            submitLabel="Update"
            isSubmitting={isUpdating}
          />
        </div>
      </div>
    </Layout>
  );
};
