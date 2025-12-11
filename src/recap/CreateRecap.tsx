import { useEffect, useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useMutation, useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { CreateRecapMutation } from "@/api/mutations/CreateRecapMutation";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import { FileTypesQuery } from "@/api/queries/FileTypesQuery";
import type { CreateRecapMutation as CreateRecapMutationType } from "@/api/mutations/__generated__/CreateRecapMutation.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { TenantsQuery as TenantsQueryType } from "@/api/queries/__generated__/TenantsQuery.graphql";
import type { FileTypesQuery as FileTypesQueryType } from "@/api/queries/__generated__/FileTypesQuery.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@/store/alertStore";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import FormInputText from "@shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import FileUploadItem from "@/shared/FileUploadItem";
import Loading from "@shared/Loading";
import LoadingButton from "@shared/LoadingButton";
import environment from "@api/relay/environment";

type RecapFormValues = {
  name: string;
  tenantId: string;
  eventId: string;
};

type EventSelectProps = {
  tenantId: string;
  control: Control<RecapFormValues>;
};

const EventSelect = ({ tenantId, control }: EventSelectProps) => {
  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const eventOptions = useMemo(
    () =>
      eventsData.events.edges.map((edge) => ({
        value: edge.node.id,
        label: `${edge.node.name}${
          edge.node.startTime
            ? ` - ${new Date(edge.node.startTime).toLocaleDateString()}`
            : ""
        }`,
      })),
    [eventsData]
  );

  return (
    <FormAutocomplete
      control={control}
      name="eventId"
      label="Event"
      placeholder="Search event..."
      options={eventOptions}
      rules={{
        required: "Event is required",
      }}
    />
  );
};

type FileItem = {
  id: number;
  file: File | null;
  fileTypeId: string;
};

const RecapForm = () => {
  const navigate = useNavigate();
  const [commitCreateRecap, isInFlight] =
    useMutation<CreateRecapMutationType>(CreateRecapMutation);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [fileItems, setFileItems] = useState<FileItem[]>([
    { id: 0, file: null, fileTypeId: "" },
  ]);
  const [nextFileId, setNextFileId] = useState(1);

  const { control, handleSubmit, reset, watch, setValue } =
    useForm<RecapFormValues>({
      defaultValues: {
        name: "",
        tenantId: "",
        eventId: "",
      },
    });

  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const fileTypesData = useLazyLoadQuery<FileTypesQueryType>(
    FileTypesQuery,
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

  const fileTypeOptions = useMemo(
    () =>
      fileTypesData.fileTypes.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.extension
          ? `${edge.node.name} (.${edge.node.extension})`
          : edge.node.name,
      })),
    [fileTypesData]
  );

  const selectedTenantId = watch("tenantId");

  useEffect(() => {
    if (!selectedTenantId && tenantOptions.length > 0) {
      setValue("tenantId", tenantOptions[0].value);
    }
  }, [selectedTenantId, tenantOptions, setValue]);

  useEffect(() => {
    setValue("eventId", "");
  }, [selectedTenantId, setValue]);

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query CreateRecap_GetUploadUrlQuery(
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

  const uploadFile = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recaps/${timestamp}_${file.name}`;

    const uploadData = await fetchQuery<GetUploadUrlQueryType>(
      environment,
      GetUploadUrlQuery,
      {
        filePath: fileName,
        contentType: file.type,
      }
    ).toPromise();

    const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
    const blobName = uploadData?.getUploadUrl?.blobName;

    if (!uploadUrl || !blobName) {
      throw new Error("Unable to get upload URL.");
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${file.name}`);
    }

    return blobName;
  };

  const uploadAllFiles = async (): Promise<string[]> => {
    const filesToUpload = fileItems.filter((item) => item.file !== null);

    if (filesToUpload.length === 0) {
      throw new Error("Please select at least one file to upload.");
    }

    const missingType = filesToUpload.find((item) => !item.fileTypeId);
    if (missingType) {
      throw new Error("Please select a file type for each file.");
    }

    const uploadPromises = filesToUpload.map(async (item) =>
      uploadFile(item.file!)
    );
    return await Promise.all(uploadPromises);
  };

  const onSubmit = async (formData: RecapFormValues) => {
    setLoading(true);
    let uploadedFiles: string[] = [];

    try {
      uploadedFiles = await uploadAllFiles();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error uploading files.";
      showAlert(message, "error");
      setLoading(false);
      return;
    }

    commitCreateRecap({
      variables: {
        input: {
          name: formData.name,
          eventId: formData.eventId,
          files: uploadedFiles,
        },
      },
      onCompleted: (response) => {
        const createRecapResponse = response.createRecap;

        if (createRecapResponse?.success) {
          showAlert(createRecapResponse.message, "success");
          reset({
            name: "",
            tenantId: selectedTenantId,
            eventId: "",
          });
          setFileItems([{ id: nextFileId, file: null, fileTypeId: "" }]);
          setNextFileId(nextFileId + 1);
        } else {
          showAlert(
            createRecapResponse?.message ?? "Error creating recap",
            "error"
          );
        }
        setLoading(false);
      },
      onError: (error) => {
        showAlert(`Error creating recap: ${error.message}`, "error");
        setLoading(false);
      },
    });
  };

  const handleFileSelected = (file: File | null, index: number) => {
    setFileItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, file } : item))
    );
  };

  const handleRemoveFile = (index: number) => {
    if (fileItems.length === 1) {
      // Don't remove the last item, just clear it
      setFileItems([{ id: nextFileId, file: null, fileTypeId: "" }]);
      setNextFileId(nextFileId + 1);
    } else {
      setFileItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddFile = () => {
    setFileItems((prev) => [
      ...prev,
      { id: nextFileId, file: null, fileTypeId: "" },
    ]);
    setNextFileId(nextFileId + 1);
  };

  const handleFileError = (error: string) => {
    showAlert(error, "error");
  };

  const handleFileTypeSelected = (fileTypeId: string, index: number) => {
    setFileItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, fileTypeId } : item))
    );
  };

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Create Recap</h1>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInputText
              control={control}
              name="name"
              label="Recap Name"
              placeholder="e.g., Event Recap June 2024"
              rules={{
                required: "Recap name is required",
                minLength: {
                  value: 2,
                  message: "Recap name must be at least 2 characters",
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
                <EventSelect
                  key={selectedTenantId}
                  tenantId={selectedTenantId}
                  control={control}
                />
              </Suspense>
            ) : (
              <FormAutocomplete
                control={control}
                name="eventId"
                label="Event"
                options={[]}
                placeholder="Select a tenant first"
                disabled
              />
            )}

            <div>
              <label className="label">
                <span className="label-text font-semibold">Files</span>
              </label>
              <div className="space-y-3">
                {fileItems.map((item, index) => (
                  <FileUploadItem
                    key={item.id}
                    index={index}
                    fileTypeOptions={fileTypeOptions}
                    onFileSelected={handleFileSelected}
                    onFileTypeSelected={handleFileTypeSelected}
                    onRemove={handleRemoveFile}
                    onError={handleFileError}
                  />
                ))}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-3"
                onClick={handleAddFile}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Another File
              </button>
            </div>

            <div className="card-actions justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate(-1)}
                disabled={isInFlight || loading}
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={loading}
                text="Create Recap"
                disabled={isInFlight}
              />
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

const CreateRecap = () => {
  return <RecapForm />;
};

export default CreateRecap;
