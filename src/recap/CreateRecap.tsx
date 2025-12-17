import { useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useMutation, useLazyLoadQuery } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { CreateRecapMutation } from "@/api/mutations/CreateRecapMutation";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { FileTypesQuery } from "@/api/queries/FileTypesQuery";
import type { CreateRecapMutation as CreateRecapMutationType } from "@/api/mutations/__generated__/CreateRecapMutation.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { FileTypesQuery as FileTypesQueryType } from "@/api/queries/__generated__/FileTypesQuery.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@/store/alertStore";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import FormInputText from "@shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import FileUploadItem from "@/shared/FileUploadItem";
import Loading from "@shared/Loading";
import environment from "@api/relay/environment";
import {
  ArrowLeftIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { SaveIcon } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

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
  const { tenantId } = useAuthStore();
  const [commitCreateRecap, isInFlight] =
    useMutation<CreateRecapMutationType>(CreateRecapMutation);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [fileItems, setFileItems] = useState<FileItem[]>([
    { id: 0, file: null, fileTypeId: "" },
  ]);
  const [nextFileId, setNextFileId] = useState(1);

  const { control, handleSubmit, reset } = useForm<RecapFormValues>({
    defaultValues: {
      name: "",
      tenantId: tenantId || "",
      eventId: "",
    },
  });

  const fileTypesData = useLazyLoadQuery<FileTypesQueryType>(
    FileTypesQuery,
    {},
    { fetchPolicy: "store-and-network" }
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
            tenantId: tenantId || "",
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
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
          <div className="p-8 md:p-10 space-y-8">
            <div className="flex flex-col gap-5 border-b border-base-100/20">
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/events/list"
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
                    <h1>Create Recap</h1>
                  </span>
                </div>
                <p className="text-base-content/70 text-sm mt-2">
                  Fill out the form below to create a new recap.
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

                {tenantId ? (
                  <Suspense fallback={<Loading />}>
                    <EventSelect tenantId={tenantId} control={control} />
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
              </div>
            </section>

            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <label className="label">
                  <span className="label-text font-semibold">Files</span>
                </label>
              </div>

              <div className="grid grid-cols-1">
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

                <button
                  type="button"
                  className="btn btn-outline btn-sm mt-3 mx-auto flex items-center gap-2"
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
            </section>

            <div className="pt-2 flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/recap/list"
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
                <SaveIcon className="w-4 h-4" />
                Create Recap
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};

const CreateRecap = () => {
  return <RecapForm />;
};

export default CreateRecap;
