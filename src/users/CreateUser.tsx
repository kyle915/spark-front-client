import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import FormInputText from "@shared/FormInputText";
import { useMutation } from "react-relay/hooks";
import { CreateUserMutation } from "@/api/mutations/CreateUserMutation";
import type { CreateUserMutation as CreateUserMutationType } from "@/api/mutations/__generated__/CreateUserMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { fetchQuery, graphql } from "react-relay";
import type { GraphQLTaggedNode } from "react-relay";
import environment from "@api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { SaveIcon } from "lucide-react";

type RoleOption = "CLIENT" | "AMBASSADOR" | "SPARK";

type CreateUserFormValues = {
  firstName: string;
  email: string;
  password1: string;
  password2: string;
  role: RoleOption | null;
  tenantId?: string;
};

const CreateUser = () => {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const [commitCreate, isCreating] =
    useMutation<CreateUserMutationType>(CreateUserMutation);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!profileFile) {
      setProfilePreview(null);
      return;
    }
    const url = URL.createObjectURL(profileFile);
    setProfilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profileFile]);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { isSubmitting },
  } = useForm<CreateUserFormValues>({
    defaultValues: {
      firstName: "",
      email: "",
      password1: "",
      password2: "",
      role: "CLIENT",
      tenantId: tenantId || "",
    },
  });

  const password1 = watch("password1");
  const password2 = watch("password2");

  // Live password match validation
  useEffect(() => {
    if (password2 && password1 !== password2) {
      setError("password2", {
        type: "validate",
        message: "Passwords do not match",
      });
    } else {
      clearErrors("password2");
    }
  }, [password1, password2, setError, clearErrors]);

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query CreateUser_GetUploadUrlQuery(
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

  const uploadProfileImage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `users/${timestamp}_${file.name}`;

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

  const onSubmit = async (values: CreateUserFormValues) => {
    if (values.password1 !== values.password2) {
      showAlert("Passwords do not match", "warning");
      return;
    }

    const roleToSend: RoleOption = "CLIENT";
    const tenantId =
      roleToSend === "CLIENT" ? values.tenantId || undefined : undefined;

    let imageBlob: string | undefined;

    try {
      if (profileFile) {
        setIsUploading(true);
        imageBlob = await uploadProfileImage(profileFile);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error uploading profile image";
      showAlert(message, "error");
      setIsUploading(false);
      return;
    }

    commitCreate({
      variables: {
        input: {
          firstName: values.firstName,
          email: values.email,
          password1: values.password1,
          password2: values.password2,
          role: roleToSend,
          tenantId,
          image: imageBlob,
        },
      },
      onCompleted: (response) => {
        const payload = response.createUser;
        if (payload?.success) {
          showAlert(payload.message ?? "User created", "success");
          navigate("/users/list", { state: { refresh: true } });
        } else {
          showAlert(payload?.message ?? "Error creating user", "error");
        }
        setIsUploading(false);
      },
      onError: (error) => {
        showAlert(error.message, "error");
        setIsUploading(false);
      },
    });
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
          <div className="p-8 md:p-10 space-y-8">
            <div className="flex flex-col gap-5 border-b border-base-100/20">
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/users/list"
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
                    <h1>Create User</h1>
                  </span>
                </div>
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
                  name="firstName"
                  placeholder="Enter name"
                  label="First Name"
                  rules={{ required: "First name is required" }}
                />
                <FormInputText
                  control={control}
                  name="email"
                  placeholder="Enter email"
                  label="Email"
                  type="email"
                  rules={{ required: "Email is required" }}
                />

                <FormInputText
                  control={control}
                  name="password1"
                  label="Password"
                  placeholder="Enter a secure password"
                  type="password"
                  rules={{ required: "Password is required" }}
                />

                <FormInputText
                  control={control}
                  name="password2"
                  label="Confirm password"
                  placeholder="Re-enter your password"
                  type="password"
                  rules={{
                    required: "Please confirm your password",
                    validate: (value) =>
                      value === password1 || "Passwords do not match",
                  }}
                />

                {/*
                <FormAutocomplete
                  control={control}
                  name="role"
                  label="Select role for user"
                  options={roleOptions}
                  placeholder="Select role"
                  rules={{ required: "Role is required" }}
                />
                */}
              </div>
            </section>

            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <label className="label">
                  <span className="label-text font-semibold">
                    Profile Image
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1">
                <input
                  type="file"
                  accept="image/*"
                  className="file-input file-input-bordered w-full"
                  onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)}
                />
                {profilePreview ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="avatar">
                      <div className="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                        <img
                          src={profilePreview}
                          alt="Profile preview"
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setProfileFile(null)}
                      disabled={isSubmitting || isCreating || isUploading}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <span className="text-xs text-base-content/70 mt-1">
                  Optional. This image will be used as the user profile picture.
                </span>
              </div>
            </section>

            <div className="pt-2 flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/users/list"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </Link>
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSubmitting || isCreating || isUploading}
              >
                {isSubmitting || isCreating || isUploading ? (
                  <>
                    <span className="loading loading-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default CreateUser;
