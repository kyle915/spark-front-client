import Layout from "@/layout/Layout";
import { useMutation } from "react-relay/hooks";
import { CreateTenantMutation } from "@/api/mutations/CreateTenantMutation";
import type { CreateTenantMutation as CreateTenantMutationType } from "@/api/mutations/__generated__/CreateTenantMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import { TenantsListContent } from "./TenantsList";
import { useState } from "react";

type TenantFormValues = {
  name: string;
};

const CreateTenant = () => {
  const navigate = useNavigate();
  const [commitCreateTenant, isInFlight] =
    useMutation<CreateTenantMutationType>(CreateTenantMutation);
  const { showAlert } = useAlertStore();
  const { control, handleSubmit, reset } = useForm<TenantFormValues>({
    defaultValues: {
      name: "",
    },
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const onSubmit = (formData: TenantFormValues) => {
    commitCreateTenant({
      variables: {
        input: {
          name: formData.name,
        },
      },
      onCompleted: (response) => {
        const createTenantResponse = response.createTenant;

        if (createTenantResponse?.success) {
          showAlert(createTenantResponse.message, "success");
          reset(); // Reset form after successful creation
          setRefreshKey((prev) => prev + 1); // Force refresh of the list
        } else {
          showAlert(
            createTenantResponse?.message ?? "Error creating tenant",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating tenant: ${error.message}`, "error");
      },
    });
  };

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Create Tenant</h1>
      </div>

      <div className="card bg-base-200 shadow-xl mb-6">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInputText
              control={control}
              name="name"
              label="Tenant Name"
              placeholder="e.g. Acme Corporation"
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
                    Creating...
                  </>
                ) : (
                  "Create Tenant"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold">Existing Tenants</h2>
      </div>
      <TenantsListContent refreshTrigger={refreshKey} />
    </Layout>
  );
};

export default CreateTenant;
