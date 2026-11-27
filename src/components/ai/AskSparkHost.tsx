import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ASK_SPARK_EVENT, type OpenAskSparkDetail } from "@/lib/askSparkEvent";
import { askAiSubjectFromTenant } from "./askAiSubjectName";
import { routeAskSparkPrompts } from "./routeAskSparkPrompts";
import BrandChatPanel from "./BrandChatPanel";
import { AskAiModal } from "./AskAiButton";

/**
 * Global docked Ask Spark drawer host inside the authenticated layout shell.
 * Lets Jump (⌘K), the mobile dock, or any screen open Ask Spark with a
 * pre-populated question or route-aware starter prompts without losing context.
 */
export default function AskSparkHost() {
  const location = useLocation();
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const { isClient } = useSparkRole();
  const handoffTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<{
    open: boolean;
    question?: string;
    overrideTenantId?: string;
    requestKey: number;
  }>({ open: false, requestKey: 0 });

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenAskSparkDetail>).detail ?? {};
      const storeSheetOpen = Boolean(useStoreSheetStore.getState().target);
      if (storeSheetOpen) {
        useStoreSheetStore.getState().closeStoreSheet();
      }
      const otherDrawerClosing =
        storeSheetOpen ||
        (typeof document !== "undefined" &&
          Boolean(document.querySelector("[data-vaul-drawer]")));

      const openNow = () => {
        handoffTimerRef.current = null;
        setState((prev) => ({
          open: true,
          question: detail.question,
          overrideTenantId: detail.tenantId,
          requestKey: prev.requestKey + 1,
        }));
      };

      if (handoffTimerRef.current != null) {
        window.clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }

      // When handing off from an active/closing Vaul sheet (such as StoreSheet),
      // defer mounting the new drawer briefly so the prior sheet releases its
      // Radix modal focus scope cleanly without dismissing Ask Spark.
      if (otherDrawerClosing) {
        handoffTimerRef.current = window.setTimeout(openNow, 120);
      } else {
        openNow();
      }
    };
    window.addEventListener(ASK_SPARK_EVENT, onOpen);
    return () => {
      window.removeEventListener(ASK_SPARK_EVENT, onOpen);
      if (handoffTimerRef.current != null) {
        window.clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, []);

  const activeTenantId = state.overrideTenantId || tenantId;
  if (!state.open || !activeTenantId) return null;

  const routePrompts = routeAskSparkPrompts(location.pathname, isClient);
  const close = () => setState((prev) => ({ ...prev, open: false }));

  if (isClient) {
    return (
      <BrandChatPanel
        key={state.requestKey}
        tenantId={activeTenantId}
        initialQuestion={state.question}
        routePrompts={routePrompts}
        onClose={close}
      />
    );
  }

  return (
    <AskAiModal
      key={state.requestKey}
      tenantId={activeTenantId}
      tenantName={askAiSubjectFromTenant({
        name: null,
        requestUrlName: tenantMeta?.requestUrlName ?? tenantSlug,
      })}
      scope="tenant"
      initialQuestion={state.question}
      routePrompts={routePrompts}
      onClose={close}
    />
  );
}
