import type { GraphQLResponse, IEnvironment, RequestParameters } from "relay-runtime";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";
import { useAuthStore } from "@/store/authStore";

/**
 * Keep the counts on screen in step with what just happened.
 *
 * Sidebar badges, tab counts and the dashboard's "Needs you" tiles all read
 * one set of server counts. They used to be re-read only by the few screens
 * that remembered to ask, so approving a walk-up left "3" on the tab and in
 * the sidebar until someone reloaded the page. Now every successful change
 * (any mutation) re-reads them, and so does coming back to the tab — which
 * also picks up what a colleague did in the meantime.
 */

const AFTER_ACTION_MS = 400;
const HEARTBEAT_MS = 90_000;

/** True when `response` is a mutation that went through. */
export function isSettledMutation(
  params: Pick<RequestParameters, "operationKind">,
  response: GraphQLResponse | null | undefined,
): boolean {
  if (params.operationKind !== "mutation" || !response) return false;
  const errors = (response as { errors?: unknown }).errors;
  return !(Array.isArray(errors) && errors.length > 0);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Re-read the counts shortly; several changes in a burst become one read. */
export function scheduleCountsRefresh(
  environment: IEnvironment,
  delayMs: number = AFTER_ACTION_MS,
): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const { token, tenantId } = useAuthStore.getState();
    if (!token) return; // signed out: nothing to count
    void refreshSidebarCounts(environment, tenantId);
  }, delayMs);
}

let started = false;

/**
 * Re-read when the tab is looked at again, and every 90 seconds while it
 * stays in view. A hidden tab does nothing.
 */
export function startCountsHeartbeat(environment: IEnvironment): void {
  if (started || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  started = true;
  const visible = () => document.visibilityState === "visible";
  document.addEventListener("visibilitychange", () => {
    if (visible()) scheduleCountsRefresh(environment, 0);
  });
  window.addEventListener("focus", () => scheduleCountsRefresh(environment, 0));
  window.setInterval(() => {
    if (visible()) scheduleCountsRefresh(environment, 0);
  }, HEARTBEAT_MS);
}

/** For tests. */
export const __resetCountsRefresh = (): void => {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
};
