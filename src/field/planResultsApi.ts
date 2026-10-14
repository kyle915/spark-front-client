import { postGql } from "./fieldMarketingGql";

export type RecapKind = "legacy" | "custom";

export type MetricPart = { label: string; value: number };

export type RecapPlanMetric = {
  key: string;
  label: string;
  value: number | null;
  text: string;
  unit: string;
  parts: MetricPart[];
  defaultOn: boolean;
};

export type PlanSummary = {
  id: string;
  name: string;
  startsOn: string;
  days: number;
  market: string;
  marketLabel: string;
  managerName: string;
  activity: string;
  activityLabel: string;
  requestCode: string | null;
};

export type PlanSuggestion = {
  plan: PlanSummary;
  score: number;
  reasons: string[];
  linked: boolean;
};

export type RecapPlanPicker = {
  available: boolean;
  executionType: string;
  executionLabel: string;
  currentPlan: PlanSummary | null;
  currentMetricKeys: string[];
  currentAuto: boolean;
  metrics: RecapPlanMetric[];
  suggestions: PlanSuggestion[];
};

export type PlanResultRow = {
  key: string;
  label: string;
  planned: number | null;
  actual: number | null;
  unit: string;
  text: string;
  note: string;
  parts: MetricPart[];
};

export type PlanResultRecap = {
  id: string;
  kind: RecapKind;
  uuid: string;
  name: string;
  date: string;
  baName: string;
  status: "approved" | "needs_review" | "archived" | "third_party";
  auto: boolean;
  href: string;
  metrics: Pick<RecapPlanMetric, "key" | "label" | "text">[];
};

export type PlanResults = {
  planId: string;
  planName: string;
  counted: number;
  pending: number;
  rows: PlanResultRow[];
  recaps: PlanResultRecap[];
};

export type PlanRecapSuggestion = {
  recapId: string;
  kind: RecapKind;
  name: string;
  date: string;
  baName: string;
  status: PlanResultRecap["status"];
  href: string;
  reasons: string[];
  currentPlanName: string | null;
  metrics: Pick<RecapPlanMetric, "key" | "label" | "text" | "defaultOn">[];
};

const PLAN_FIELDS = `
  id name startsOn days market marketLabel managerName activity activityLabel requestCode
`;

const PICKER = `
  query RecapPlanPicker($recapId: ID!, $kind: String!, $query: String) {
    recapPlanPicker(recapId: $recapId, kind: $kind, query: $query) {
      available executionType executionLabel currentAuto currentMetricKeys
      currentPlan { ${PLAN_FIELDS} }
      metrics { key label value text unit defaultOn parts { label value } }
      suggestions { score reasons linked plan { ${PLAN_FIELDS} } }
    }
  }
`;

const PUSH = `
  mutation PushRecapToPlan($input: PushRecapToPlanInput!) {
    pushRecapToPlan(input: $input) {
      success message metricKeys plan { ${PLAN_FIELDS} }
    }
  }
`;

const REMOVE = `
  mutation RemoveRecapFromPlan($input: RemoveRecapFromPlanInput!) {
    removeRecapFromPlan(input: $input) { success message }
  }
`;

const RESULTS = `
  query FieldMarketingPlanResults($planId: String!) {
    fieldMarketingPlanResults(planId: $planId) {
      planId planName counted pending
      rows { key label planned actual unit text note parts { label value } }
      recaps {
        id kind uuid name date baName status auto href
        metrics { key label text }
      }
    }
  }
`;

const SUGGEST_RECAPS = `
  query PlanRecapSuggestions($planId: String!) {
    planRecapSuggestions(planId: $planId) {
      recapId kind name date baName status href reasons currentPlanName
      metrics { key label text defaultOn }
    }
  }
`;

export async function fetchPlanRecapSuggestions(
  planId: string,
): Promise<PlanRecapSuggestion[]> {
  const data = await postGql<{ planRecapSuggestions: PlanRecapSuggestion[] }>(
    SUGGEST_RECAPS,
    { planId },
  );
  return data.planRecapSuggestions;
}

export async function fetchRecapPlanPicker(
  recapId: string,
  kind: RecapKind,
  query?: string,
): Promise<RecapPlanPicker> {
  const data = await postGql<{ recapPlanPicker: RecapPlanPicker }>(PICKER, {
    recapId,
    kind,
    query: query?.trim() || null,
  });
  return data.recapPlanPicker;
}

export async function pushRecapToPlan(input: {
  recapId: string;
  kind: RecapKind;
  planId: string;
  metricKeys: string[];
  confirmMove: boolean;
}): Promise<{ message: string; plan: PlanSummary | null }> {
  const data = await postGql<{
    pushRecapToPlan: { message: string; plan: PlanSummary | null };
  }>(PUSH, { input });
  return data.pushRecapToPlan;
}

export async function removeRecapFromPlan(
  recapId: string,
  kind: RecapKind,
): Promise<string> {
  const data = await postGql<{ removeRecapFromPlan: { message: string } }>(
    REMOVE,
    { input: { recapId, kind } },
  );
  return data.removeRecapFromPlan.message;
}

export async function fetchPlanResults(planId: string): Promise<PlanResults> {
  const data = await postGql<{ fieldMarketingPlanResults: PlanResults }>(
    RESULTS,
    { planId },
  );
  return data.fieldMarketingPlanResults;
}
