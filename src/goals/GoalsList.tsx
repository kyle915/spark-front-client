import SparkOverlay from "@/shared/SparkOverlay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowPathIcon, FlagIcon, PencilIcon } from "@heroicons/react/24/solid";
import { useForm } from "react-hook-form";
import { useMutation } from "react-relay/hooks";

import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import DataTableRelay from "@/shared/DataTableRelay";
import type { Column } from "@/types/columnsTypes";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import FormInputText from "@/shared/FormInputText";
import {
  SetGoalsMutation,
  type SetGoalsMutationType,
} from "@/api/mutations/SetGoalsMutation";

type GoalRow = {
  id: string;
  uuid: string;
  userId: string;
  year: number;
  userName: string;
  eventTargetGoal: number | null;
  consumerSamplingGoal: number | null;
  brandAwarenessGoal: number | null;
  purchaseIntentGoal: number | null;
  femaleParticipationGoal: number | null;
  firstTimeBuyersGoal: number | null;
};

type GoalsListResponse = {
  data?: {
    goalsList?: Array<{
      id: string;
      uuid: string;
      userId: string;
      year: number;
      eventTargetGoal?: number | null;
      consumerSamplingGoal?: number | null;
      brandAwarenessGoal?: number | null;
      purchaseIntentGoal?: number | null;
      femaleParticipationGoal?: number | null;
      firstTimeBuyersGoal?: number | null;
      user?: {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      } | null;
    }>;
  };
  errors?: Array<{ message?: string }>;
};

const GOALS_LIST_QUERY = `
  query GoalsListInlineQuery($tenantId: ID!) {
    goalsList(tenantId: $tenantId) {
      id
      uuid
      userId
      year
      eventTargetGoal
      consumerSamplingGoal
      brandAwarenessGoal
      purchaseIntentGoal
      femaleParticipationGoal
      firstTimeBuyersGoal
      user {
        firstName
        lastName
        email
      }
    }
  }
`;

type GoalEditFormValues = {
  eventTargetGoal: string;
  consumerSamplingGoal: string;
  brandAwarenessGoal: string;
  purchaseIntentGoal: string;
  femaleParticipationGoal: string;
  firstTimeBuyersGoal: string;
};

const toInputInt = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toInputFloat = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const PAGE_SIZE = 10;

const goalsColumns: Column<GoalRow>[] = [
  {
    key: "userName",
    label: "RMM",
    render: (_value, row) => row.userName || "-",
  },
  {
    key: "year",
    label: "Year",
  },
  {
    key: "eventTargetGoal",
    label: "Event Target",
    render: (value) => (value ?? "-") as string | number,
  },
  {
    key: "consumerSamplingGoal",
    label: "Consumer Sampling",
    render: (value) => (value ?? "-") as string | number,
  },
  {
    key: "brandAwarenessGoal",
    label: "Brand Awareness",
    render: (value) => (value ?? "-") as string | number,
  },
  {
    key: "purchaseIntentGoal",
    label: "Purchase Intent",
    render: (value) => (value ?? "-") as string | number,
  },
  {
    key: "femaleParticipationGoal",
    label: "Female Participation",
    render: (value) => (value ?? "-") as string | number,
  },
  {
    key: "firstTimeBuyersGoal",
    label: "First-Time Buyers",
    render: (value) => (value ?? "-") as string | number,
  },
];

const GoalsList = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<GoalRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingGoal, setEditingGoal] = useState<GoalRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [commitSetGoals, isMutationInFlight] =
    useMutation<SetGoalsMutationType>(SetGoalsMutation);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting: isSaving },
  } = useForm<GoalEditFormValues>({
    defaultValues: {
      eventTargetGoal: "",
      consumerSamplingGoal: "",
      brandAwarenessGoal: "",
      purchaseIntentGoal: "",
      femaleParticipationGoal: "",
      firstTimeBuyersGoal: "",
    },
  });

  const fetchGoals = useCallback(async () => {
    if (!tenantId) return;

    const token = localStorage.getItem("@token");

    setLoading(true);
    try {
      const response = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `JWT ${token}` } : {}),
        },
        body: JSON.stringify({
          query: GOALS_LIST_QUERY,
          variables: {
            tenantId,
          },
        }),
      });

      const result = (await response.json()) as GoalsListResponse;

      if (result.errors?.length) {
        showAlert(result.errors[0]?.message ?? "Error loading goals", "error");
        return;
      }

      const mappedRows =
        result.data?.goalsList?.map((goal) => ({
          id: goal.id,
          uuid: goal.uuid,
          userId: goal.userId,
          year: goal.year,
          userName:
            [goal.user?.firstName, goal.user?.lastName]
              .filter(Boolean)
              .join(" ") ||
            goal.user?.email ||
            "-",
          eventTargetGoal: goal.eventTargetGoal ?? null,
          consumerSamplingGoal: goal.consumerSamplingGoal ?? null,
          brandAwarenessGoal: goal.brandAwarenessGoal ?? null,
          purchaseIntentGoal: goal.purchaseIntentGoal ?? null,
          femaleParticipationGoal: goal.femaleParticipationGoal ?? null,
          firstTimeBuyersGoal: goal.firstTimeBuyersGoal ?? null,
        })) ?? [];

      setRows(mappedRows);
      setCurrentPage(1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error loading goals";
      showAlert(message, "error");
    } finally {
      setLoading(false);
    }
  }, [showAlert, tenantId]);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    [rows.length],
  );

  const clampedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedRows = useMemo(() => {
    const start = (clampedCurrentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [clampedCurrentPage, rows]);

  const edges = useMemo(
    () =>
      paginatedRows.map((row, index) => ({
        cursor: `goal-${clampedCurrentPage}-${index}`,
        node: row,
      })),
    [paginatedRows, clampedCurrentPage],
  );

  const openEditModal = (goal: GoalRow) => {
    setEditingGoal(goal);
    reset({
      eventTargetGoal:
        goal.eventTargetGoal === null ? "" : String(goal.eventTargetGoal),
      consumerSamplingGoal:
        goal.consumerSamplingGoal === null
          ? ""
          : String(goal.consumerSamplingGoal),
      brandAwarenessGoal:
        goal.brandAwarenessGoal === null ? "" : String(goal.brandAwarenessGoal),
      purchaseIntentGoal:
        goal.purchaseIntentGoal === null ? "" : String(goal.purchaseIntentGoal),
      femaleParticipationGoal:
        goal.femaleParticipationGoal === null
          ? ""
          : String(goal.femaleParticipationGoal),
      firstTimeBuyersGoal:
        goal.firstTimeBuyersGoal === null ? "" : String(goal.firstTimeBuyersGoal),
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingGoal(null);
  };

  const onSubmitEdit = async (values: GoalEditFormValues) => {
    if (!tenantId || !editingGoal) return;

    try {
      await new Promise<void>((resolve) => {
        commitSetGoals({
          variables: {
            input: {
              tenantId,
              userId: editingGoal.userId,
              year: editingGoal.year,
              eventTargetGoal: toInputInt(values.eventTargetGoal),
              consumerSamplingGoal: toInputInt(values.consumerSamplingGoal),
              brandAwarenessGoal: toInputFloat(values.brandAwarenessGoal),
              purchaseIntentGoal: toInputFloat(values.purchaseIntentGoal),
              femaleParticipationGoal: toInputFloat(
                values.femaleParticipationGoal,
              ),
              firstTimeBuyersGoal: toInputInt(values.firstTimeBuyersGoal),
            },
          },
          onCompleted: (_response, errors) => {
            if (errors?.length) {
              showAlert(errors[0]?.message ?? "Error updating goal", "error");
            } else {
              showAlert("Goal updated successfully", "success");
              closeEditModal();
              void fetchGoals();
            }
            resolve();
          },
          onError: (error) => {
            showAlert(error.message, "error");
            resolve();
          },
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error updating goal";
      showAlert(message, "error");
    }
  };

  if (!tenantId) {
    return (
      <Layout>
        <div className="alert alert-warning">
          <span>Select a tenant to view goals.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FlagIcon className="w-8 h-8" />
              </div>
              <h1>Goals</h1>
            </div>
            <p className="text-base-content/70">Goals by RMM for the current tenant.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void fetchGoals()}
              disabled={loading}
            >
              <ArrowPathIcon className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              Reload
            </button>

            <Link className="btn btn-primary btn-sm" to="/goals/create">
              Create Goal
            </Link>
          </div>
        </div>

        <DataTableRelay<GoalRow>
          columns={goalsColumns}
          edges={edges}
          totalCount={rows.length}
          pageInfo={{
            hasNextPage: clampedCurrentPage < totalPages,
            hasPreviousPage: clampedCurrentPage > 1,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges[edges.length - 1]?.cursor ?? null,
          }}
          currentPage={clampedCurrentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          onGoToPage={(page) => setCurrentPage(page)}
          isNavigating={loading}
          customActions={{
            headerLabel: "Actions",
            render: (row) => (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => openEditModal(row)}
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            ),
          }}
          emptyState={
            <SparkEmptyState title="No goals found for this tenant." />
          }
        />
      </div>

      {isEditModalOpen && editingGoal ? (
        <SparkOverlay onClose={closeEditModal} size="lg" label="Edit Goal">
          <div>
            <h3 className="font-bold text-lg mb-2">Edit Goal</h3>
            <p className="text-sm text-base-content/70 mb-4">
              Update goals for <strong>{editingGoal.userName}</strong>.
            </p>
            <p className="text-xs text-base-content/60 mb-4">
              Year: {editingGoal.year}
            </p>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmitEdit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInputText
                  control={control}
                  name="eventTargetGoal"
                  label="Event Target Goal"
                  type="number"
                />
                <FormInputText
                  control={control}
                  name="consumerSamplingGoal"
                  label="Consumer Sampling Goal"
                  type="number"
                />
                <FormInputText
                  control={control}
                  name="brandAwarenessGoal"
                  label="Brand Awareness Goal"
                  type="number"
                />
                <FormInputText
                  control={control}
                  name="purchaseIntentGoal"
                  label="Purchase Intent Goal"
                  type="number"
                />
                <FormInputText
                  control={control}
                  name="femaleParticipationGoal"
                  label="Female Participation Goal"
                  type="number"
                />
                <FormInputText
                  control={control}
                  name="firstTimeBuyersGoal"
                  label="First-Time Buyers Goal"
                  type="number"
                />
              </div>

              <div className="spark-overlay-actions">
                <button
                  type="submit"
                  className="spark-overlay-action spark-overlay-action-primary"
                  disabled={isSaving || isMutationInFlight}
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="spark-overlay-action spark-overlay-action-cancel"
                  onClick={closeEditModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </SparkOverlay>
      ) : null}
    </Layout>
  );
};

export default GoalsList;
