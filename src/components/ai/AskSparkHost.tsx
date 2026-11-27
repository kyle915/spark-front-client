import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ASK_SPARK_EVENT, type OpenAskSparkDetail } from "@/lib/askSparkEvent";
import { askAiSubjectFromTenant } from "./askAiSubjectName";
import { routeAskSparkPrompts } from "./routeAskSparkPrompts";
import { LivePulseDot, SparkEmblem } from "./AskSparkPopoverFrame";
import BrandChatPanel from "./BrandChatPanel";
import { AskAiModal } from "./AskAiButton";

/**
 * Global bottom-right floating Ask Spark launcher + pop-up host inside the
 * authenticated layout shell. Available to BOTH Brand Clients and Ignite Admins
 * on every page, and triggered via the floating pill, ⌘J / Ctrl+J, Jump (⌘K),
 * the mobile dock, StoreSheet, or any contextual Ask Spark link.
 */
export default function AskSparkHost() {
  const location = useLocation();
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const { isClient, isAdmin } = useSparkRole();
  const handoffTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<{
    open: boolean;
    question?: string;
    overrideTenantId?: string;
    mode?: "data" | "help";
    requestKey: number;
  }>({ open: false, requestKey: 0 });

  const openPopup = useCallback((detail: OpenAskSparkDetail = {}) => {
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
        mode: detail.mode,
        requestKey: prev.requestKey + 1,
      }));
    };

    if (handoffTimerRef.current != null) {
      window.clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }

    // When handing off from an active/closing Vaul sheet (such as StoreSheet),
    // defer briefly so the prior sheet releases focus cleanly.
    if (otherDrawerClosing) {
      handoffTimerRef.current = window.setTimeout(openNow, 120);
    } else {
      openNow();
    }
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenAskSparkDetail>).detail ?? {};
      openPopup(detail);
    };
    window.addEventListener(ASK_SPARK_EVENT, onOpen);
    return () => {
      window.removeEventListener(ASK_SPARK_EVENT, onOpen);
      if (handoffTimerRef.current != null) {
        window.clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, [openPopup]);

  // Global ⌘J / Ctrl+J toggle for Ask Spark anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setState((prev) => {
          if (prev.open) return { ...prev, open: false };
          return {
            open: true,
            question: undefined,
            overrideTenantId: undefined,
            mode: undefined,
            requestKey: prev.requestKey + 1,
          };
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeTenantId = state.overrideTenantId || tenantId;
  const routePrompts = routeAskSparkPrompts(location.pathname, isClient);
  const close = useCallback(
    () => setState((prev) => ({ ...prev, open: false })),
    [],
  );

  // Lift launcher cleanly above the /chat message composer so it never blocks Send.
  const onChatPage = location.pathname === "/chat" || location.pathname.startsWith("/chat/");
  const launcherBottomClass = onChatPage ? "bottom-20" : "bottom-5";

  const canRenderPopup = Boolean(activeTenantId) || isAdmin;

  return (
    <>
      <AnimatePresence>
        {!state.open && canRenderPopup ? (
          <motion.button
            key="ask-spark-launcher"
            type="button"
            onClick={() => openPopup()}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            aria-label="Open Ask Spark (⌘J)"
            title="Ask Spark — program data & product help (⌘J)"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow:
                "0 14px 34px -10px rgba(15,18,12,0.34), 0 4px 12px -4px rgba(15,18,12,0.16), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
            className={`hidden md:inline-flex print:hidden fixed right-5 ${launcherBottomClass} z-40 items-center gap-2.5 pl-3.5 pr-3 h-11 rounded-full text-[13.5px] font-semibold tracking-tight cursor-pointer select-none`}
          >
            <span className="relative inline-flex items-center justify-center">
              <SparkEmblem size={15} />
              <span
                className="absolute -top-1 -right-1 rounded-full p-[1.5px]"
                style={{ background: "var(--spark-lime)" }}
              >
                <LivePulseDot />
              </span>
            </span>
            <span>Ask Spark</span>
            <kbd
              className="ml-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-mono font-medium leading-none"
              style={{
                background: "rgba(128,128,128,0.22)",
                color: "var(--spark-on-accent)",
                opacity: 0.85,
              }}
            >
              ⌘J
            </kbd>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {state.open && canRenderPopup ? (
          isClient && activeTenantId ? (
            <BrandChatPanel
              key={`client-${state.requestKey}`}
              tenantId={activeTenantId}
              initialQuestion={state.question}
              initialMode={state.mode}
              routePrompts={routePrompts}
              onClose={close}
            />
          ) : (
            <AskAiModal
              key={`admin-${state.requestKey}`}
              tenantId={activeTenantId || ""}
              tenantName={askAiSubjectFromTenant({
                name: null,
                requestUrlName: tenantMeta?.requestUrlName ?? tenantSlug,
              })}
              scope="tenant"
              initialQuestion={state.question}
              initialMode={state.mode ?? (activeTenantId ? "data" : "help")}
              routePrompts={routePrompts}
              onClose={close}
            />
          )
        ) : null}
      </AnimatePresence>
    </>
  );
}
