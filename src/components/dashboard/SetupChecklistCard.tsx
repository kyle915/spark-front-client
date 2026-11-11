import { useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Check } from "lucide-react";
import { SetupChecklistQuery } from "@/api/queries/SetupChecklistQuery";
import type { SetupChecklistQuery as QueryType } from "@api/queries/__generated__/SetupChecklistQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import {
  buildSetupSteps,
  setupDismissKey,
  setupProgress,
  showSetupChecklist,
} from "./setupSteps";

const readDismissed = (tenantId: string): boolean => {
  try {
    return localStorage.getItem(setupDismissKey(tenantId)) === "1";
  } catch {
    return false;
  }
};

const Body: React.FC<{ tenantId: string; onDismiss: () => void }> = ({
  tenantId,
  onDismiss,
}) => {
  const { user } = useAuthStore();
  const data = useLazyLoadQuery<QueryType>(
    SetupChecklistQuery,
    { tenantId, userUuid: user?.uuid ?? null },
    { fetchPolicy: "store-and-network" },
  );
  const any = (c: { edges: ReadonlyArray<unknown> } | null | undefined) =>
    (c?.edges?.length ?? 0) > 0;
  const tenant = (data.tenants?.edges ?? [])
    .map((e) => e?.node)
    .find(
      (n) => n && (String(n.id) === tenantId || String(n.uuid) === tenantId),
    );
  const facts = {
    hasProducts: any(data.setupProducts),
    hasRecapTemplate: any(data.setupTemplates),
    hasClientContact: any(data.setupClients),
    hasCheckinLink: Boolean((tenant?.checkinCode ?? "").trim()),
    hasEvent: any(data.setupRequests),
    hasRecap: any(data.setupRecaps),
  };
  if (!showSetupChecklist(facts)) return null;
  const steps = buildSetupSteps(facts);
  const progress = setupProgress(steps);
  const name = tenant?.name;

  return (
    <section className="spark-card p-5 mb-5" aria-label="Workspace setup">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold" style={{ letterSpacing: "-0.01em" }}>
            {name
              ? `Finish setting up ${name}`
              : "Finish setting up this client"}
          </h3>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            {progress.done} of {progress.total} done
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm underline shrink-0"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          Hide
        </button>
      </div>
      <div
        className="h-1 rounded-full mb-4 overflow-hidden"
        style={{ background: "var(--spark-border)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${(progress.done / progress.total) * 100}%`,
            background: "var(--spark-text)",
          }}
        />
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
              style={{
                border: "1px solid var(--spark-border)",
                background: s.done ? "var(--spark-text)" : "transparent",
                color: "var(--spark-bg)",
              }}
            >
              {s.done ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-semibold"
                style={
                  s.done
                    ? {
                        color: "var(--spark-text-meta)",
                        textDecoration: "line-through",
                      }
                    : undefined
                }
              >
                {s.label}
                <span className="sr-only">
                  {s.done ? " — done" : " — to do"}
                </span>
              </p>
              {!s.done ? (
                <p
                  className="text-xs"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {s.hint}
                </p>
              ) : null}
            </div>
            {!s.done && s.to ? (
              <Link to={s.to} className="text-sm underline shrink-0">
                {s.action}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
};

/**
 * Staff-only dashboard card listing what a new workspace still needs.
 * Disappears on its own once every step is done; "Hide" tucks it away for
 * this browser.
 */
const SetupChecklistCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const id = tenantId ? String(tenantId) : "";
  const [dismissed, setDismissed] = useState(() =>
    id ? readDismissed(id) : true,
  );
  if (!id || dismissed) return null;
  return (
    <Body
      tenantId={id}
      onDismiss={() => {
        try {
          localStorage.setItem(setupDismissKey(id), "1");
        } catch {
          /* private mode — hide for this visit only */
        }
        setDismissed(true);
      }}
    />
  );
};

export default SetupChecklistCard;
