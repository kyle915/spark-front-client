import { useDeferredValue, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RecapBaRosterQuery } from "@/api/queries/RecapBaRosterQuery";
import type { RecapBaRosterQuery as RecapBaRosterQueryType } from "@/api/queries/__generated__/RecapBaRosterQuery.graphql";
import { CreateAmbassadorWithUserMutation } from "@/api/mutations/CreateAmbassadorWithUserMutation";
import type { CreateAmbassadorWithUserMutation as CreateAmbassadorWithUserMutationType } from "@/api/mutations/__generated__/CreateAmbassadorWithUserMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2";

/**
 * Type-ahead picker for the "filling for a BA" toggle.
 *
 * Lives in its own module so RecapCustomView can import it without
 * pulling the entire SparkRecapCreate chunk (templates, Connecteam
 * parse, product catalog, create mutations).
 *
 * Lists the ACTIVE tenant's BA roster via `chatRecipientAmbassadors`
 * (scoped by AmbassadorEvent history) — NOT activeAmbassadors/ambassadors,
 * which scope by TenantedUser membership and return nothing for BAs (they
 * join a brand through worked events, not a TenantedUser row).
 *
 * When nothing matches the typed text the picker still offers two ways
 * forward, so the admin is never stuck:
 *   • "Use '<name>'" — record a free-text external BA (externalBaName)
 *   • "+ Create BA '<name>'" — create the Ambassador in the active tenant
 */
export const AmbassadorPicker: React.FC<{
  tenantId: string | null;
  selectedId: string;
  selectedName: string;
  externalName: string;
  onSelect: (id: string, name: string) => void;
  onUseExternal: (name: string) => void;
  onClear: () => void;
}> = ({
  tenantId,
  selectedId,
  selectedName,
  externalName,
  onSelect,
  onUseExternal,
  onClear,
}) => {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [createBa, creatingInFlight] =
    useMutation<CreateAmbassadorWithUserMutationType>(
      CreateAmbassadorWithUserMutation,
    );

  const data = useLazyLoadQuery<RecapBaRosterQueryType>(
    RecapBaRosterQuery,
    { q: deferredQ || null, tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const matches = useMemo(
    () =>
      (data?.chatRecipientAmbassadors ?? []).filter(
        (r): r is NonNullable<typeof r> => Boolean(r),
      ),
    [data],
  );

  const typed = q.trim();

  const submitCreate = () => {
    const name = (creatingName ?? "").trim();
    const email = newEmail.trim();
    if (!name) return;
    if (!email) {
      showAlert("Enter an email to create this BA.", "warning");
      return;
    }
    const parts = name.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || null;
    createBa({
      variables: {
        input: {
          firstName,
          lastName,
          email,
          isActive: true,
        },
      },
      onCompleted: (res) => {
        const created = res.createAmbassadorWithUser;
        if (created?.success && created.ambassador?.id) {
          const u = created.ambassador.user;
          const display =
            [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
            u?.email ||
            name;
          onSelect(String(created.ambassador.id), display);
          setCreatingName(null);
          setNewEmail("");
          showAlert(`Created BA "${display}".`, "success");
        } else {
          showAlert(created?.message ?? "Couldn't create the BA.", "error");
        }
      },
      onError: (err) => showAlert(`Create BA failed: ${err.message}`, "error"),
    });
  };

  if ((selectedId && selectedName) || externalName.trim()) {
    const isExternal = !selectedId && Boolean(externalName.trim());
    return (
      <div
        className="rounded-xl p-3 flex items-center justify-between gap-3"
        style={{
          background: "var(--spark-surface-2)",
          border: "1px solid var(--spark-border)",
        }}
      >
        <div>
          <p className="display font-bold text-sm">
            {isExternal ? externalName.trim() : selectedName}
          </p>
          <p
            className="mono text-[10px] mt-0.5"
            style={{
              color: "var(--spark-text-meta)",
              letterSpacing: "0.12em",
            }}
          >
            {isExternal ? "EXTERNAL BA (NOT IN SPARK)" : "BA SELECTED"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="mono text-[10px] px-3 py-1.5 rounded-full"
          style={{
            letterSpacing: "0.18em",
            background: "rgba(var(--spark-ink-rgb),0.05)",
            border: "1px solid rgba(var(--spark-ink-rgb),0.1)",
          }}
        >
          CHANGE
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a BA's name or email…"
        className={inputCls}
      />
      <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
        {matches.length === 0 ? (
          typed ? (
            <div className="space-y-1.5">
              <p
                className="mono text-[10px] py-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-text-meta)",
                }}
              >
                NO MATCHES
              </p>
              <button
                type="button"
                onClick={() => onUseExternal(typed)}
                className="w-full text-left rounded-xl p-3"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <p className="text-sm font-semibold">Use “{typed}”</p>
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{
                    color: "var(--spark-text-meta)",
                    letterSpacing: "0.12em",
                  }}
                >
                  RECORD AS EXTERNAL BA
                </p>
              </button>
              {creatingName === typed ? (
                <div
                  className="rounded-xl p-3 space-y-2"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">Create “{typed}”</p>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="BA email (required)"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitCreate}
                      disabled={creatingInFlight}
                      className="mono text-[10px] px-3 py-1.5 rounded-full"
                      style={{
                        letterSpacing: "0.18em",
                        background: "rgba(var(--spark-ink-rgb),0.08)",
                        border: "1px solid rgba(var(--spark-ink-rgb),0.15)",
                        opacity: creatingInFlight ? 0.5 : 1,
                      }}
                    >
                      {creatingInFlight ? "CREATING…" : "CREATE & SELECT"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingName(null);
                        setNewEmail("");
                      }}
                      className="mono text-[10px] px-3 py-1.5 rounded-full"
                      style={{
                        letterSpacing: "0.18em",
                        background: "rgba(var(--spark-ink-rgb),0.05)",
                        border: "1px solid rgba(var(--spark-ink-rgb),0.1)",
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingName(typed);
                    setNewEmail("");
                  }}
                  className="w-full text-left rounded-xl p-3"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">+ Create BA “{typed}”</p>
                  <p
                    className="mono text-[10px] mt-0.5"
                    style={{
                      color: "var(--spark-text-meta)",
                      letterSpacing: "0.12em",
                    }}
                  >
                    ADD TO THIS TENANT (EMAIL REQUIRED)
                  </p>
                </button>
              )}
            </div>
          ) : (
            <p
              className="mono text-[10px] py-2"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              START TYPING TO SEARCH
            </p>
          )
        ) : (
          <>
            {matches.map((amb) => {
              const display = amb.name || amb.email || "(unnamed BA)";
              const id = String(amb.id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => onSelect(id, display)}
                  className="w-full text-left rounded-xl p-3"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">{display}</p>
                  {amb.name && amb.email && (
                    <p
                      className="mono text-[10px] mt-0.5"
                      style={{
                        color: "var(--spark-text-meta)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {amb.email}
                    </p>
                  )}
                </button>
              );
            })}
            {typed && (
              <button
                type="button"
                onClick={() => onUseExternal(typed)}
                className="w-full text-left rounded-xl p-3"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px dashed var(--spark-border)",
                }}
              >
                <p className="text-sm font-semibold">Use “{typed}” instead</p>
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{
                    color: "var(--spark-text-meta)",
                    letterSpacing: "0.12em",
                  }}
                >
                  RECORD AS EXTERNAL BA (NOT IN SPARK)
                </p>
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AmbassadorPicker;
