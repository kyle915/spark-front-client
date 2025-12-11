import { useEffect, useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { useParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { RecapQuery } from "@/api/queries/RecapQuery";
import { UpdateRecapMutation } from "@/api/mutations/UpdateRecapMutation";
import type { TenantsQuery as TenantsQueryType } from "@/api/queries/__generated__/TenantsQuery.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { RecapQuery as RecapQueryType } from "@/api/queries/__generated__/RecapQuery.graphql";
import type { UpdateRecapMutation as UpdateRecapMutationType } from "@/api/mutations/__generated__/UpdateRecapMutation.graphql";
import type { GraphQLTaggedNode } from "react-relay";
import { useAlertStore } from "@/store/alertStore";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@/shared/FormAutocomplete";
import Loading from "@/shared/Loading";
import LoadingButton from "@/shared/LoadingButton";
import environment from "@/api/relay/environment";

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

  const recapData = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const recap = recapData.recap;

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

  const { control, handleSubmit, watch, setValue } = useForm<RecapFormValues>({
    defaultValues: {
      name: recap?.name ?? "",
      tenantId: recap?.event?.tenantId ?? "",
      eventId: recap?.event?.id ?? "",
    },
  });

  const selectedTenantId = watch("tenantId");

  useEffect(() => {
    if (recap?.recapFiles) {
      setExistingFiles(
        recap.recapFiles.map((f) => f.file ?? "").filter(Boolean)
      );
    }
  }, [recap?.recapFiles]);

  useEffect(() => {
    if (!selectedTenantId) {
      const initialTenant =
        recap?.event?.tenantId || tenantOptions[0]?.value || "";
      if (initialTenant) {
        setValue("tenantId", initialTenant);
      }
    }
  }, [recap?.event?.tenantId, selectedTenantId, setValue, tenantOptions]);

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
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Edit Recap</h1>
        <p className="text-sm text-base-content/70">UUID: {recap.uuid}</p>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <EventSelect tenantId={selectedTenantId} control={control} />
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

            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm mb-2">Existing Files</h3>
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
                text="Update Recap"
                disabled={isInFlight}
              />
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EditRecap;
