import { create } from "zustand";

/**
 * Server-side Terms gate (spark-api legal/graphql_extension.py).
 *
 * An admin or brand user who hasn't accepted the current Terms gets this
 * code on every data call until they do. The network layer flags it here and
 * <LegalGate> shows the clickwrap, so the gate appears no matter which query
 * hit it first.
 */
export const LEGAL_ACCEPTANCE_REQUIRED = "LEGAL_ACCEPTANCE_REQUIRED";

type GraphQLErrorLike = {
  message?: string;
  extensions?: { code?: unknown; version?: unknown } | null;
};

/** The required version if this GraphQL response is the Terms gate, else null. */
export function legalGateVersion(result: unknown): string | null | undefined {
  const errors = (result as { errors?: GraphQLErrorLike[] } | null)?.errors;
  if (!Array.isArray(errors)) return undefined;
  for (const error of errors) {
    if (error?.extensions?.code === LEGAL_ACCEPTANCE_REQUIRED) {
      const version = error.extensions.version;
      return typeof version === "string" ? version : null;
    }
  }
  return undefined;
}

interface LegalGateState {
  /** True once the server said this person must accept. */
  required: boolean;
  /** Version the server asked for, when it said. */
  version: string | null;
  markRequired: (version: string | null) => void;
  clear: () => void;
}

export const useLegalGateStore = create<LegalGateState>((set) => ({
  required: false,
  version: null,
  markRequired: (version) => set({ required: true, version }),
  clear: () => set({ required: false, version: null }),
}));

/** Call with every GraphQL response; flags the gate when the server asks. */
export function noteLegalGate(result: unknown): void {
  const version = legalGateVersion(result);
  if (version === undefined) return;
  const state = useLegalGateStore.getState();
  if (!state.required || state.version !== version) state.markRequired(version);
}
