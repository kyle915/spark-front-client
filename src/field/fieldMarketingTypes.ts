export type Manager = {
  market: string;
  marketLabel: string;
  name: string;
  email: string;
  phone: string;
};

export type Kpi = {
  key: string;
  label: string;
  detail: string;
  target: number;
  planned: number;
  logged: number | null;
  unit: string;
};

export type FmEvent = {
  id: string;
  market: string;
  marketLabel: string;
  managerName: string;
  activity: string;
  activityLabel: string;
  name: string;
  startsOn: string;
  days: number;
  address: string;
  notes: string;
  samplingFormat: string;
  samplingLabel: string;
  supportType: string;
  supportLabel: string;
  supportOther: string;
  skuNames: string[];
  needsFieldSupport: boolean;
  ambassadorCount: number;
  supportTimes: string;
  startTime: string;
  endTime: string;
  supportScope: string;
  plannedFullCans: number;
  plannedPourSamples: number;
  plannedEmails: number;
  loggedFullCans: number | null;
  loggedPourSamples: number | null;
  loggedEmails: number | null;
  loggedDays: number | null;
  loggedCases: number | null;
  status: string;
  requestCode: string | null;
  requestUuid: string | null;
  requestCancelled: boolean;
  canBook: boolean;
  deleteEffect: DeleteEffect;
  deletedAt: string | null;
  deletedByName: string;
  deleteCancelledRequest: boolean;
  resultsCounted: number;
  resultsPending: number;
};

/** What deleting the row does to its linked request. */
export type DeleteEffect = "remove" | "cancel_request" | "keep_request";

export type Board = {
  available: boolean;
  month: string;
  monthLabel: string;
  managers: Manager[];
  kpis: Kpi[];
  events: FmEvent[];
  deletedEvents: FmEvent[];
  canRestore: boolean;
  skus: string[];
};
