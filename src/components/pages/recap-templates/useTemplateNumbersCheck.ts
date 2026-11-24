import { useState } from "react";
import { fetchQuery } from "react-relay";
import { useRelayEnvironment } from "react-relay/hooks";
import { RecapTemplateMetricPreviewQuery } from "@/api/queries/RecapTemplateMetricPreviewQuery";
import type { RecapTemplateMetricPreviewQuery as PreviewQueryType } from "@api/queries/__generated__/RecapTemplateMetricPreviewQuery.graphql";
import {
  METRIC_MAPPING_ANCHOR,
  previewNeedsAck,
  type TemplatePreview,
} from "@/lib/kpiExplain";

/**
 * The numbers check before a recap template goes live (create or edit).
 *
 * Asks the server what the DRAFT would count (recapTemplateMetricPreview):
 * standard numbers with no field, and number fields that read like a count
 * but that nothing would count. If either is true the page shows
 * <TemplateNumbersCheckPanel> and waits for an explicit "Save anyway" (or
 * "Save and review mapping"). Saving is never blocked, and if the check
 * cannot run the save goes ahead as it always did.
 */

export type DraftForCheck = { fieldId: string | null; name: string; fieldType: string | null };

export function useTemplateNumbersCheck() {
  const environment = useRelayEnvironment();
  const [guard, setGuard] = useState<TemplatePreview | null>(null);
  const [checking, setChecking] = useState(false);

  /** Runs the check; calls `save` straight away when there is nothing to say. */
  const check = (
    args: { templateId: string | null; productSamples: boolean; fields: DraftForCheck[] },
    save: () => void,
  ) => {
    setChecking(true);
    fetchQuery<PreviewQueryType>(
      environment,
      RecapTemplateMetricPreviewQuery,
      {
        templateId: args.templateId,
        productSamples: args.productSamples,
        fields: args.fields,
      },
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .then((resp) => {
        const preview = resp?.recapTemplateMetricPreview ?? null;
        if (previewNeedsAck(preview)) {
          setGuard(preview);
          return;
        }
        save();
      })
      .catch(() => save())
      .finally(() => setChecking(false));
  };

  return { guard, checking, check, clear: () => setGuard(null) };
}

/** Full load of the editor at the mapping card, after a save. */
export function openMappingReview(templateUuid: string) {
  window.location.assign(
    `/recap-templates/${encodeURIComponent(templateUuid)}/edit?review=mapping#${METRIC_MAPPING_ANCHOR}`,
  );
}
