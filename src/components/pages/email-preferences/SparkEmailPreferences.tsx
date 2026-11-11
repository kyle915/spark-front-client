import { Suspense, useEffect, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { MyNotificationPreferencesQuery } from "@/api/queries/MyNotificationPreferencesQuery";
import type { MyNotificationPreferencesQuery as QueryType } from "@api/queries/__generated__/MyNotificationPreferencesQuery.graphql";
import { SetMyNotificationPreferenceMutation } from "@/api/mutations/SetMyNotificationPreferenceMutation";
import type { SetMyNotificationPreferenceMutation as MutationType } from "@api/mutations/__generated__/SetMyNotificationPreferenceMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { applyEmailPref, emailPrefsSummary, type EmailPref } from "./emailPrefs";

const List: React.FC = () => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<QueryType>(
    MyNotificationPreferencesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );
  const [prefs, setPrefs] = useState<EmailPref[]>(() => [
    ...data.myNotificationPreferences,
  ]);
  useEffect(() => {
    setPrefs([...data.myNotificationPreferences]);
  }, [data.myNotificationPreferences]);
  const [commit] = useMutation<MutationType>(SetMyNotificationPreferenceMutation);
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = (p: EmailPref) => {
    if (saving) return;
    const next = !p.emailEnabled;
    setSaving(p.category);
    setPrefs((cur) => applyEmailPref(cur, p.category, next));
    const revert = (message: string) => {
      setPrefs((cur) => applyEmailPref(cur, p.category, p.emailEnabled));
      showAlert(message, "error");
    };
    commit({
      variables: { input: { category: p.category, emailEnabled: next } },
      onCompleted: (res) => {
        setSaving(null);
        const r = res.setMyNotificationPreference;
        if (r?.success) {
          setPrefs((cur) => applyEmailPref(cur, r.category, r.emailEnabled));
          showAlert(r.message, "success");
        } else {
          revert(r?.message || "Couldn't save that. Try again.");
        }
      },
      onError: () => {
        setSaving(null);
        revert("Couldn't save that. Try again.");
      },
    });
  };

  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--spark-text-meta)" }}>
        {emailPrefsSummary(prefs)}
      </p>
      <ul className="spark-card divide-y" style={{ borderColor: "var(--spark-border)" }}>
        {prefs.map((p) => (
          <li
            key={p.category}
            className="flex items-center justify-between gap-4 p-4"
            style={{ borderColor: "var(--spark-border)" }}
          >
            <label htmlFor={`pref-${p.category}`} className="min-w-0 cursor-pointer">
              <span className="block text-sm font-semibold">{p.label}</span>
              <span
                className="block text-xs"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {p.description}
              </span>
            </label>
            <input
              id={`pref-${p.category}`}
              type="checkbox"
              role="switch"
              checked={p.emailEnabled}
              onChange={() => toggle(p)}
              disabled={saving !== null}
              className="w-5 h-5 shrink-0"
              style={{ accentColor: "var(--spark-lime)" }}
            />
          </li>
        ))}
      </ul>
    </>
  );
};

/**
 * A person's own email choices. Opt-out: everything is on until switched
 * off, and a change only affects the signed-in person. Needs
 * myNotificationPreferences on the server (spark-api #1355).
 */
const SparkEmailPreferences: React.FC = () => {
  const email = useAuthStore((s) => s.user?.email);
  return (
    <Layout>
      <div className="max-w-2xl">
        <SparkPageHeader
          title="Email preferences"
          eyebrow="ACCOUNT"
          support={
            email
              ? `Choose which emails Spark sends to ${email}. Changes apply only to you.`
              : "Choose which emails Spark sends you. Changes apply only to you."
          }
        />
        <Suspense
          fallback={
            <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
              Loading your preferences…
            </p>
          }
        >
          <List />
        </Suspense>
        <p className="text-xs mt-4" style={{ color: "var(--spark-text-meta)" }}>
          Sign-in, password, invitation and shift emails are always sent.
        </p>
      </div>
    </Layout>
  );
};

export default SparkEmailPreferences;
