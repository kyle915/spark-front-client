import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
import {
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/solid";
import FormInputText from "@/shared/FormInputText";
import { PlusCircle } from "lucide-react";

type RequestTypeFormValues = {
  name: string;
  tenantId: string;
};

type RequestTypeFormProps = {
  defaultValues: RequestTypeFormValues;
  onSubmit: (values: RequestTypeFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
};

const RequestTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
}: RequestTypeFormProps) => {
  const { control, handleSubmit, reset } = useForm<RequestTypeFormValues>({
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
                to="/catalogs/request-types/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <ClipboardDocumentListIcon className="w-6 h-6" />
                  <h1>
                    {isEdit ? "Edit Request Type" : "Create Request Type"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update the name of this request type."
                  : "Define a new request type for this tenant."}
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
                label="Request Type Name"
                placeholder="e.g., Maintenance request"
                rules={{
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                }}
              />
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

const RequestTypesTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const requestTypes = useMemo(
    () => data.requestTypes.edges.map((edge) => edge.node),
    [data],
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
                      className="btn btn-primary btn-sm"
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
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ClipboardDocumentListIcon className="w-8 h-8" />
              </div>
              <h1>Request Types</h1>
            </div>
            <p className="text-base-content/70">
              Manage and organize your request types.
            </p>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/request-types/create")}
            >
              <PlusCircle className="w-4 h-4" />
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
    CreateRequestTypeMutation,
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
      <RequestTypeForm
        defaultValues={{ name: "", tenantId: initialTenantId }}
        onSubmit={handleSubmit}
        submitLabel="Create"
        isSubmitting={isCreating}
      />
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
    { fetchPolicy: "store-and-network" },
  );

  const requestType = data.requestType;
  const [commitUpdate, isUpdating] = useMutation<UpdateRequestTypeMutationType>(
    UpdateRequestTypeMutation,
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
      <RequestTypeForm
        defaultValues={{
          name: requestType.name,
          tenantId: requestType.tenantId,
        }}
        onSubmit={handleSubmit}
        submitLabel="Update"
        isSubmitting={isUpdating}
        mode="edit"
      />
    </Layout>
  );
};
