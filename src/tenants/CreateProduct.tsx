import { useEffect, useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useMutation } from "react-relay/hooks";
import { useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { CreateProductMutation } from "@/api/mutations/CreateProductMutation";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { CreateProductMutation as CreateProductMutationType } from "@/api/mutations/__generated__/CreateProductMutation.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@/api/queries/__generated__/ProductTypesQuery.graphql";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@/store/alertStore";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import ImageUpload from "@/shared/ImageUpload";
import Loading from "@/shared/Loading";
import LoadingButton from "@/shared/LoadingButton";
import environment from "@/api/relay/environment";
import TenantProductsGrid from "@/shared/TenantProductsGrid";

type ProductFormValues = {
  name: string;
  tenantId: string;
  productTypeId: string;
};

type ProductTypeSelectProps = {
  tenantId: string;
  control: Control<ProductFormValues>;
};

const ProductTypeSelect = ({ tenantId, control }: ProductTypeSelectProps) => {
  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypeOptions = useMemo(
    () =>
      productTypesData.productTypes.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [productTypesData]
  );

  return (
    <FormAutocomplete
      control={control}
      name="productTypeId"
      label="Product Type"
      placeholder="Search product type..."
      options={productTypeOptions}
      rules={{
        required: "Product type is required",
      }}
    />
  );
};

const ProductForm = () => {
  const navigate = useNavigate();
  const [commitCreateProduct, isInFlight] =
    useMutation<CreateProductMutationType>(CreateProductMutation);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageResetKey, setImageResetKey] = useState(0);
  const [productsRefreshKey, setProductsRefreshKey] = useState(0);

  const { control, handleSubmit, reset, watch, setValue } =
    useForm<ProductFormValues>({
      defaultValues: {
        name: "",
        tenantId: "",
        productTypeId: "",
      },
    });

  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const tenantOptions = useMemo(
    () =>
      tenantsData.tenants.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [tenantsData]
  );

  const selectedTenantId = watch("tenantId");
  const selectedProductTypeId = watch("productTypeId");

  useEffect(() => {
    if (!selectedTenantId && tenantOptions.length > 0) {
      setValue("tenantId", tenantOptions[0].value);
    }
  }, [selectedTenantId, tenantOptions, setValue]);

  useEffect(() => {
    setValue("productTypeId", "");
  }, [selectedTenantId, setValue]);

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query CreateProduct_GetUploadUrlQuery(
      $filePath: String!
      $contentType: String!
    ) {
      getUploadUrl(filePath: $filePath, contentType: $contentType) {
        uploadUrl
        blobName
      }
    }
  `;

  type GetUploadUrlQueryType = {
    response: {
      getUploadUrl: {
        uploadUrl: string;
        blobName: string;
      } | null;
    };
    variables: {
      filePath: string;
      contentType: string;
    };
  };

  const uploadImageIfNeeded = async (): Promise<string | null> => {
    if (!selectedImageFile) return null;

    const timestamp = Date.now();
    const fileName = `products/${timestamp}_${selectedImageFile.name}`;

    const uploadData = await fetchQuery<GetUploadUrlQueryType>(
      environment,
      GetUploadUrlQuery,
      {
        filePath: fileName,
        contentType: selectedImageFile.type,
      }
    ).toPromise();

    const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
    const blobName = uploadData?.getUploadUrl?.blobName;

    if (!uploadUrl || !blobName) {
      throw new Error("Unable to get upload URL.");
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": selectedImageFile.type },
      body: selectedImageFile,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload image to storage.");
    }

    return blobName;
  };

  const onSubmit = async (formData: ProductFormValues) => {
    setLoading(true);
    let uploadedBlobName: string | null = null;

    try {
      uploadedBlobName = await uploadImageIfNeeded();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error uploading image.";
      showAlert(message, "error");
      return;
    }

    commitCreateProduct({
      variables: {
        input: {
          name: formData.name,
          tenantId: formData.tenantId,
          productTypeId: formData.productTypeId,
          image: uploadedBlobName,
        },
      },
      onCompleted: (response) => {
        const createProductResponse = response.createProduct;

        if (createProductResponse?.success) {
          showAlert(createProductResponse.message, "success");
          reset({
            name: "",
            tenantId: selectedTenantId,
            productTypeId: "",
          });
          setSelectedImageFile(null);
          setImageResetKey((prev) => prev + 1);
          setProductsRefreshKey((prev) => prev + 1);
        } else {
          showAlert(
            createProductResponse?.message ?? "Error creating product",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating product: ${error.message}`, "error");
      },
    });
    setLoading(false);
  };

  const handleImageError = (error: string) => {
    showAlert(error, "error");
  };

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Create Product</h1>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInputText
              control={control}
              name="name"
              label="Product Name"
              placeholder="e.g. Premium Subscription"
              rules={{
                required: "Product name is required",
                minLength: {
                  value: 2,
                  message: "Product name must be at least 2 characters",
                },
              }}
            />

            <FormAutocomplete
              control={control}
              name="tenantId"
              label="Tenant"
              placeholder="Search tenant..."
              options={tenantOptions}
              rules={{
                required: "Tenant is required",
              }}
              disabled={tenantOptions.length === 0}
            />

            {selectedTenantId ? (
              <Suspense fallback={<Loading />}>
                <ProductTypeSelect
                  key={selectedTenantId}
                  tenantId={selectedTenantId}
                  control={control}
                />
              </Suspense>
            ) : (
              <FormAutocomplete
                control={control}
                name="productTypeId"
                label="Product Type"
                options={[]}
                placeholder="Select a tenant first"
                disabled
              />
            )}

            <ImageUpload
              key={imageResetKey}
              onImageSelected={setSelectedImageFile}
              onError={handleImageError}
            />

            <div className="card-actions justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate(-1)}
                disabled={isInFlight}
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={loading}
                text="Create Product"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">
          Products for selected tenant
        </h2>
        {!selectedTenantId ? (
          <div className="alert alert-warning">
            <span>Select a tenant to view its products.</span>
          </div>
        ) : (
          // <Suspense fallback={<Loading />}>
          <TenantProductsGrid
            tenantId={selectedTenantId}
            refreshKey={productsRefreshKey}
            productTypeIdFilter={selectedProductTypeId}
            hideTypeFilter
          />
          // </Suspense>
        )}
      </div>
    </Layout>
  );
};

const CreateProduct = () => {
  return (
    // <Suspense fallback={<Layout><Loading /></Layout>}>
    <ProductForm />
    // </Suspense>
  );
};

export default CreateProduct;
