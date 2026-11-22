import { TallyProposal } from "./TallyPhotoCard";
import {
  advisoryKindTitle,
  type CombinedReceiptProposal,
  type ShownReceiptAdvisory,
} from "./receiptRead";

/**
 * Receipt spend suggestion chip rendered directly beneath `SpendAmountInput`.
 * Shares `<TallyProposal>` chrome so field reps get one consistent pattern for
 * numbers read off their photos.
 */
export function ReceiptSpendProposal({
  proposal,
  onUse,
  onDismiss,
}: {
  proposal: CombinedReceiptProposal;
  onUse: () => void;
  onDismiss: () => void;
}) {
  return (
    <TallyProposal
      heading="Read from your receipt"
      value={`$${proposal.proposedSpend}`}
      detail={proposal.detail}
      ariaLabel="Amount read from your receipt"
      dismissAriaLabel="Ignore receipt amount"
      onUse={onUse}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Polite, non-blocking pre-submit advisory banners shown beneath the receipt
 * photo bucket when OCR or SHA-256 checks spot a store mismatch, date mismatch,
 * or previously submitted receipt.
 */
export function ReceiptAdvisoryBanners({
  readingCount = 0,
  advisories,
  onDismiss,
}: {
  readingCount?: number;
  advisories: readonly ShownReceiptAdvisory[];
  onDismiss: (key: string) => void;
}) {
  if (readingCount <= 0 && advisories.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: -6,
      }}
    >
      {readingCount > 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.35,
            color: "#44403c",
          }}
        >
          {readingCount === 1
            ? "Reading receipt total…"
            : `Reading ${readingCount} receipts…`}
        </p>
      ) : null}
      {advisories.map((advisory) => (
        <div
          key={advisory.key}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #d97706",
            background: "#fffbeb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: "#78350f",
                lineHeight: 1.3,
              }}
            >
              {advisoryKindTitle(advisory.kind)}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 13,
                color: "#1c1917",
                lineHeight: 1.38,
              }}
            >
              {advisory.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(advisory.key)}
            aria-label={`Dismiss ${advisoryKindTitle(advisory.kind).toLowerCase()} note`}
            style={{
              minHeight: 44,
              flexShrink: 0,
              borderRadius: 10,
              border: "1px solid rgba(120, 53, 15, 0.3)",
              background: "#fff",
              color: "#1c1917",
              fontSize: 13,
              fontWeight: 700,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      ))}
    </div>
  );
}
