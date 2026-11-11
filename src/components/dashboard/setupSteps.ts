/**
 * New-client setup checklist: what a workspace needs before the first
 * activation runs cleanly. Pure logic so it can be unit-tested without the
 * Relay artifacts.
 */
export type SetupFacts = {
  hasProducts: boolean;
  hasRecapTemplate: boolean;
  hasClientContact: boolean;
  hasCheckinLink: boolean;
  hasEvent: boolean;
  hasRecap: boolean;
};

export type SetupStep = {
  key: keyof SetupFacts;
  label: string;
  hint: string;
  done: boolean;
  /** Where to go to finish it. Absent when nothing in the app does it. */
  to?: string;
  action?: string;
};

export const buildSetupSteps = (f: SetupFacts): SetupStep[] => [
  {
    key: "hasProducts",
    label: "Add products",
    hint: "The SKUs ambassadors report on.",
    done: f.hasProducts,
    to: "/products/products-list",
    action: "Add products",
  },
  {
    key: "hasRecapTemplate",
    label: "Build the recap form",
    hint: "The questions and photos each recap collects.",
    done: f.hasRecapTemplate,
    to: "/recaps/templates",
    action: "Open templates",
  },
  {
    key: "hasClientContact",
    label: "Invite a client contact",
    hint: "So someone on the brand side can approve requests and read reports.",
    done: f.hasClientContact,
    to: "/team",
    action: "Invite",
  },
  {
    key: "hasCheckinLink",
    label: "Issue the check-in link",
    hint: "The link ambassadors use to clock in and recap.",
    done: f.hasCheckinLink,
  },
  {
    key: "hasEvent",
    label: "Schedule the first event",
    hint: "Create a request or bulk-upload a schedule.",
    done: f.hasEvent,
    to: "/requests/create",
    action: "Create request",
  },
  {
    key: "hasRecap",
    label: "Receive the first recap",
    hint: "Arrives when an ambassador finishes a shift.",
    done: f.hasRecap,
  },
];

export const setupProgress = (
  steps: SetupStep[],
): { done: number; total: number; complete: boolean } => {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
};

/**
 * The checklist is for workspaces that have not launched. Once a recap has
 * come in the program is running, so the card stays out of the way even if
 * an earlier step was skipped (walk-up programs never create requests).
 */
export const showSetupChecklist = (f: SetupFacts): boolean =>
  !f.hasRecap && !setupProgress(buildSetupSteps(f)).complete;

export const setupDismissKey = (tenantId: string): string =>
  `@spark.setupChecklist.dismissed/${tenantId}`;
