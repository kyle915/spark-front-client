import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ASK_SPARK_EVENT, type OpenAskSparkDetail } from "@/lib/askSparkEvent";
import { askAiSubjectFromTenant } from "./askAiSubjectName";
import { routeAskSparkPrompts } from "./routeAskSparkPrompts";
import { SparkEmblem } from "./AskSparkPopoverFrame";

// Lazy-load the heavy Ask Spark chat panels (react-markdown, remark/rehype,
// Chart.js via AiChartView) so they stay out of the root App bundle until
// the user hovers or opens Ask Spark.
const loadBrandChatPanel = () => import("./BrandChatPanel");
const loadAskAiModal = () =>
  import("./AskAiButton").then((mod) => ({ default: mod.AskAiModal }));

const BrandChatPanel = lazy(loadBrandChatPanel);
const AskAiModal = lazy(loadAskAiModal);

/**
 * Global bottom-right floating Ask Spark launcher + pop-up host inside the
 * authenticated layout shell. Available to BOTH Brand Clients and Ignite Admins
 * on every page, and triggered via the floating pill, ⌘J / Ctrl+J, Jump (⌘K),
 * the mobile dock, StoreSheet, or any contextual Ask Spark link.
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

  const warmPopup = useCallback(() => {
    void (isClient ? loadBrandChatPanel() : loadAskAiModal()).catch(() => {});
  }, [isClient]);

  const openPopup = useCallback(
    (detail: OpenAskSparkDetail = {}) => {
      warmPopup();
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
      // defer briefly so the prior sheet releases focus cleanly.
      if (otherDrawerClosing) {
        handoffTimerRef.current = window.setTimeout(openNow, 120);
      } else {
        openNow();
      }
    },
    [warmPopup],
  );

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
        warmPopup();
        setState((prev) => {
          if (prev.open) return { ...prev, open: false };
          return {
            open: true,
            question: undefined,
            overrideTenantId: undefined,
            requestKey: prev.requestKey + 1,
          };
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [warmPopup]);

  const activeTenantId = state.overrideTenantId || tenantId;
  const routePrompts = routeAskSparkPrompts(location.pathname, isClient);
  const close = useCallback(
    () => setState((prev) => ({ ...prev, open: false })),
    [],
  );

  // Lift launcher cleanly above the /chat message composer so it never blocks Send.
  const onChatPage = location.pathname === "/chat" || location.pathname.startsWith("/chat/");
  const launcherBottomClass = onChatPage ? "bottom-20" : "bottom-6";

  const canRenderPopup = Boolean(activeTenantId);

  return (
    <>
      <AnimatePresence>
        {!state.open && canRenderPopup ? (
          <motion.button
            key="ask-spark-launcher"
            type="button"
            onMouseEnter={warmPopup}
            onFocus={warmPopup}
            onClick={() => openPopup()}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            whileHover={{ y: -2, scale: 1.015 }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            aria-label="Open Ask Spark (⌘J)"
            title="Ask Spark about your program (⌘J)"
            style={{
              background: "color-mix(in srgb, var(--spark-surface) 94%, transparent)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              boxShadow:
                "0 12px 30px -8px rgba(20,22,15,0.16), 0 2px 8px -2px rgba(20,22,15,0.07), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
            className={`group hidden md:inline-flex print:hidden fixed right-6 ${launcherBottomClass} z-40 items-center gap-2.5 pl-1.5 pr-3 h-11 rounded-full text-[13.5px] font-semibold tracking-[-0.015em] cursor-pointer select-none transition-colors`}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-105"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <SparkEmblem size={15} />
            </span>
            <span className="leading-none">Ask Spark</span>
            <kbd
              className="inline-flex items-center rounded-md px-1.5 py-[3px] text-[10.5px] font-mono font-medium leading-none tracking-tight"
              style={{
                background: "var(--spark-surface-2)",
                color: "var(--spark-text-meta)",
                border: "1px solid var(--spark-border)",
                boxShadow: "0 1px 0 rgba(20,22,15,0.05)",
              }}
            >
              ⌘J
            </kbd>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>
          {state.open && activeTenantId ? (
            isClient ? (
              <BrandChatPanel
                key={`client-${state.requestKey}`}
                tenantId={activeTenantId}
                initialQuestion={state.question}
                routePrompts={routePrompts}
                onClose={close}
              />
            ) : (
              <AskAiModal
                key={`admin-${state.requestKey}`}
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
            )
          ) : null}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
