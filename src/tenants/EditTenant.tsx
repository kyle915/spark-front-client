import { Suspense } from "react";
import Layout from "@/layout/Layout";
import { useParams, useNavigate } from "react-router";
import Loading from "@/shared/Loading";
import { useMutation } from "react-relay/hooks";
import { UpdateTenantMutation } from "@/api/mutations/UpdateTenantMutation";
import type { UpdateTenantMutation as UpdateTenantMutationType } from "@/api/mutations/__generated__/UpdateTenantMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@/api/queries/__generated__/TenantsQuery.graphql";

type TenantFormValues = {
  name: string;
};

type EditTenantContentProps = {
  uuid: string;
};

const EditTenantContent = ({ uuid }: EditTenantContentProps) => {
  const data = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {
      first: 1000, // Get all tenants to find the one we need
    },
    { fetchPolicy: "store-or-network" }
  );

  const tenant = data.tenants?.edges?.find(
    (edge) => edge?.node?.uuid === uuid
  )?.node;

  const [commitUpdateTenant, isInFlight] =
    useMutation<UpdateTenantMutationType>(UpdateTenantMutation);
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const { control, handleSubmit } = useForm<TenantFormValues>({
    defaultValues: {
      name: tenant?.name ?? "",
    },
  });

  if (!tenant) {
    return (
      <div className="alert alert-warning">
        <span>The specified tenant was not found.</span>
      </div>
    );
  }

  const onSubmit = (formData: TenantFormValues) => {
    commitUpdateTenant({
      variables: {
        input: {
          id: tenant.id,
          name: formData.name,
        },
      },
      updater: (store, data) => {
        // Update the tenant record in the store
        if (!data?.updateTenant?.tenant) {
          return;
        }

        const updatedTenant = data.updateTenant.tenant;
        const tenantRecord = store.get(tenant.id);
        if (tenantRecord) {
          tenantRecord.setValue(updatedTenant.name, "name");
          if (updatedTenant.requestUrlName !== undefined) {
            tenantRecord.setValue(
              updatedTenant.requestUrlName,
              "requestUrlName"
            );
          }
        }
      },
      onCompleted: (response) => {
        const updateTenantResponse = response.updateTenant;

        if (updateTenantResponse?.success) {
          // Set a flag to trigger refresh when navigating back
          sessionStorage.setItem("tenants_refresh", Date.now().toString());
          showAlert(updateTenantResponse.message, "success");
          navigate("/tenants/list");
        } else {
          showAlert(
            updateTenantResponse?.message ?? "Error updating tenant",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error updating tenant: ${error.message}`, "error");
      },
    });
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Edit Tenant</h1>
        <p className="text-base-content/70">Tenant: {tenant.name}</p>
      </div>

      <div className="card bg-base-200 shadow-xl mb-6">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInputText
              control={control}
              name="name"
              placeholder="e.g. Acme Corporation"
              label="Tenant Name"
              rules={{
                required: "Tenant name is required",
                minLength: {
                  value: 3,
                  message: "Tenant name must be at least 3 characters",
                },
              }}
            />

            <div className="card-actions justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate("/tenants/list")}
                disabled={isInFlight}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isInFlight}
              >
                {isInFlight ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Updating...
                  </>
                ) : (
                  "Update Tenant"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

const EditTenant = () => {
  const { uuid } = useParams<{ uuid: string }>();

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>The tenant identifier is not defined.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <EditTenantContent uuid={uuid} />
      </Suspense>
    </Layout>
  );
};

export default EditTenant;
