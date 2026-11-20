import { useId } from "react";
import { SparkMark } from "@/recap/SparkMark";
import { CHECKBOX_LABEL, DOCUMENT_ORDER, formatLegalVersion } from "./clickwrapCopy";
import "./legalGate.css";

export type ClickwrapDocument = {
  document: string;
  title: string;
  path: string;
  version: string;
};

export type LegalClickwrapProps = {
  documents: readonly ClickwrapDocument[];
  /** "2026-11-17" — shown as the effective date. */
  version: string;
  /** They accepted an earlier version: this is a re-prompt. */
  isUpdate: boolean;
  changeSummary: string | null;
  agreed: boolean;
  submitting: boolean;
  error: string | null;
  onAgreeChange: (agreed: boolean) => void;
  onContinue: () => void;
  onSignOut: () => void;
  /** The page is in dark mode (the Spark mark inverts on dark). */
  dark?: boolean;
};

/**
 * Full-screen clickwrap shown after sign-in until the person accepts the
 * current Terms. Presentational: <LegalGate> owns the state and the calls.
 */
export function LegalClickwrap({
  documents,
  version,
  isUpdate,
  changeSummary,
  agreed,
  submitting,
  error,
  onAgreeChange,
  onContinue,
  onSignOut,
  dark = false,
}: LegalClickwrapProps) {
  const checkboxId = useId();
  const titleId = useId();
  const docs = [...documents].sort(
    (a, b) => DOCUMENT_ORDER.indexOf(a.document) - DOCUMENT_ORDER.indexOf(b.document)
  );
  const effective = formatLegalVersion(version);

  return (
    <div className="legal-gate" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="legal-gate-card">
        <span className="legal-gate-mark" aria-hidden="true">
          <SparkMark height={40} onDark={dark} />
        </span>

        <h1 id={titleId} className="legal-gate-title">
          {isUpdate ? "We've updated our terms" : "Before you continue"}
        </h1>

        <p className="legal-gate-lede">
          {isUpdate
            ? `Our terms changed on ${effective}. Please review and accept them to keep using Spark.`
            : "Spark is run by Ignite Productions. Please review and accept our terms to use it."}
        </p>

        {isUpdate && changeSummary ? (
          <p className="legal-gate-changed">
            <span className="legal-gate-changed-label">What changed:</span> {changeSummary}
          </p>
        ) : null}

        <ul className="legal-gate-summary">
          <li>
            The Terms of Service cover how you and your team may use Spark, who owns
            content and data, confidentiality, and how the service can end.
          </li>
          <li>
            The Acceptable Use Policy lists what isn't allowed, such as sharing
            logins, scraping or misusing brand ambassador information.
          </li>
          <li>
            The Privacy Policy explains what we collect, including location and AI
            features, and how we protect it.
          </li>
        </ul>

        <ul className="legal-gate-links" aria-label="Legal documents">
          {docs.map((d) => (
            <li key={d.document}>
              <a href={d.path} target="_blank" rel="noopener noreferrer">
                {d.title}
                <span className="legal-gate-visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="legal-gate-effective">Effective {effective}</p>

        <div className="legal-gate-agree">
          <input
            id={checkboxId}
            type="checkbox"
            checked={agreed}
            disabled={submitting}
            onChange={(e) => onAgreeChange(e.target.checked)}
          />
          <label htmlFor={checkboxId}>{CHECKBOX_LABEL}</label>
        </div>

        {error ? (
          <p className="legal-gate-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="legal-gate-continue"
          disabled={!agreed || submitting}
          aria-disabled={!agreed || submitting}
          onClick={onContinue}
        >
          {submitting ? "Saving…" : "Continue"}
        </button>

        <button type="button" className="legal-gate-signout" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
