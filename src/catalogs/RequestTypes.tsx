import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@shared/LoadingButton";
import { RequestTypesQuery } from "@api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { RequestTypeByIdQuery } from "@api/queries/RequestTypeByIdQuery";
import type { RequestTypeByIdQuery as RequestTypeByIdQueryType } from "@api/queries/__generated__/RequestTypeByIdQuery.graphql";
import { CreateRequestTypeMutation } from "@api/mutations/CreateRequestTypeMutation";
import type { CreateRequestTypeMutation as CreateRequestTypeMutationType } from "@api/mutations/__generated__/CreateRequestTypeMutation.graphql";
import { UpdateRequestTypeMutation } from "@api/mutations/UpdateRequestTypeMutation";
import type { UpdateRequestTypeMutation as UpdateRequestTypeMutationType } from "@api/mutations/__generated__/UpdateRequestTypeMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/solid";

type RequestTypeFormValues = {
  name: string;
  tenantId: string;
};

type RequestTypeFormProps = {
  defaultValues: RequestTypeFormValues;
  onSubmit: (values: RequestTypeFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
};

const RequestTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: RequestTypeFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RequestTypeFormValues>({
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

const RequestTypesTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const requestTypes = useMemo(
    () => data.requestTypes.edges.map((edge) => edge.node),
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requestTypes.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center text-sm text-base-content/70"
                  >
                    No request types for this tenant.
                  </td>
                </tr>
              )}
              {requestTypes.map((type) => (
                <tr key={type.id}>
                  <td>{type.name}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate(`/catalogs/request-types/edit/${type.uuid}`)
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

export const RequestTypesList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <ClipboardDocumentListIcon className="w-8 h-8" />
              <h1>Request Types</h1>
            </span>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/request-types/create")}
            >
              New Request Type
            </button>
          </div>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <RequestTypesTable tenantId={tenantId} />
      )}
    </Layout>
  );
};

export const CreateRequestType = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateRequestTypeMutationType>(
    CreateRequestTypeMutation
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: RequestTypeFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createRequestType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/request-types/list");
        } else {
          showAlert(payload?.message ?? "Error creating request type", "error");
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
        <h1 className="text-2xl font-bold">Create Request Type</h1>
        <p className="text-sm text-base-content/70">
          Assign the request type to a tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <RequestTypeForm
            defaultValues={{ name: "", tenantId: initialTenantId }}
            onSubmit={handleSubmit}
            submitLabel="Create"
            isSubmitting={isCreating}
          />
        </div>
      </div>
    </Layout>
  );
};

export const EditRequestType = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<RequestTypeByIdQueryType>(
    RequestTypeByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const requestType = data.requestType;
  const [commitUpdate, isUpdating] = useMutation<UpdateRequestTypeMutationType>(
    UpdateRequestTypeMutation
  );

  const handleSubmit = (values: RequestTypeFormValues) => {
    if (!requestType?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: requestType.id,
          name: values.name,
          tenantId: values.tenantId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateRequestType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/request-types/list");
        } else {
          showAlert(payload?.message ?? "Error updating request type", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!requestType) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Request type not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Request Type</h1>
        <p className="text-sm text-base-content/70">
          Update the name or tenant for this request type.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <RequestTypeForm
            defaultValues={{
              name: requestType.name,
              tenantId: requestType.tenantId,
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
