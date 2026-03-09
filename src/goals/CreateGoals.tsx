import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Link } from "react-router";
import { ArrowLeftIcon, FlagIcon } from "@heroicons/react/24/solid";

import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import LoadingButton from "@/shared/LoadingButton";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormInputText from "@/shared/FormInputText";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import {
  SetGoalsMutation,
  type SetGoalsMutationType,
} from "@/api/mutations/SetGoalsMutation";

import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

type GoalFormValues = {
  userId: string | null;
  year: string;
  eventTargetGoal: string;
  consumerSamplingGoal: string;
  brandAwarenessGoal: string;
  purchaseIntentGoal: string;
  femaleParticipationGoal: string;
  firstTimeBuyersGoal: string;
};

const parseOptionalInt = (value: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseOptionalFloat = (value: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const CreateGoalsForm = ({ tenantId }: { tenantId: string }) => {
  const { showAlert } = useAlertStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commitSetGoals, isMutationInFlight] =
    useMutation<SetGoalsMutationType>(SetGoalsMutation);

  const rmmClientsData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );

  const defaultYear = String(new Date().getFullYear());

  const { control, handleSubmit } = useForm<GoalFormValues>({
    defaultValues: {
      userId: null,
      year: defaultYear,
      eventTargetGoal: "",
      consumerSamplingGoal: "",
      brandAwarenessGoal: "",
      purchaseIntentGoal: "",
      femaleParticipationGoal: "",
      firstTimeBuyersGoal: "",
    },
  });

  const rmmOptions = useMemo(
    () =>
      (rmmClientsData.rmmClients ?? []).map((rmm) => ({
        value: rmm.id,
        label:
          [rmm.firstName, rmm.lastName].filter(Boolean).join(" ") ||
          rmm.username ||
          rmm.id,
      })),
    [rmmClientsData.rmmClients],
  );

  const onSubmit = async (values: GoalFormValues) => {
    const userId = values.userId;

    if (!userId) {
      showAlert("Please select an RMM", "error");
      return;
    }

    const year = Number.parseInt(values.year, 10);
    if (Number.isNaN(year)) {
      showAlert("Year must be a valid number", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise<void>((resolve) => {
        commitSetGoals({
          variables: {
            input: {
              tenantId,
              userId,
              year,
              eventTargetGoal: parseOptionalInt(values.eventTargetGoal),
              consumerSamplingGoal: parseOptionalInt(values.consumerSamplingGoal),
              brandAwarenessGoal: parseOptionalFloat(values.brandAwarenessGoal),
              purchaseIntentGoal: parseOptionalFloat(values.purchaseIntentGoal),
              femaleParticipationGoal: parseOptionalFloat(
                values.femaleParticipationGoal,
              ),
              firstTimeBuyersGoal: parseOptionalInt(values.firstTimeBuyersGoal),
            },
          },
          onCompleted: (_response, errors) => {
            if (errors?.length) {
              showAlert(errors[0]?.message ?? "Error creating goals", "error");
            } else {
              showAlert("Goals created successfully", "success");
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
        error instanceof Error ? error.message : "Unexpected error creating goals";
      showAlert(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          <div className="flex flex-col gap-4 border-b border-base-100/20 pb-6">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/goals/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                <FlagIcon className="w-7 h-7" />
                <h1>Create Goals</h1>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                Define goals for an RMM in the selected tenant.
              </p>
            </div>
          </div>

          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Goal Setup</p>
              <span className="text-xs text-base-content/60">Required fields</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormAutocomplete
                control={control}
                name="userId"
                label="RMM *"
                options={rmmOptions}
                placeholder="Select RMM"
                rules={{ required: "RMM is required" }}
              />

              <FormInputText
                control={control}
                name="year"
                label="Year *"
                placeholder="e.g. 2026"
                type="number"
                rules={{
                  required: "Year is required",
                  validate: (value) => {
                    const parsed = Number.parseInt(value ?? "", 10);
                    if (Number.isNaN(parsed)) return "Year must be a valid number";
                    if (parsed < 2000) return "Year must be 2000 or later";
                    if (parsed > 2100) return "Year must be 2100 or earlier";
                    return true;
                  },
                }}
              />

              <FormInputText
                control={control}
                name="eventTargetGoal"
                label="Event Target Goal"
                placeholder="e.g. 120"
                type="number"
              />

              <FormInputText
                control={control}
                name="consumerSamplingGoal"
                label="Consumer Sampling Goal"
                placeholder="e.g. 500"
                type="number"
              />

              <FormInputText
                control={control}
                name="brandAwarenessGoal"
                label="Brand Awareness Goal"
                placeholder="e.g. 75.5"
                type="number"
              />

              <FormInputText
                control={control}
                name="purchaseIntentGoal"
                label="Purchase Intent Goal"
                placeholder="e.g. 64.2"
                type="number"
              />

              <FormInputText
                control={control}
                name="femaleParticipationGoal"
                label="Female Participation Goal"
                placeholder="e.g. 48.0"
                type="number"
              />

              <FormInputText
                control={control}
                name="firstTimeBuyersGoal"
                label="First-Time Buyers Goal"
                placeholder="e.g. 80"
                type="number"
              />
            </div>
          </section>

          <div className="pt-2 flex items-center justify-end">
            <LoadingButton
              type="submit"
              loading={isSubmitting || isMutationInFlight}
              text="Save Goals"
            />
          </div>
        </div>
      </div>
    </form>
  );
};

const CreateGoalsContent = () => {
  const { tenantId } = useAuthStore();

  if (!tenantId) {
    return (
      <div className="alert alert-warning">
        <span>Select a tenant to create goals.</span>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <CreateGoalsForm tenantId={tenantId} />
    </Suspense>
  );
};

const CreateGoals = () => {
  return (
    <Layout>
      <CreateGoalsContent />
    </Layout>
  );
};

export default CreateGoals;
