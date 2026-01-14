import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useForm } from "react-hook-form";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import Layout from "@/layout/Layout";
import Loading from "@shared/Loading";
import DataTableRelay from "@shared/DataTableRelay";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@/api/queries/__generated__/UsersQuery.graphql";
import { userColumns } from "@utils/columns";
import type { UserRow } from "@/types/columnsTypes";
import FormInputText from "@shared/FormInputText";
import { useMutation } from "react-relay/hooks";
import { UpdateUserMutation } from "@/api/mutations/UpdateUserMutation";
import type { UpdateUserMutation as UpdateUserMutationType } from "@/api/mutations/__generated__/UpdateUserMutation.graphql";
import { ChangeUserPasswordMutation } from "@/api/mutations/ChangeUserPasswordMutation";
import type { ChangeUserPasswordMutation as ChangeUserPasswordMutationType } from "@/api/mutations/__generated__/ChangeUserPasswordMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { PencilIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { fetchQuery, graphql } from "react-relay";
import type { GraphQLTaggedNode } from "react-relay";
import environment from "@api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { FilterIcon, FunnelXIcon, KeyIcon } from "lucide-react";
import FormInputPassword from "@/shared/FormInputPassword";

const PAGE_SIZE = 10;

type UsersTableContentProps = {
  queryReference: PreloadedQuery<UsersQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  onEditUser: (user: UserRow) => void;
  onChangePassword: (user: UserRow) => void;
};

const UsersTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  onEditUser,
  onChangePassword,
}: UsersTableContentProps) => {
  const data = usePreloadedQuery<UsersQueryType>(UsersQuery, queryReference);
  const connection = data.users;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>User data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<UserRow>
      connection={connection}
      columns={userColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      isNavigating={isNavigating}
      onPageLoaded={onPageLoaded}
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => onEditUser(row)}
            >
              <PencilIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              className="btn btn-xs btn-ghost tooltip"
              onClick={() => onChangePassword(row)}
              data-tip="Change password"
            >
              <KeyIcon className="w-4 h-4 text-primary" />
            </button>
          </div>
        ),
      }}
    />
  );
};

type UsersListInnerProps = {
  filters?: UsersQueryType["variables"]["filters"];
  onEditUser: (user: UserRow) => void;
  onChangePassword: (user: UserRow) => void;
  onReady?: (refreshFn: () => void) => void;
};

const UsersListInner = ({
  filters,
  onEditUser,
  onReady,
  onChangePassword,
}: UsersListInnerProps) => {
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
    refresh,
  } = useRelayPagination<UsersQueryType>({
    query: UsersQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  useEffect(() => {
    if (onReady) {
      onReady(refresh);
    }
  }, [onReady, refresh]);

  return (
    <Suspense fallback={<Loading />}>
      {queryRef ? (
        <UsersTableContent
          queryReference={queryRef}
          currentPage={displayPage}
          pageSize={PAGE_SIZE}
          onNext={goNext}
          onPrevious={goPrevious}
          onGoToPage={goToPage}
          isNavigating={isNavigating}
          onPageLoaded={handlePageLoaded}
          onEditUser={onEditUser}
          onChangePassword={onChangePassword}
        />
      ) : (
        <Loading />
      )}
    </Suspense>
  );
};

type RoleFilterOption = "all" | "AMBASSADOR" | "CLIENT" | "SPARK";
type RoleValue = Exclude<RoleFilterOption, "all">;

type FormValues = {
  name: string;
  email: string;
  role: RoleFilterOption | null;
  tenantId: string | null;
};

type EditUserFormValues = {
  firstName: string;
  lastName?: string | null;
  email: string;
  role: RoleValue | null;
  tenantId: string | null;
};

const normalizeRoleName = (name?: string | null): RoleValue | null => {
  if (!name) return null;
  const upper = name.toUpperCase();
  if (upper.includes("CLIENT")) return "CLIENT";
  if (upper.includes("AMBASSADOR")) return "AMBASSADOR";
  if (upper.includes("SPARK")) return "SPARK";
  return null;
};

type ChangePasswordFormValues = {
  password1: string;
  password2: string;
};

const UsersList = () => {
  const { tenantId } = useAuthStore();
  const location = useLocation();

  // Refresh list if navigated with refresh state
  useEffect(() => {
    if (location.state?.refresh && refreshListRef.current) {
      refreshListRef.current();
    }
  }, [location.state]);

  const { control, watch, reset } = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      role: "all",
      tenantId: tenantId,
    },
  });

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    watch: watchEdit,
    setValue: setEditValue,
    formState: { isSubmitting: isSaving },
  } = useForm<EditUserFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "CLIENT",
      tenantId: "",
    },
  });

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    watch: watchPassword,
    formState: { isSubmitting: isChangingPassword },
  } = useForm<ChangePasswordFormValues>({
    defaultValues: {
      password1: "",
      password2: "",
    },
  });

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshListRef = useRef<(() => void) | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setCurrentRoleLabel] = useState<string | null>(null);

  useEffect(() => {
    if (profileFile) {
      const url = URL.createObjectURL(profileFile);
      setProfilePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setProfilePreview(editingUser?.image ?? null);
    return undefined;
  }, [profileFile, editingUser?.image]);

  const { showAlert } = useAlertStore();
  const [commitUpdate] =
    useMutation<UpdateUserMutationType>(UpdateUserMutation);
  const [commitChangePassword] = useMutation<ChangeUserPasswordMutationType>(
    ChangeUserPasswordMutation
  );

  const selectedName = watch("name");
  const selectedEmail = watch("email");
  const selectedRole = watch("role") ?? "all";
  const selectedTenant = watch("tenantId");
  const editRole = watchEdit("role");
  const effectiveEditRole: RoleValue | null = editRole ?? null;

  useEffect(() => {
    if (effectiveEditRole !== "CLIENT") {
      setEditValue("tenantId", "");
    }
  }, [effectiveEditRole, setEditValue]);

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query UsersList_GetUploadUrlQuery(
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

  const filters = useMemo<UsersQueryType["variables"]["filters"]>(
    () => ({
      name: selectedName || undefined,
      email: selectedEmail || undefined,
      role: selectedRole === "all" || !selectedRole ? undefined : selectedRole,
      tenantId:
        selectedRole === "CLIENT" ? selectedTenant ?? undefined : undefined,
    }),
    [selectedEmail, selectedName, selectedRole, selectedTenant]
  );

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      (filters?.name && filters.name.trim() !== "") ||
        (filters?.email && filters.email.trim() !== "") ||
        filters?.role ||
        filters?.tenantId
    );
  }, [filters]);

  const listKey = `${selectedName}-${selectedEmail}-${selectedRole}-${
    selectedTenant ?? ""
  }-${refreshKey}`;

  const password1Value = watchPassword("password1");

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordUser(null);
  };

  const handleEditUser = (user: UserRow) => {
    setEditingUser(user);
    const normalizedRole = normalizeRoleName(user.role?.name);
    resetEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: normalizedRole,
      tenantId: normalizedRole === "CLIENT" ? tenantId || "" : "",
    });
    setProfileFile(null);
    setCurrentRoleLabel(user.role?.name ?? null);
    setIsModalOpen(true);
  };

  const handleChangePassword = (user: UserRow) => {
    setPasswordUser(user);
    resetPasswordForm({
      password1: "",
      password2: "",
    });
    setIsPasswordModalOpen(true);
  };

  const onSubmitEdit = async (values: EditUserFormValues) => {
    if (!editingUser?.id) return;
    const roleToSend: RoleValue = "CLIENT";
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

    commitUpdate({
      variables: {
        input: {
          id: editingUser.id,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          role: roleToSend,
          tenantId,
          image: imageBlob,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateUser;
        if (payload?.success) {
          showAlert(payload.message ?? "User updated", "success");
          if (refreshListRef.current) {
            refreshListRef.current();
          } else {
            setRefreshKey((prev) => prev + 1);
          }
          closeModal();
        } else {
          showAlert(payload?.message ?? "Error updating user", "error");
        }
        setIsUploading(false);
      },
      onError: (error) => {
        showAlert(error.message, "error");
        setIsUploading(false);
      },
    });
  };

  const onSubmitPassword = async (values: ChangePasswordFormValues) => {
    if (!passwordUser?.id) return;

    // for loading submission state
    return new Promise<void>(() => {
      commitChangePassword({
        variables: {
          input: {
            id: passwordUser.id,
            password1: values.password1,
            password2: values.password2,
          },
        },
        onCompleted: (response) => {
          const payload = response.changeUserPassword;
          if (payload?.success) {
            showAlert(payload.message ?? "Password updated", "success");
            closePasswordModal();
          } else {
            showAlert(payload?.message ?? "Error updating password", "error");
          }
        },
        onError: (error) => {
          showAlert(error.message, "error");
        },
      });
    });
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <UserGroupIcon className="w-8 h-8" />
          </div>
          <h1>All Users</h1>
        </div>
        <p className="text-sm text-base-content/70">
          Filter by role to manage platform users.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl  bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <FilterIcon className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-base-content/70">
                Filters
              </h2>
            </div>

            {hasActiveFilters && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => reset()}
                >
                  <FunnelXIcon className="w-4 h-4" />
                  Clear filters
                </button>
              </>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInputText
              control={control}
              name="name"
              label="Filter by Name"
              placeholder="Enter name"
            />
            <FormInputText
              control={control}
              name="email"
              placeholder="e.g., demo@email.com"
              label="Filter by Email"
            />
            {/*
            <FormAutocomplete
              control={control}
              name="role"
              label="Role"
              options={roleOptions}
              placeholder="Select a role"
            />
            */}
          </div>
        </div>

        <UsersListInner
          key={listKey}
          filters={filters}
          onEditUser={handleEditUser}
          onChangePassword={handleChangePassword}
          onReady={(refreshFn) => {
            refreshListRef.current = refreshFn;
          }}
        />
      </div>

      {isModalOpen && editingUser ? (
        <dialog open className="modal">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-2">Edit User</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Update the user details. Tenant is only required for Client role.
            </p>

            <form
              className="space-y-4"
              onSubmit={handleEditSubmit(onSubmitEdit)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInputText
                  control={editControl}
                  placeholder="Enter first name"
                  name="firstName"
                  label="First Name"
                  rules={{ required: "First name is required" }}
                />
                <FormInputText
                  control={editControl}
                  placeholder="Enter last name"
                  name="lastName"
                  label="Last Name"
                />
                <div className="md:col-span-2">
                  <FormInputText
                    control={editControl}
                    placeholder="demo@email.com"
                    name="email"
                    label="Email"
                    type="email"
                    rules={{ required: "Email is required" }}
                  />
                </div>
                {/*
                <FormAutocomplete
                  control={editControl}
                  name="role"
                  label="Role"
                  options={roleOptionsNoAll}
                  placeholder="Select role"
                  rules={
                    currentRoleLabel && !effectiveEditRole
                      ? undefined
                      : { required: "Role is required" }
                  }
                />
                {currentRoleLabel && !effectiveEditRole ? (
                  <div className="md:col-span-2 text-sm text-warning">
                    Current role: {currentRoleLabel}. This role does not match
                    available options; leave unchanged or pick a new one.
                  </div>
                ) : null}
                */}

                <label className="form-control md:col-span-2">
                  <div className="label pb-1">
                    <span className="label-text">Profile Image</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="file-input file-input-bordered w-full"
                    onChange={(e) =>
                      setProfileFile(e.target.files?.[0] ?? null)
                    }
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
                        disabled={isSaving || isUploading}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <span className="text-xs text-base-content/70 mt-1">
                    Optional. Upload to update the user profile picture.
                  </span>
                </label>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closeModal}
                  disabled={isSaving || isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${
                    isSaving || isUploading ? "loading" : ""
                  }`}
                  disabled={isSaving || isUploading}
                >
                  {isSaving || isUploading ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>
              close
            </button>
          </form>
        </dialog>
      ) : null}

      {isPasswordModalOpen && passwordUser ? (
        <dialog open className="modal">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-2">Change Password</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Set a new password for {passwordUser.firstName}{" "}
              {passwordUser.lastName}.
            </p>

            <form
              className="space-y-4"
              onSubmit={handlePasswordSubmit(onSubmitPassword)}
            >
              <FormInputPassword
                control={passwordControl}
                name="password1"
                label="New Password"
                rules={{ required: "Password is required" }}
              />
              <FormInputPassword
                control={passwordControl}
                name="password2"
                label="Confirm Password"
                rules={{
                  required: "Confirm password is required",
                  validate: (value) =>
                    value === password1Value || "Passwords do not match",
                }}
              />

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={closePasswordModal}
                  disabled={isChangingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${
                    isChangingPassword ? "loading" : ""
                  }`}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closePasswordModal}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </Layout>
  );
};

export default UsersList;
