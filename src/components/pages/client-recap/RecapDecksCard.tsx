import { useEffect, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@/api/relay/environment";
import {
  ClientRecapDeckPdfQuery,
  ClientRecapDecksQuery,
} from "@/api/queries/ClientRecapDraftQuery";
import type { ClientRecapDraftQueryDecksQuery as DecksQueryType } from "@api/queries/__generated__/ClientRecapDraftQueryDecksQuery.graphql";
import type { ClientRecapDraftQueryDeckPdfQuery as DeckPdfQueryType } from "@api/queries/__generated__/ClientRecapDraftQueryDeckPdfQuery.graphql";
import { useAlertStore } from "@/store/alertStore";
import { downloadPdf } from "./downloadPdf";

type Deck = DecksQueryType["response"]["clientRecapDecks"][number];

/**
 * Recap decks Ignite has shared with the brand (staff marked them ready),
 * with a download for each. Brand users only ever see their own brand's.
 * Renders nothing when there are none, so a brand without a deck sees no
 * empty box.
 */
const RecapDecksCard: React.FC<{ tenantId: string | null; staffView?: boolean }> = ({
  tenantId,
  staffView = false,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [decks, setDecks] = useState<readonly Deck[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    let live = true;
    fetchQuery<DecksQueryType>(environment, ClientRecapDecksQuery, { tenantId })
      .toPromise()
      .then((data) => {
        if (live) setDecks(data?.clientRecapDecks ?? []);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tenantId]);

  if (!tenantId || decks.length === 0) return null;

  const download = async (uuid: string) => {
    if (busy) return;
    setBusy(uuid);
    try {
      const data = await fetchQuery<DeckPdfQueryType>(
        environment,
        ClientRecapDeckPdfQuery,
        { uuid },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const pdf = data?.clientRecapDeckPdf;
      if (!pdf?.ok || !pdf.pdfBase64) {
        showAlert(pdf?.reason || "The deck could not be downloaded.", "error");
        return;
      }
      downloadPdf(pdf.pdfBase64, pdf.filename || "recap-deck.pdf");
    } catch {
      showAlert("The deck could not be downloaded. Try again.", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="spark-card p-5 sm:p-6 spark-scale" aria-label="Recap decks">
      <h2 className="text-sm font-semibold m-0" style={{ color: "var(--spark-text)" }}>
        Recap decks
      </h2>
      <p className="text-xs mt-1 mb-0" style={{ color: "var(--spark-text-meta)" }}>
        {staffView
          ? "Decks shared with this brand. Brand users see this same list."
          : "Campaign recaps from Ignite: headline numbers, where the program ran, what consumers said and photos from the field."}
      </p>
      <ul className="list-none p-0 m-0 mt-3">
        {decks.map((d) => (
          <li
            key={d.uuid}
            className="flex items-center justify-between gap-3 py-2.5"
            style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold m-0 truncate" style={{ color: "var(--spark-text)" }}>
                {d.title || "Recap deck"}
              </p>
              <p className="text-xs m-0" style={{ color: "var(--spark-text-meta)" }}>
                {d.period}
              </p>
            </div>
            <button
              type="button"
              className="spark-btn-ghost shrink-0"
              onClick={() => void download(d.uuid)}
              disabled={Boolean(busy)}
            >
              {busy === d.uuid ? "Preparing…" : "Download PDF"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecapDecksCard;
