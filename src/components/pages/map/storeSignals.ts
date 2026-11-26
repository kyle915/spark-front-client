export interface StoreSignalRow {
  recapUuid: string;
  storeKey: string;
  storeName: string;
  address: string;
  city: string;
  stateCode: string;
  eventDate: string;
  stockoutRisk: string;
  reorderOpportunity: string;
  managerContact: string;
  managerNote: string;
  competitorBrand: string;
  competitorPromo: string;
  rmmEmail: string;
  distributorName: string;
}

export type StoreSignalFilterKind = "all" | "oos_reorder" | "promo";

export function isOosOrReorderSignal(row: StoreSignalRow): boolean {
  return Boolean(row.stockoutRisk.trim() || row.reorderOpportunity.trim());
}

export function matchesStoreSignal(
  store: { key: string; name: string; state?: string | null },
  signals: ReadonlyArray<StoreSignalRow>,
  onlyOosReorder = false,
): boolean {
  const normName = store.name.trim().toLowerCase();
  const normState = (store.state ?? "").trim().toUpperCase();
  return signals.some((sig) => {
    if (onlyOosReorder && !isOosOrReorderSignal(sig)) return false;
    if (sig.storeKey && sig.storeKey === store.key) return true;
    const sigName = sig.storeName.trim().toLowerCase();
    const sigState = sig.stateCode.trim().toUpperCase();
    return Boolean(sigName && sigName === normName && (!sigState || !normState || sigState === normState));
  });
}

export function buildStoreSignalMailto(
  sig: StoreSignalRow,
  brandName?: string | null,
): string {
  const place = [sig.city, sig.stateCode].filter(Boolean).join(", ");
  const headline =
    sig.stockoutRisk && sig.reorderOpportunity
      ? "Out-of-stock & reorder lead"
      : sig.reorderOpportunity
        ? "Buyer reorder lead"
        : sig.stockoutRisk
          ? "Low / out-of-stock alert"
          : sig.competitorPromo
            ? "Competitor promo intel"
            : "Store manager follow-up";

  const subject = `${brandName ? `${brandName} · ` : ""}${headline} — ${sig.storeName}${
    place ? ` (${place})` : ""
  }`;

  const lines: string[] = [
    `Hi${sig.rmmEmail ? " team" : ""},`,
    "",
    `Sharing a field signal captured during our recent demo at ${sig.storeName}:`,
    "",
    `• Store: ${sig.storeName}`,
  ];
  if (sig.address) lines.push(`• Address: ${sig.address}`);
  if (sig.distributorName) lines.push(`• Distributor: ${sig.distributorName}`);
  if (sig.eventDate) lines.push(`• Demo date: ${sig.eventDate}`);
  lines.push("");

  if (sig.stockoutRisk) {
    lines.push(`• Stock / shelf alert: ${sig.stockoutRisk}`);
  }
  if (sig.reorderOpportunity) {
    lines.push(`• Reorder opportunity: ${sig.reorderOpportunity}`);
  }
  if (sig.managerContact || sig.managerNote) {
    const mgr = [sig.managerContact, sig.managerNote].filter(Boolean).join(" — ");
    lines.push(`• Store contact: ${mgr}`);
  }
  if (sig.competitorPromo) {
    const comp = sig.competitorBrand
      ? `${sig.competitorBrand}: ${sig.competitorPromo}`
      : sig.competitorPromo;
    lines.push(`• Competitor promo: ${comp}`);
  }

  lines.push(
    "",
    "Can we coordinate replenishment / follow-up with the store buyer or distributor rep?",
    "",
    "Sent from Spark Field Intelligence",
  );

  const to = encodeURIComponent((sig.rmmEmail || "").trim());
  const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  return `mailto:${to}?${qs}`;
}
