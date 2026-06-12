import { useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useMutation } from "react-relay/hooks";
import { useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { CreateProductMutation } from "@api/mutations/CreateProductMutation";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { CreateProductMutation as CreateProductMutationType } from "@api/mutations/__generated__/CreateProductMutation.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@store/alertStore";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import FormInputText from "@shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import ImageUpload from "@shared/ImageUpload";
import Loading from "@shared/Loading";
import environment from "@api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeftIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { PencilIcon, SaveIcon } from "lucide-react";

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
      label="Product Type (optional)"
      placeholder="Leave blank to use the default"
      options={productTypeOptions}
    />
  );
};

const ProductForm = () => {
  const { tenantId } = useAuthStore();
  const [commitCreateProduct, isInFlight] =
    useMutation<CreateProductMutationType>(CreateProductMutation);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageResetKey, setImageResetKey] = useState(0);

  const { control, handleSubmit, reset } = useForm<ProductFormValues>({
    defaultValues: {
      name: "",
      tenantId: tenantId || "",
      productTypeId: "",
    },
  });

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
          tenantId: tenantId || "",
          // Optional — blank falls back to the tenant's default product type
          // (resolved server-side), so a product can be added with just a name.
          productTypeId: formData.productTypeId || null,
          image: uploadedBlobName,
        },
      },
      onCompleted: (response) => {
        const createProductResponse = response.createProduct;

        if (createProductResponse?.success) {
          showAlert(createProductResponse.message, "success");
          reset({
            name: "",
            tenantId: formData.tenantId,
            productTypeId: "",
          });
          setSelectedImageFile(null);
          setImageResetKey((prev) => prev + 1);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
          <div className="p-8 md:p-10 space-y-8">
            <div className="flex flex-col gap-5  border-b border-base-100/20">
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/products/products-list"
                  className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back to list
                </Link>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                    <PencilIcon className="w-6 h-6" />
                    <h1>Create Product</h1>
                  </span>
                </div>
                <p className="text-base-content/70 text-sm mt-2">
                  Fill in the details below to create a new product.
                </p>
              </div>
            </div>

            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Basic Information</p>
                <span className="text-xs text-base-content/60">
                  Required fields
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInputText
                  control={control}
                  name="name"
                  placeholder=""
                  label="Product Name"
                  rules={{
                    required: "Product name is required",
                    minLength: {
                      value: 2,
                      message: "Product name must be at least 2 characters",
                    },
                  }}
                />

                {tenantId ? (
                  <Suspense fallback={<Loading />}>
                    <ProductTypeSelect
                      key={tenantId}
                      tenantId={tenantId}
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
              </div>
            </section>

            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Product Image</p>
                <span className="text-xs text-base-content/60">Optional</span>
              </div>

              <div className="grid grid-cols-1">
                <ImageUpload
                  showHelperText={false}
                  key={imageResetKey}
                  onImageSelected={setSelectedImageFile}
                  onError={handleImageError}
                />
              </div>
            </section>

            <div className="pt-2 flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/product/products-list"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </Link>
              </div>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={isInFlight && loading}
              >
                {loading ? (
                  <span className="loading loading-spinner">Saving...</span>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    Create Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">
          Products for selected tenant
        </h2>
        {!tenantId ? (
          <div className="alert alert-warning">
            <span>Select a tenant to view its products.</span>
          </div>
        ) : (
          // <Suspense fallback={<Loading />}>
          <TenantProductsGrid
            tenantId={tenantId}
            refreshKey={productsRefreshKey}
            productTypeIdFilter={selectedProductTypeId}
            hideTypeFilter
          />
          // </Suspense>
        )}
      </div> */}
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
