import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ASK_SPARK_EVENT, type OpenAskSparkDetail } from "@/lib/askSparkEvent";
import { askAiSubjectFromTenant } from "./askAiSubjectName";
import BrandChatPanel from "./BrandChatPanel";
import { AskAiModal } from "./AskAiButton";

/**
 * Global docked Ask Spark drawer host inside the authenticated layout shell.
 * Lets Jump (⌘K) or any screen open Ask Spark with a pre-populated question
 * without losing page context.
 */
export default function AskSparkHost() {
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const { isClient } = useSparkRole();
  const [state, setState] = useState<{
    open: boolean;
    question?: string;
    overrideTenantId?: string;
  }>({ open: false });

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenAskSparkDetail>).detail ?? {};
      setState({
        open: true,
        question: detail.question,
        overrideTenantId: detail.tenantId,
      });
    };
    window.addEventListener(ASK_SPARK_EVENT, onOpen);
    return () => window.removeEventListener(ASK_SPARK_EVENT, onOpen);
  }, []);

  const activeTenantId = state.overrideTenantId || tenantId;
  if (!state.open || !activeTenantId) return null;

  if (isClient) {
    return (
      <BrandChatPanel
        tenantId={activeTenantId}
        initialQuestion={state.question}
        onClose={() => setState({ open: false })}
      />
    );
  }

  return (
    <AskAiModal
      tenantId={activeTenantId}
      tenantName={askAiSubjectFromTenant({
        name: null,
        requestUrlName: tenantMeta?.requestUrlName ?? tenantSlug,
      })}
      scope="tenant"
      initialQuestion={state.question}
      onClose={() => setState({ open: false })}
    />
  );
}
