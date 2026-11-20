import { Component, Suspense, useState, type ReactNode } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery } from "react-relay/hooks";
import type {
  RecapReceiptsPanelQuery as QueryType,
  RecapReceiptsPanelQuery$data,
} from "./__generated__/RecapReceiptsPanelQuery.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { RecapFlagItem } from "./RecapFlagItem";
import {
  confidenceLabel,
  formatMoney,
  readingStatusLabel,
  receiptDateLabel,
  receiptTimeLabel,
  sortFlags,
  storeLine,
} from "./receiptChecks";

/**
 * Staff-only Receipts panel on a custom recap: what Spark read off each
 * receipt photo (store, ticket, time, total, lines), the spend it adds up
 * to (each receipt counted once), and the fraud / quality flags with a
 * resolve action. The server returns null for anyone but Ignite staff, and
 * this panel is never mounted in client view.
 */
const Query = graphql`
  query RecapReceiptsPanelQuery($recapId: ID!) {
    recapReceiptAudit(recapId: $recapId) {
      waitingCount
      flagsEnabled
      totals {
        product
        other
        unitemized
        fees
        tax
        total
        receipts
      }
      readings {
        id
        fileId
        fileUrl
        status
        merchant
        storeNumber
        address
        city
        stateCode
        ticketNumber
        register
        receiptDate
        purchaseTime
        subtotal
        fees
        tax
        total
        cardLast4
        confidence
        arithmeticOk
        arithmeticNote
        model
        readAt
        error
        countedHere
        alsoOnRecapUuids
        lineItems {
          name
          qty
          unitPrice
          amount
          isBrand
        }
      }
      flags {
        id
        recapUuid
        kind
        kindLabel
        severity
        explanation
        otherRecapUuid
        createdAt
        resolvedAt
        resolvedByName
        resolutionNote
        autoCleared
      }
    }
  }
`;

type Audit = NonNullable<RecapReceiptsPanelQuery$data["recapReceiptAudit"]>;
type Reading = Audit["readings"][number];

const meta = { color: "var(--spark-text-meta)" } as const;

const ReadingRow: React.FC<{ r: Reading }> = ({ r }) => {
  const [showLines, setShowLines] = useState(false);
  const when = [receiptDateLabel(r.receiptDate), receiptTimeLabel(r.purchaseTime)]
    .filter(Boolean)
    .join(" · ");
  const facts = [
    r.ticketNumber ? `Ticket ${r.ticketNumber}` : "",
    r.register ? `Register ${r.register}` : "",
    when,
    r.cardLast4 ? `Card ending ${r.cardLast4}` : "",
  ].filter(Boolean);
  const readable = r.status === "read" || r.status === "unreadable";
  return (
    <li className="py-3 flex gap-3" style={{ borderTop: "1px solid var(--spark-hairline)" }}>
      {r.fileUrl ? (
        <a href={r.fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={r.fileUrl}
            alt="Receipt photo"
            loading="lazy"
            className="w-14 h-20 object-cover rounded-md"
            style={{ border: "1px solid var(--spark-border)" }}
          />
        </a>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-[14px] font-semibold">
            {readable ? storeLine(r) : readingStatusLabel(r.status)}
          </p>
          <p className="text-[14px] font-semibold tabular-nums">{formatMoney(r.total)}</p>
        </div>
        {readable ? (
          <p className="text-[13px]" style={meta}>
            {facts.join(" · ") || "No ticket details printed"}
          </p>
        ) : (
          <p className="text-[13px]" style={meta}>
            {r.error || (r.status === "pending" ? "Spark reads new receipts every few minutes." : "")}
          </p>
        )}
        {readable ? (
          <p className="text-[13px] mt-0.5" style={meta}>
            {[
              r.status === "unreadable" ? "No total on this photo" : "",
              r.subtotal ? `Subtotal ${formatMoney(r.subtotal)}` : "",
              r.fees && Number(r.fees) !== 0 ? `Fees ${formatMoney(r.fees)}` : "",
              r.tax ? `Tax ${formatMoney(r.tax)}` : "",
              confidenceLabel(r.confidence),
              r.countedHere
                ? ""
                : r.alsoOnRecapUuids.length > 0
                  ? "Counted on another recap"
                  : r.status === "read"
                    ? "Counted with another photo of the same receipt"
                    : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {r.arithmeticOk === false && r.arithmeticNote ? (
          <p className="text-[13px] mt-0.5" style={{ color: "var(--spark-flag-ink, #ffb59d)" }}>
            {r.arithmeticNote}
          </p>
        ) : null}
        {r.lineItems.length > 0 ? (
          <>
            <button
              type="button"
              className="text-[13px] underline mt-1"
              aria-expanded={showLines}
              onClick={() => setShowLines((v) => !v)}
            >
              {showLines ? "Hide lines" : `Show ${r.lineItems.length} lines`}
            </button>
            {showLines ? (
              <table className="w-full text-[13px] mt-1.5">
                <tbody>
                  {r.lineItems.map((item, i) => (
                    <tr key={`${r.id}-${i}`}>
                      <td className="py-0.5 pr-2">
                        {item.name}
                        {item.isBrand ? (
                          <span className="ml-1.5" style={meta}>
                            brand
                          </span>
                        ) : null}
                      </td>
                      <td className="py-0.5 pr-2 text-right tabular-nums" style={meta}>
                        {item.qty != null ? `${item.qty} ×` : ""}{" "}
                        {item.unitPrice ? formatMoney(item.unitPrice) : ""}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
};

const Body: React.FC<{ recapId: string }> = ({ recapId }) => {
  const data = useLazyLoadQuery<QueryType>(
    Query,
    { recapId },
    { fetchPolicy: "store-and-network" },
  );
  const audit = data.recapReceiptAudit;
  if (!audit) return null;
  const { readings, totals, waitingCount, flagsEnabled } = audit;
  const flags = sortFlags(audit.flags);
  if (readings.length === 0 && flags.length === 0 && waitingCount === 0) return null;
  const openFlags = flags.filter((f) => !f.resolvedAt).length;
  return (
    <section
      className="rounded-2xl px-4 py-3 mt-3"
      style={{ background: "var(--spark-bg)", border: "1px solid var(--spark-border)" }}
      aria-label="Receipts and staff checks"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-[15px] font-semibold">Receipts</h3>
        <span className="text-[12px]" style={meta}>
          Staff only
        </span>
      </div>
      <p className="text-[13px] mt-0.5" style={meta}>
        {[
          totals.receipts > 0
            ? `${totals.receipts} receipt${totals.receipts === 1 ? "" : "s"} · ${formatMoney(totals.total)} spent`
            : "",
          Number(totals.product) > 0 ? `Brand product ${formatMoney(totals.product)}` : "",
          Number(totals.other) > 0 ? `Other items ${formatMoney(totals.other)}` : "",
          Number(totals.unitemized) > 0 ? `Unitemized ${formatMoney(totals.unitemized)}` : "",
          Number(totals.fees) > 0 ? `Fees ${formatMoney(totals.fees)}` : "",
          Number(totals.tax) > 0 ? `Tax ${formatMoney(totals.tax)}` : "",
          waitingCount > 0 ? `${waitingCount} waiting to be read` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {flags.length > 0 ? (
        <div className="mt-2">
          <p className="text-[13px] font-semibold">
            {openFlags > 0 ? `${openFlags} flag${openFlags === 1 ? "" : "s"} to look at` : "No open flags"}
          </p>
          <ul className="list-none p-0 m-0">
            {flags.map((f) => (
              <RecapFlagItem key={f.id} flag={f} />
            ))}
          </ul>
        </div>
      ) : !flagsEnabled ? (
        <p className="text-[13px] mt-2" style={meta}>
          Fraud checks are not switched on yet.
        </p>
      ) : null}

      {readings.length > 0 ? (
        <ul className="list-none p-0 m-0 mt-2">
          {readings.map((r) => (
            <ReadingRow key={r.id} r={r} />
          ))}
        </ul>
      ) : null}
    </section>
  );
};

/** A staff aid must never take the recap page down with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const RecapReceiptsPanel: React.FC<{ recapId: string }> = ({ recapId }) => {
  const { isAdmin } = useSparkRole();
  if (!isAdmin) return null;
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Body recapId={recapId} />
      </Suspense>
    </Quiet>
  );
};

export default RecapReceiptsPanel;
