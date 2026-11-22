import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Link } from "react-router";
import { PitchDeckQueriesBuyerPitchDecksQuery } from "@/api/queries/PitchDeckQueries";
import type { PitchDeckQueriesBuyerPitchDecksQuery as DecksQueryType } from "@/api/queries/__generated__/PitchDeckQueriesBuyerPitchDecksQuery.graphql";
import {
  PitchDeckMutationsCreateDeckMutation,
  PitchDeckMutationsRevokeDeckMutation,
} from "@/api/mutations/PitchDeckMutations";
import type { PitchDeckMutationsCreateDeckMutation as CreateDeckType } from "@/api/mutations/__generated__/PitchDeckMutationsCreateDeckMutation.graphql";
import type { PitchDeckMutationsRevokeDeckMutation as RevokeDeckType } from "@/api/mutations/__generated__/PitchDeckMutationsRevokeDeckMutation.graphql";
import { pitchPublicUrl } from "@/utils/publicHosts";

const META = { color: "var(--spark-text-meta)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;

type Props = {
  retailerFilter: string;
  marketFilter: string;
  providerUuid: string;
};

const DecksList: React.FC<{
  retailerFilter: string;
  marketFilter: string;
  providerUuid: string;
  fetchKey: number;
  bump: () => void;
}> = ({ retailerFilter, marketFilter, providerUuid, fetchKey, bump }) => {
  const data = useLazyLoadQuery<DecksQueryType>(
    PitchDeckQueriesBuyerPitchDecksQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const [commitCreate, creating] = useMutation<CreateDeckType>(
    PitchDeckMutationsCreateDeckMutation,
  );
  const [commitRevoke, revoking] = useMutation<RevokeDeckType>(
    PitchDeckMutationsRevokeDeckMutation,
  );

  const [title, setTitle] = useState("Buyer Pitch Deck");
  const [buyerName, setBuyerName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [includeCosts, setIncludeCosts] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [banner, setBanner] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const createDeck = () => {
    const daysRaw = expiresInDays.trim();
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : null;
    commitCreate({
      variables: {
        title: title.trim() || "Buyer Pitch Deck",
        subtitle: "",
        buyerName: buyerName.trim() || null,
        introNote: null,
        periodStart: null,
        periodEnd: null,
        retailerFilter: retailerFilter || null,
        marketFilter: marketFilter || null,
        providerUuid: providerUuid || null,
        includeCosts,
        passcode: passcode.trim() || null,
        expiresInDays: Number.isFinite(days) ? days : null,
        pinnedPhotoIds: null,
      },
      onCompleted: (res) => {
        const out = res.createBuyerPitchDeck;
        if (!out?.ok || !out.deck) {
          setBanner(out?.error || "Could not create pitch deck.");
          return;
        }
        const url = pitchPublicUrl(out.deck.token);
        setLastLink(url);
        setBanner(`Deck ready — share this link with the buyer.`);
        bump();
      },
      onError: () => setBanner("Could not create pitch deck."),
    });
  };

  const revoke = (deckUuid: string) => {
    commitRevoke({
      variables: { deckUuid },
      onCompleted: (res) => {
        if (!res.revokeBuyerPitchDeck?.ok) {
          setBanner(res.revokeBuyerPitchDeck?.error || "Could not revoke.");
          return;
        }
        setBanner("Pitch deck link revoked.");
        bump();
      },
      onError: () => setBanner("Could not revoke."),
    });
  };

  const copyLink = async (token: string) => {
    const url = pitchPublicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setBanner("Link copied.");
      setLastLink(url);
    } catch {
      setLastLink(url);
      setBanner("Copy failed — link shown below.");
    }
  };

  return (
    <section
      className="spark-card p-4 space-y-4"
      style={{ border: "1px solid var(--spark-border)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">1-Click Buyer Pitch Deck</h2>
          <p className="text-xs mt-0.5" style={META}>
            Snapshot this buyer-report window into a shareable{" "}
            <code className="mono">/pitch</code> link. Pin photos on the{" "}
            <Link to="/photo-wall" className="underline underline-offset-2">
              Live Photo Wall
            </Link>{" "}
            first.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deck title"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="Buyer name (optional)"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Optional passcode (4+ chars)"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
        <input
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          placeholder="Expires in days (e.g. 30)"
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        />
      </div>

      <label className="flex items-center gap-2 text-xs" style={META}>
        <input
          type="checkbox"
          checked={includeCosts}
          onChange={(e) => setIncludeCosts(e.target.checked)}
        />
        Include cost-per-unit / supported spend (off by default)
      </label>

      <button
        type="button"
        disabled={creating}
        onClick={createDeck}
        className="px-4 py-2 rounded-xl text-xs font-bold"
        style={PRIMARY_BTN_STYLE}
      >
        {creating ? "Building…" : "Build & share Buyer Pitch Deck"}
      </button>

      {banner && (
        <p className="text-xs" style={META}>
          {banner}
        </p>
      )}
      {lastLink && (
        <p className="text-xs break-all mono" style={META}>
          {lastLink}
        </p>
      )}

      <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--spark-border)" }}>
        <p className="text-[11px] uppercase tracking-wider" style={META}>
          Recent decks
        </p>
        {(data.buyerPitchDecks ?? []).length === 0 && (
          <p className="text-xs" style={META}>
            No decks yet for this brand.
          </p>
        )}
        {(data.buyerPitchDecks ?? []).map((deck) => (
          <div
            key={deck.uuid}
            className="flex flex-wrap items-center justify-between gap-2 text-xs py-2"
          >
            <div>
              <p className="font-semibold">
                {deck.title}
                {deck.buyerName ? ` · ${deck.buyerName}` : ""}
              </p>
              <p style={META}>
                {deck.periodStart} → {deck.periodEnd}
                {deck.revokedAt
                  ? " · revoked"
                  : deck.hasPasscode
                    ? " · passcode"
                    : ""}
                {" · "}
                {deck.photoCount} photos · {deck.viewCount} views
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!deck.revokedAt && (
                <>
                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-lg"
                    style={FIELD_STYLE}
                    onClick={() => void copyLink(deck.token)}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    disabled={revoking}
                    className="px-2.5 py-1.5 rounded-lg"
                    style={FIELD_STYLE}
                    onClick={() => revoke(deck.uuid)}
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export const BuyerPitchDeckShareCard: React.FC<Props> = ({
  retailerFilter,
  marketFilter,
  providerUuid,
}) => {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <Suspense
      fallback={
        <p className="text-xs" style={META}>
          Loading pitch decks…
        </p>
      }
    >
      <DecksList
        retailerFilter={retailerFilter}
        marketFilter={marketFilter}
        providerUuid={providerUuid}
        fetchKey={fetchKey}
        bump={() => setFetchKey((k) => k + 1)}
      />
    </Suspense>
  );
};

export default BuyerPitchDeckShareCard;
