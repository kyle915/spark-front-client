import { useEffect, useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { RecapQuery } from "@/api/queries/RecapQuery";
import { UpdateRecapMutation } from "@/api/mutations/UpdateRecapMutation";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import type { UpdateRecapMutation as UpdateRecapMutationType } from "@/api/mutations/__generated__/UpdateRecapMutation.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@/store/alertStore";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@/shared/FormAutocomplete";
import Loading from "@/shared/Loading";
import environment from "@/api/relay/environment";

import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeftIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { SaveIcon } from "lucide-react";

type RecapFormValues = {
  name: string;
  eventId: string;
};

type EventSelectProps = {
  tenantId: string; // debe ser válido siempre
  control: Control<RecapFormValues>;
};

const EventSelect = ({ control, tenantId }: EventSelectProps) => {
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

type NewFileItem = {
  id: number;
  file: File | null;
};

const EditRecap = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const [commitUpdate, isInFlight] =
    useMutation<UpdateRecapMutationType>(UpdateRecapMutation);
  const [loading, setLoading] = useState(false);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<NewFileItem[]>([
    { id: 0, file: null },
  ]);
  const [nextFileId, setNextFileId] = useState(1);
  const { tenantId } = useAuthStore();

  const recapData = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const recap = recapData.recap;

  const { control, handleSubmit, setValue } = useForm<RecapFormValues>({
    defaultValues: {
      name: recap?.name ?? "",
      eventId: recap?.event?.id ?? "",
    },
  });

  useEffect(() => {
    if (recap?.recapFiles) {
      setExistingFiles(
        recap.recapFiles.map((f) => f.file ?? "").filter(Boolean)
      );
    }
  }, [recap?.recapFiles]);

  useEffect(() => {
    if (!recap?.event?.id) return;
    setValue("eventId", recap.event.id);
  }, [recap?.event?.id, setValue]);

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query EditRecap_GetUploadUrlQuery(
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

  const uploadNewFiles = async (): Promise<string[]> => {
    const filesToUpload = newFiles
      .filter((item) => item.file !== null)
      .map((item) => item.file!);
    if (filesToUpload.length === 0) return [];
    const uploadPromises = filesToUpload.map((file) => uploadFile(file));
    return await Promise.all(uploadPromises);
  };

  const handleAddNewFile = () => {
    setNewFiles((prev) => [...prev, { id: nextFileId, file: null }]);
    setNextFileId((prev) => prev + 1);
  };

  const handleNewFileChange = (file: File | null, index: number) => {
    setNewFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, file } : item))
    );
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateFile = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) return "File size must be less than 10MB";
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type))
      return "Only images and PDFs are allowed";
    return null;
  };

  const onSubmit = async (formData: RecapFormValues) => {
    if (!recap?.id) return;
    setLoading(true);
    try {
      const uploaded = await uploadNewFiles();
      const filesPayload = [...existingFiles, ...uploaded];

      if (filesPayload.length === 0) {
        throw new Error("Please keep at least one file.");
      }

      commitUpdate({
        variables: {
          input: {
            id: recap.id,
            name: formData.name,
            eventId: formData.eventId,
            files: filesPayload,
          },
        },
        onCompleted: (response) => {
          const res = response.updateRecap;
          if (res?.success) {
            showAlert(res.message, "success");
            navigate(-1);
          } else {
            showAlert(res?.message ?? "Error updating recap", "error");
          }
          setLoading(false);
        },
        onError: (error) => {
          showAlert(`Error updating recap: ${error.message}`, "error");
          setLoading(false);
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error updating recap.";
      showAlert(message, "error");
      setLoading(false);
    }
  };

  const handleRemoveExistingFile = (index: number) => {
    setExistingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!recap) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Recap not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
          <div className="p-8 md:p-10 space-y-8">
            <div className="flex flex-col gap-5 border-b border-base-100/20">
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/recap/list"
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
                    <h1>{recap.name ? `Edit: ${recap.name}` : "Edit Recap"}</h1>
                  </span>
                </div>
                <p className="text-base-content/70 text-sm mt-2">
                  Update the recap details and files below.
                </p>
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
                    label="Recap Name"
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

                <div className="grid grid-cols-1 gap-2 space-y-2">
                  <div>
                    <h3 className="font-semibold text-sm mb-2">
                      Existing Files
                    </h3>
                    {existingFiles.length === 0 ? (
                      <p className="text-sm text-base-content/70">
                        No existing files. Please add new ones.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {existingFiles.map((fileUrl, index) => (
                          <div
                            key={`${fileUrl}-${index}`}
                            className="card bg-base-100 shadow-sm"
                          >
                            <div className="card-body p-3 space-y-2">
                              <div className="h-32 w-full bg-base-200 rounded-lg flex items-center justify-center overflow-hidden">
                                <img
                                  src={fileUrl}
                                  className="max-h-full max-w-full object-contain"
                                  alt={`Existing file ${index + 1}`}
                                />
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-error"
                                onClick={() => handleRemoveExistingFile(index)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Add New Files</h3>
                    {newFiles.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          type="file"
                          className="file-input file-input-bordered w-full"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (file) {
                              const error = validateFile(file);
                              if (error) {
                                showAlert(error, "error");
                                e.target.value = "";
                                return;
                              }
                            }
                            handleNewFileChange(file, index);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemoveNewFile(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleAddNewFile}
                    >
                      Add File
                    </button>
                  </div>
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
                  disabled={isInFlight || loading}
                >
                  <SaveIcon className="w-4 h-4" />
                  Update Recap
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default EditRecap;
